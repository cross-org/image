import type { ImageData, ImageFormat } from "../types.ts";

/**
 * TIFF format handler
 * Implements a basic TIFF decoder and encoder
 */
export class TIFFFormat implements ImageFormat {
  readonly name = "tiff";
  readonly mimeType = "image/tiff";

  canDecode(data: Uint8Array): boolean {
    // TIFF signature: "II" (little-endian) or "MM" (big-endian) followed by 42
    return data.length >= 4 &&
      (
        (data[0] === 0x49 && data[1] === 0x49 && data[2] === 0x2a &&
          data[3] === 0x00) || // "II*\0"
        (data[0] === 0x4d && data[1] === 0x4d && data[2] === 0x00 &&
          data[3] === 0x2a) // "MM\0*"
      );
  }

  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid TIFF signature");
    }

    // Determine byte order
    const isLittleEndian = data[0] === 0x49;

    // Read IFD offset
    const ifdOffset = this.readUint32(data, 4, isLittleEndian);

    // Parse IFD to get image dimensions
    const width = this.getIFDValue(data, ifdOffset, 0x0100, isLittleEndian); // ImageWidth tag
    const height = this.getIFDValue(data, ifdOffset, 0x0101, isLittleEndian); // ImageHeight tag

    if (!width || !height) {
      throw new Error("Could not determine TIFF dimensions");
    }

    // For a complete pure JS implementation, we'd need to handle:
    // - Various compression schemes (LZW, JPEG, PackBits, etc.)
    // - Different color spaces and bit depths
    // - Strips and tiles
    // - Multiple IFDs (multi-page TIFFs)
    // This is very complex, so we'll use the runtime's decoder if available.

    const rgba = await this.decodeUsingRuntime(data, width, height);

    return { width, height, data: rgba };
  }

  encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    // Create an uncompressed TIFF with RGBA
    const result: number[] = [];

    // Header (8 bytes)
    // Little-endian byte order
    result.push(0x49, 0x49); // "II"
    result.push(0x2a, 0x00); // 42

    // IFD offset (will be at byte 8)
    const ifdOffset = 8 + width * height * 4; // After header and pixel data
    this.writeUint32LE(result, ifdOffset);

    // Pixel data (RGBA, uncompressed)
    for (let i = 0; i < data.length; i++) {
      result.push(data[i]);
    }

    // IFD (Image File Directory)
    const ifdStart = result.length;
    const numEntries = 11;
    this.writeUint16LE(result, numEntries);

    // IFD entries (12 bytes each)
    // ImageWidth (0x0100)
    this.writeIFDEntry(result, 0x0100, 4, 1, width);

    // ImageHeight (0x0101)
    this.writeIFDEntry(result, 0x0101, 4, 1, height);

    // BitsPerSample (0x0102) - 8 bits per channel
    this.writeIFDEntry(
      result,
      0x0102,
      3,
      4,
      ifdStart + numEntries * 12 + 4 + 16,
    );

    // Compression (0x0103) - 1 = uncompressed
    this.writeIFDEntry(result, 0x0103, 3, 1, 1);

    // PhotometricInterpretation (0x0106) - 2 = RGB
    this.writeIFDEntry(result, 0x0106, 3, 1, 2);

    // StripOffsets (0x0111)
    this.writeIFDEntry(result, 0x0111, 4, 1, 8);

    // SamplesPerPixel (0x0115) - 4 (RGBA)
    this.writeIFDEntry(result, 0x0115, 3, 1, 4);

    // RowsPerStrip (0x0116)
    this.writeIFDEntry(result, 0x0116, 4, 1, height);

    // StripByteCounts (0x0117)
    this.writeIFDEntry(result, 0x0117, 4, 1, width * height * 4);

    // XResolution (0x011a)
    this.writeIFDEntry(result, 0x011a, 5, 1, ifdStart + numEntries * 12 + 4);

    // YResolution (0x011b)
    this.writeIFDEntry(
      result,
      0x011b,
      5,
      1,
      ifdStart + numEntries * 12 + 4 + 8,
    );

    // Next IFD offset (0 = no more IFDs)
    this.writeUint32LE(result, 0);

    // XResolution value (72 DPI as rational: 72/1)
    this.writeUint32LE(result, 72);
    this.writeUint32LE(result, 1);

    // YResolution value (72 DPI as rational: 72/1)
    this.writeUint32LE(result, 72);
    this.writeUint32LE(result, 1);

    // BitsPerSample values
    this.writeUint16LE(result, 8);
    this.writeUint16LE(result, 8);
    this.writeUint16LE(result, 8);
    this.writeUint16LE(result, 8);

    return Promise.resolve(new Uint8Array(result));
  }

  private readUint16(
    data: Uint8Array,
    offset: number,
    isLittleEndian: boolean,
  ): number {
    if (isLittleEndian) {
      return data[offset] | (data[offset + 1] << 8);
    } else {
      return (data[offset] << 8) | data[offset + 1];
    }
  }

  private readUint32(
    data: Uint8Array,
    offset: number,
    isLittleEndian: boolean,
  ): number {
    if (isLittleEndian) {
      return data[offset] | (data[offset + 1] << 8) |
        (data[offset + 2] << 16) | (data[offset + 3] << 24);
    } else {
      return (data[offset] << 24) | (data[offset + 1] << 16) |
        (data[offset + 2] << 8) | data[offset + 3];
    }
  }

  private writeUint16LE(result: number[], value: number): void {
    result.push(value & 0xff, (value >>> 8) & 0xff);
  }

  private writeUint32LE(result: number[], value: number): void {
    result.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  }

  private writeIFDEntry(
    result: number[],
    tag: number,
    type: number,
    count: number,
    valueOrOffset: number,
  ): void {
    this.writeUint16LE(result, tag);
    this.writeUint16LE(result, type);
    this.writeUint32LE(result, count);
    this.writeUint32LE(result, valueOrOffset);
  }

  private getIFDValue(
    data: Uint8Array,
    ifdOffset: number,
    tag: number,
    isLittleEndian: boolean,
  ): number | null {
    const numEntries = this.readUint16(data, ifdOffset, isLittleEndian);
    let pos = ifdOffset + 2;

    for (let i = 0; i < numEntries; i++) {
      const entryTag = this.readUint16(data, pos, isLittleEndian);
      const entryType = this.readUint16(data, pos + 2, isLittleEndian);
      const entryCount = this.readUint32(data, pos + 4, isLittleEndian);
      const entryValue = this.readUint32(data, pos + 8, isLittleEndian);

      if (entryTag === tag) {
        // For short/long types with count=1, value is stored directly
        if ((entryType === 3 || entryType === 4) && entryCount === 1) {
          return entryValue;
        }
      }

      pos += 12;
    }

    return null;
  }

  private async decodeUsingRuntime(
    data: Uint8Array,
    _width: number,
    _height: number,
  ): Promise<Uint8Array> {
    // Try to use ImageDecoder API if available (Deno, modern browsers)
    if (typeof ImageDecoder !== "undefined") {
      try {
        const decoder = new ImageDecoder({ data, type: "image/tiff" });
        const result = await decoder.decode();
        const bitmap = result.image;

        // Create a canvas to extract pixel data
        const canvas = new OffscreenCanvas(
          bitmap.displayWidth,
          bitmap.displayHeight,
        );
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        bitmap.close();

        return new Uint8Array(imageData.data.buffer);
      } catch (error) {
        throw new Error(`TIFF decoding failed: ${error}`);
      }
    }

    throw new Error(
      "TIFF decoding requires ImageDecoder API or equivalent runtime support",
    );
  }
}
