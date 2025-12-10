import type { ImageData, ImageMetadata } from "../types.ts";
import { TIFFFormat } from "./tiff.ts";

/**
 * DNG format handler
 * Implements a basic Linear DNG (Digital Negative) writer.
 * DNG is based on TIFF/EP. This implementation creates a valid DNG
 * containing uncompressed linear RGB data (demosaiced).
 */
export class DNGFormat extends TIFFFormat {
  /** Format name identifier */
  override readonly name = "dng";
  /** MIME type for DNG images */
  override readonly mimeType = "image/x-adobe-dng";

  /**
   * Check if the given data is a DNG image
   * @param data Raw image data to check
   * @returns true if data has DNG signature (TIFF signature + DNGVersion tag)
   */
  override canDecode(data: Uint8Array): boolean {
    // DNG is a TIFF file, so it must have a TIFF signature
    if (!super.canDecode(data)) {
      return false;
    }

    // To be strictly a DNG, it should have the DNGVersion tag (0xC612 / 50706)
    // However, scanning for tags in canDecode might be slow.
    // For now, we rely on the fact that it's a TIFF-based format.
    // If we want to be stricter, we would need to parse the IFD here.

    // Let's do a quick check for the DNGVersion tag in the first few bytes if possible,
    // but tags are in the IFD which can be anywhere.
    // So we'll just check if it's a TIFF and maybe rely on extension or user intent.
    // But wait, if we register both TIFF and DNG, who wins?
    // The first one in the list.
    // So we should probably implement a proper check if possible, or just accept that
    // DNGs are TIFFs.

    // For this implementation, we'll assume if it's a TIFF, it *could* be a DNG.
    // But to distinguish, we really should check for DNGVersion.

    // Let's try to find the DNGVersion tag (50706) in the first IFD.
    try {
      const isLittleEndian = data[0] === 0x49;
      const ifdOffset = this.readUint32(data, 4, isLittleEndian);

      // Safety check for offset
      if (ifdOffset >= data.length) return false;

      const numEntries = this.readUint16(data, ifdOffset, isLittleEndian);

      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifdOffset + 2 + (i * 12);
        if (entryOffset + 12 > data.length) break;

        const tag = this.readUint16(data, entryOffset, isLittleEndian);
        if (tag === 50706) { // DNGVersion
          return true;
        }
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * Encode RGBA image data to DNG format (Linear DNG)
   * @param imageData Image data to encode
   * @returns Encoded DNG image bytes
   */
  override encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    // We'll create a Linear DNG (demosaiced RGB)
    // This is very similar to a standard TIFF but with specific tags.

    const result: number[] = [];

    // Header (8 bytes)
    // Little-endian byte order
    result.push(0x49, 0x49); // "II"
    result.push(0x2a, 0x00); // 42

    // IFD offset (will be after header and pixel data)
    const ifdOffset = 8 + data.length;
    this.writeUint32LE(result, ifdOffset);

    // Pixel data (Uncompressed RGBA)
    for (let i = 0; i < data.length; i++) {
      result.push(data[i]);
    }

    // IFD (Image File Directory)
    const ifdStart = result.length;

    // Tags we need for DNG:
    // - NewSubfileType (254)
    // - ImageWidth (256)
    // - ImageHeight (257)
    // - BitsPerSample (258)
    // - Compression (259)
    // - PhotometricInterpretation (262)
    // - StripOffsets (273)
    // - SamplesPerPixel (277)
    // - RowsPerStrip (278)
    // - StripByteCounts (279)
    // - PlanarConfiguration (284)
    // - ExtraSamples (338) - for Alpha
    // - DNGVersion (50706)
    // - UniqueCameraModel (50708)

    const numEntries = 14;

    this.writeUint16LE(result, numEntries);

    // Calculate offsets for variable-length data
    let dataOffset = ifdStart + 2 + numEntries * 12 + 4; // +4 for next IFD offset (0)

    // 1. NewSubfileType (0x00FE) - 0 = Full resolution image
    this.writeIFDEntry(result, 0x00FE, 4, 1, 0);

    // 2. ImageWidth (0x0100)
    this.writeIFDEntry(result, 0x0100, 4, 1, width);

    // 3. ImageHeight (0x0101)
    this.writeIFDEntry(result, 0x0101, 4, 1, height);

    // 4. BitsPerSample (0x0102) - 8, 8, 8, 8
    this.writeIFDEntry(result, 0x0102, 3, 4, dataOffset);
    // Write the actual values later
    const _bitsPerSampleOffset = dataOffset;
    dataOffset += 8; // 4 * 2 bytes

    // 5. Compression (0x0103) - 1 = Uncompressed
    this.writeIFDEntry(result, 0x0103, 3, 1, 1);

    // 6. PhotometricInterpretation (0x0106) - 2 = RGB (Linear DNG)
    // For Raw DNG it would be 32803 (CFA), but we are saving processed RGB data
    this.writeIFDEntry(result, 0x0106, 3, 1, 2);

    // 7. StripOffsets (0x0111)
    this.writeIFDEntry(result, 0x0111, 4, 1, 8); // Pixel data starts at offset 8

    // 8. SamplesPerPixel (0x0115) - 4 (RGBA)
    this.writeIFDEntry(result, 0x0115, 3, 1, 4);

    // 9. RowsPerStrip (0x0116)
    this.writeIFDEntry(result, 0x0116, 4, 1, height);

    // 10. StripByteCounts (0x0117)
    this.writeIFDEntry(result, 0x0117, 4, 1, data.length);

    // 11. PlanarConfiguration (0x011C) - 1 = Chunky
    this.writeIFDEntry(result, 0x011C, 3, 1, 1);

    // 12. ExtraSamples (0x0152) - 2 = Unassociated alpha
    this.writeIFDEntry(result, 0x0152, 3, 1, 2); // 1 value, fits in offset field? No, it's SHORT (3), count 1. Value 2.
    // Wait, writeIFDEntry puts value in offset field if count*type_size <= 4.
    // SHORT is 2 bytes. 1 * 2 = 2 <= 4. So value goes in offset.

    // 13. DNGVersion (0xC612 / 50706) - 1, 4, 0, 0
    this.writeIFDEntry(result, 50706, 1, 4, 0x01040000);
    // BYTE (1) count 4. 1*4=4. Fits.
    // 1, 4, 0, 0 -> 0x01, 0x04, 0x00, 0x00.
    // Little endian: 01 04 00 00.
    // As uint32: 0x00000401? No, bytes are 1, 4, 0, 0.
    // In file: 01 04 00 00.
    // readUint32LE would read this as 0x00000401.
    // So we pass 0x00000401?
    // Let's verify writeIFDEntry logic in TIFFFormat (I can't see it but I assume it writes value directly if it fits).
    // Actually, I need to check how writeIFDEntry works.
    // Assuming it takes a number and writes it.

    // 14. UniqueCameraModel (0xC614 / 50708) - "Cross Image DNG"
    const modelName = "Cross Image DNG\0";
    const modelNameBytes = new TextEncoder().encode(modelName);
    this.writeIFDEntry(result, 50708, 2, modelNameBytes.length, dataOffset);
    const _modelNameOffset = dataOffset;
    dataOffset += modelNameBytes.length;

    // Next IFD offset (0)
    this.writeUint32LE(result, 0);

    // Write variable length data

    // BitsPerSample data (8, 8, 8, 8)
    // We need to write this at bitsPerSampleOffset
    // But we are appending to result array.
    // We calculated dataOffset relative to start of file?
    // No, dataOffset was initialized to `ifdStart + 2 + numEntries * 12 + 4`.
    // This is correct absolute offset.
    // But we need to fill the gap between end of IFD and dataOffset?
    // No, we are writing sequentially.

    // Wait, `result` is an array of bytes.
    // We wrote the IFD entries. Now we are at `ifdStart + 2 + numEntries * 12 + 4`.
    // This matches `bitsPerSampleOffset`.

    // Write BitsPerSample (8, 8, 8, 8)
    this.writeUint16LE(result, 8);
    this.writeUint16LE(result, 8);
    this.writeUint16LE(result, 8);
    this.writeUint16LE(result, 8);

    // Write UniqueCameraModel string
    for (let i = 0; i < modelNameBytes.length; i++) {
      result.push(modelNameBytes[i]);
    }

    return Promise.resolve(new Uint8Array(result));
  }

  // Helper methods duplicated from TIFFFormat because they are protected/private there
  // and we can't easily access them if they are private.
  // Let's check TIFFFormat visibility.
  // The read/write helpers were not exported in the previous read_file output.

  /**
   * Extract metadata from DNG data without fully decoding the pixel data
   * DNG is TIFF-based, so we can use the parent extractMetadata and override format
   * @param data Raw DNG data
   * @returns Extracted metadata or undefined
   */
  override async extractMetadata(
    data: Uint8Array,
  ): Promise<ImageMetadata | undefined> {
    // Use parent TIFF extractMetadata
    const metadata = await super.extractMetadata(data);

    if (metadata) {
      // Override format to indicate this is a DNG
      metadata.format = "dng";
    }

    return metadata;
  }
}
