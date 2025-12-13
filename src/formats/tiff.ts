import type {
  ImageData,
  ImageFormat,
  ImageMetadata,
  MultiFrameImageData,
} from "../types.ts";
import { TIFFLZWDecoder, TIFFLZWEncoder } from "../utils/tiff_lzw.ts";
import {
  packBitsCompress,
  packBitsDecompress,
} from "../utils/tiff_packbits.ts";
import { deflateCompress, deflateDecompress } from "../utils/tiff_deflate.ts";
import { validateImageDimensions } from "../utils/security.ts";

// Constants for unit conversions
const DEFAULT_DPI = 72;

/**
 * Options for TIFF encoding
 */
export interface TIFFEncodeOptions {
  /** Compression method: "none" for uncompressed (default), "lzw" for LZW, "packbits" for PackBits RLE, "deflate" for Adobe-style Deflate */
  compression?: "none" | "lzw" | "packbits" | "deflate";
  /** Encode as grayscale instead of RGB/RGBA */
  grayscale?: boolean;
  /** Encode as RGB without alpha channel (ignored if grayscale is true) */
  rgb?: boolean;
}

/**
 * TIFF format handler
 * Implements pure-JS TIFF decoder for uncompressed, LZW, PackBits, and Deflate-compressed RGB/RGBA images
 * and encoder for uncompressed, LZW, PackBits, and Deflate-compressed RGBA TIFFs. Falls back to ImageDecoder
 * for JPEG-compressed TIFFs.
 * Supports multi-page TIFF files.
 */
export class TIFFFormat implements ImageFormat {
  /** Format name identifier */
  readonly name: string = "tiff";
  /** MIME type for TIFF images */
  readonly mimeType: string = "image/tiff";

  /**
   * Check if this format supports multiple frames (pages)
   * @returns true for TIFF format
   */
  supportsMultipleFrames(): boolean {
    return true;
  }

  /**
   * Check if the given data is a TIFF image
   * @param data Raw image data to check
   * @returns true if data has TIFF signature
   */
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

  /**
   * Decode TIFF image data to RGBA (first page only)
   * @param data Raw TIFF image data
   * @returns Decoded image data with RGBA pixels of first page
   */
  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid TIFF signature");
    }

    // Determine byte order
    const isLittleEndian = data[0] === 0x49;

    // Read IFD offset
    const ifdOffset = this.readUint32(data, 4, isLittleEndian);

    // Parse IFD to get image dimensions and metadata
    const width = this.getIFDValue(data, ifdOffset, 0x0100, isLittleEndian); // ImageWidth tag
    const height = this.getIFDValue(data, ifdOffset, 0x0101, isLittleEndian); // ImageHeight tag

    if (!width || !height) {
      throw new Error("Could not determine TIFF dimensions");
    }

    // Extract metadata from TIFF tags
    const metadata: ImageMetadata = {};

    // XResolution (0x011a) and YResolution (0x011b) for DPI
    const xResOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x011a,
      isLittleEndian,
    );
    const yResOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x011b,
      isLittleEndian,
    );

    if (xResOffset && xResOffset < data.length - 8) {
      const numerator = this.readUint32(data, xResOffset, isLittleEndian);
      const denominator = this.readUint32(
        data,
        xResOffset + 4,
        isLittleEndian,
      );
      if (denominator > 0) {
        metadata.dpiX = Math.round(numerator / denominator);
      }
    }

    if (yResOffset && yResOffset < data.length - 8) {
      const numerator = this.readUint32(data, yResOffset, isLittleEndian);
      const denominator = this.readUint32(
        data,
        yResOffset + 4,
        isLittleEndian,
      );
      if (denominator > 0) {
        metadata.dpiY = Math.round(numerator / denominator);
      }
    }

    // Calculate physical dimensions if DPI is available
    if (metadata.dpiX && metadata.dpiY) {
      metadata.physicalWidth = width / metadata.dpiX;
      metadata.physicalHeight = height / metadata.dpiY;
    }

    // ImageDescription (0x010e)
    const descOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x010e,
      isLittleEndian,
    );
    if (descOffset && descOffset < data.length) {
      metadata.description = this.readString(data, descOffset);
    }

    // Artist (0x013b)
    const artistOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x013b,
      isLittleEndian,
    );
    if (artistOffset && artistOffset < data.length) {
      metadata.author = this.readString(data, artistOffset);
    }

    // Copyright (0x8298)
    const copyrightOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x8298,
      isLittleEndian,
    );
    if (copyrightOffset && copyrightOffset < data.length) {
      metadata.copyright = this.readString(data, copyrightOffset);
    }

    // DateTime (0x0132)
    const dateTimeOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x0132,
      isLittleEndian,
    );
    if (dateTimeOffset && dateTimeOffset < data.length) {
      const dateStr = this.readString(data, dateTimeOffset);
      const match = dateStr.match(
        /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      );
      if (match) {
        metadata.creationDate = new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5]),
          parseInt(match[6]),
        );
      }
    }

    // For a complete pure JS implementation, we'd need to handle:
    // - Various compression schemes (LZW, JPEG, PackBits, etc.)
    // - Different color spaces and bit depths
    // - Strips and tiles
    // - Multiple IFDs (multi-page TIFFs)
    // This is very complex, so we'll use the runtime's decoder if available.

    const rgba = await this.decodeUsingRuntime(data, width, height);

    return {
      width,
      height,
      data: rgba,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  async encode(
    imageData: ImageData,
    options?: unknown,
  ): Promise<Uint8Array> {
    const { width, height, data, metadata } = imageData;
    const opts = options as TIFFEncodeOptions | undefined;
    const compression = opts?.compression ?? "none";
    const grayscale = opts?.grayscale ?? false;
    const rgb = opts?.rgb ?? false;

    // Convert RGBA to grayscale if requested
    let sourceData: Uint8Array;
    let samplesPerPixel: number;

    if (grayscale) {
      sourceData = new Uint8Array(width * height);
      samplesPerPixel = 1;
      for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        // Use standard luminance formula
        sourceData[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
    } else if (rgb) {
      // Convert RGBA to RGB (strip alpha channel)
      sourceData = new Uint8Array(width * height * 3);
      samplesPerPixel = 3;
      for (let i = 0; i < width * height; i++) {
        sourceData[i * 3] = data[i * 4]; // R
        sourceData[i * 3 + 1] = data[i * 4 + 1]; // G
        sourceData[i * 3 + 2] = data[i * 4 + 2]; // B
      }
    } else {
      // Keep as RGBA
      sourceData = data;
      samplesPerPixel = 4;
    }

    // Prepare pixel data (compress if needed)
    let pixelData: Uint8Array;
    let compressionCode: number;

    if (compression === "lzw") {
      // LZW compress the pixel data
      const encoder = new TIFFLZWEncoder();
      pixelData = encoder.compress(sourceData);
      compressionCode = 5;
    } else if (compression === "packbits") {
      // PackBits compress the pixel data
      pixelData = packBitsCompress(sourceData);
      compressionCode = 32773;
    } else if (compression === "deflate") {
      // Deflate compress the pixel data
      pixelData = await deflateCompress(sourceData);
      compressionCode = 8;
    } else {
      // Uncompressed
      pixelData = sourceData;
      compressionCode = 1;
    }

    const result: number[] = [];

    // Header (8 bytes)
    // Little-endian byte order
    result.push(0x49, 0x49); // "II"
    result.push(0x2a, 0x00); // 42

    // IFD offset (will be after header and pixel data)
    const ifdOffset = 8 + pixelData.length;
    this.writeUint32LE(result, ifdOffset);

    // Pixel data
    for (let i = 0; i < pixelData.length; i++) {
      result.push(pixelData[i]);
    }

    // IFD (Image File Directory)
    const ifdStart = result.length;

    // Count number of entries (including metadata)
    // Grayscale: 10 entries (no ExtraSamples)
    // RGB: 11 entries (no ExtraSamples)
    // RGBA: 12 entries (includes ExtraSamples)
    let numEntries = grayscale ? 10 : (rgb ? 11 : 12);
    if (metadata?.description) numEntries++;
    if (metadata?.author) numEntries++;
    if (metadata?.copyright) numEntries++;
    if (metadata?.creationDate) numEntries++;

    this.writeUint16LE(result, numEntries);

    // Calculate offsets for variable-length data
    let dataOffset = ifdStart + 2 + numEntries * 12 + 4;

    // IFD entries (12 bytes each)
    // ImageWidth (0x0100)
    this.writeIFDEntry(result, 0x0100, 4, 1, width);

    // ImageHeight (0x0101)
    this.writeIFDEntry(result, 0x0101, 4, 1, height);

    // BitsPerSample (0x0102) - 8 bits per channel
    if (grayscale) {
      // Single value for grayscale
      this.writeIFDEntry(result, 0x0102, 3, 1, 8);
    } else if (rgb) {
      // 3 values for RGB
      this.writeIFDEntry(result, 0x0102, 3, 3, dataOffset);
      dataOffset += 6; // 3 x 2-byte values
    } else {
      // 4 values for RGBA
      this.writeIFDEntry(result, 0x0102, 3, 4, dataOffset);
      dataOffset += 8; // 4 x 2-byte values
    }

    // Compression (0x0103) - 1 = uncompressed, 5 = LZW
    this.writeIFDEntry(result, 0x0103, 3, 1, compressionCode);

    // PhotometricInterpretation (0x0106) - 1 = BlackIsZero (grayscale), 2 = RGB
    this.writeIFDEntry(result, 0x0106, 3, 1, grayscale ? 1 : 2);

    // StripOffsets (0x0111)
    this.writeIFDEntry(result, 0x0111, 4, 1, 8);

    // SamplesPerPixel (0x0115) - 1 for grayscale, 3 for RGB, 4 for RGBA
    this.writeIFDEntry(result, 0x0115, 3, 1, samplesPerPixel);

    // RowsPerStrip (0x0116)
    this.writeIFDEntry(result, 0x0116, 4, 1, height);

    // StripByteCounts (0x0117)
    this.writeIFDEntry(result, 0x0117, 4, 1, pixelData.length);

    // XResolution (0x011a)
    const xResOffset = dataOffset;
    this.writeIFDEntry(result, 0x011a, 5, 1, xResOffset);
    dataOffset += 8;

    // YResolution (0x011b)
    const yResOffset = dataOffset;
    this.writeIFDEntry(result, 0x011b, 5, 1, yResOffset);
    dataOffset += 8;

    // ExtraSamples (0x0152) - 2 = unassociated alpha (only for RGBA)
    if (!grayscale && !rgb) {
      this.writeIFDEntry(result, 0x0152, 3, 1, 2);
    }

    // Optional metadata entries
    if (metadata?.description) {
      const descBytes = new TextEncoder().encode(metadata.description + "\0");
      this.writeIFDEntry(result, 0x010e, 2, descBytes.length, dataOffset);
      dataOffset += descBytes.length;
    }

    if (metadata?.author) {
      const authorBytes = new TextEncoder().encode(metadata.author + "\0");
      this.writeIFDEntry(result, 0x013b, 2, authorBytes.length, dataOffset);
      dataOffset += authorBytes.length;
    }

    if (metadata?.copyright) {
      const copyrightBytes = new TextEncoder().encode(
        metadata.copyright + "\0",
      );
      this.writeIFDEntry(result, 0x8298, 2, copyrightBytes.length, dataOffset);
      dataOffset += copyrightBytes.length;
    }

    if (metadata?.creationDate) {
      const date = metadata.creationDate;
      const dateStr = `${date.getFullYear()}:${
        String(date.getMonth() + 1).padStart(2, "0")
      }:${String(date.getDate()).padStart(2, "0")} ${
        String(date.getHours()).padStart(2, "0")
      }:${String(date.getMinutes()).padStart(2, "0")}:${
        String(date.getSeconds()).padStart(2, "0")
      }\0`;
      const dateBytes = new TextEncoder().encode(dateStr);
      this.writeIFDEntry(result, 0x0132, 2, dateBytes.length, dataOffset);
      dataOffset += dateBytes.length;
    }

    // Next IFD offset (0 = no more IFDs)
    this.writeUint32LE(result, 0);

    // Write variable-length data
    // BitsPerSample values (only for RGB and RGBA, not for grayscale)
    if (rgb) {
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);
    } else if (!grayscale) {
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);
    }

    // XResolution value (rational)
    const dpiX = metadata?.dpiX ?? DEFAULT_DPI;
    this.writeUint32LE(result, dpiX);
    this.writeUint32LE(result, 1);

    // YResolution value (rational)
    const dpiY = metadata?.dpiY ?? DEFAULT_DPI;
    this.writeUint32LE(result, dpiY);
    this.writeUint32LE(result, 1);

    // Write metadata strings
    if (metadata?.description) {
      const descBytes = new TextEncoder().encode(metadata.description + "\0");
      for (const byte of descBytes) {
        result.push(byte);
      }
    }

    if (metadata?.author) {
      const authorBytes = new TextEncoder().encode(metadata.author + "\0");
      for (const byte of authorBytes) {
        result.push(byte);
      }
    }

    if (metadata?.copyright) {
      const copyrightBytes = new TextEncoder().encode(
        metadata.copyright + "\0",
      );
      for (const byte of copyrightBytes) {
        result.push(byte);
      }
    }

    if (metadata?.creationDate) {
      const date = metadata.creationDate;
      const dateStr = `${date.getFullYear()}:${
        String(date.getMonth() + 1).padStart(2, "0")
      }:${String(date.getDate()).padStart(2, "0")} ${
        String(date.getHours()).padStart(2, "0")
      }:${String(date.getMinutes()).padStart(2, "0")}:${
        String(date.getSeconds()).padStart(2, "0")
      }\0`;
      const dateBytes = new TextEncoder().encode(dateStr);
      for (const byte of dateBytes) {
        result.push(byte);
      }
    }

    return Promise.resolve(new Uint8Array(result));
  }

  /**
   * Decode all pages from a multi-page TIFF
   */
  async decodeFrames(data: Uint8Array): Promise<MultiFrameImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid TIFF signature");
    }

    // Determine byte order
    const isLittleEndian = data[0] === 0x49;

    // Read first IFD offset
    let ifdOffset = this.readUint32(data, 4, isLittleEndian);

    const frames: MultiFrameImageData["frames"] = [];
    let globalMetadata: ImageMetadata | undefined;

    // Loop through all IFDs
    while (ifdOffset !== 0 && ifdOffset < data.length) {
      try {
        // Get dimensions for this page
        const width = this.getIFDValue(data, ifdOffset, 0x0100, isLittleEndian);
        const height = this.getIFDValue(
          data,
          ifdOffset,
          0x0101,
          isLittleEndian,
        );

        if (!width || !height) {
          throw new Error("Could not determine TIFF dimensions for page");
        }

        // Extract metadata for this page (only from first page for global metadata)
        if (!globalMetadata) {
          globalMetadata = this.extractMetadataFromIFD(
            data,
            ifdOffset,
            isLittleEndian,
          );
        }

        // Decode the page
        const rgba = await this.decodePage(data, ifdOffset, width, height);

        frames.push({
          width,
          height,
          data: rgba,
        });

        // Read next IFD offset
        const numEntries = this.readUint16(data, ifdOffset, isLittleEndian);
        const nextIFDOffsetPos = ifdOffset + 2 + numEntries * 12;
        if (nextIFDOffsetPos + 3 >= data.length) {
          break;
        }
        ifdOffset = this.readUint32(data, nextIFDOffsetPos, isLittleEndian);
      } catch (error) {
        // If we fail to decode a page, we've likely hit corruption or unsupported features
        // Stop processing but return frames successfully decoded so far
        if (frames.length === 0) {
          throw error; // No frames decoded - propagate the error
        }
        break;
      }
    }

    if (frames.length === 0) {
      throw new Error("No pages found in TIFF");
    }

    // Use dimensions from first frame as canvas dimensions
    return {
      width: frames[0].width,
      height: frames[0].height,
      frames,
      metadata: globalMetadata && Object.keys(globalMetadata).length > 0
        ? globalMetadata
        : undefined,
    };
  }

  /**
   * Encode multi-page TIFF
   */
  async encodeFrames(
    imageData: MultiFrameImageData,
    options?: unknown,
  ): Promise<Uint8Array> {
    const opts = options as TIFFEncodeOptions | undefined;
    const compression = opts?.compression ?? "none";

    if (imageData.frames.length === 0) {
      throw new Error("No frames to encode");
    }

    const result: number[] = [];

    // Header (8 bytes)
    // Little-endian byte order
    result.push(0x49, 0x49); // "II"
    result.push(0x2a, 0x00); // 42

    // First IFD offset (will be calculated after writing all pixel data)
    const firstIFDOffsetPos = result.length;
    this.writeUint32LE(result, 0); // Placeholder

    let currentOffset = 8;
    const ifdOffsets: number[] = [];
    const pixelDataOffsets: number[] = [];

    // Write all pixel data first
    for (const frame of imageData.frames) {
      pixelDataOffsets.push(currentOffset);

      let pixelData: Uint8Array;
      if (compression === "lzw") {
        const encoder = new TIFFLZWEncoder();
        pixelData = encoder.compress(frame.data);
      } else if (compression === "packbits") {
        pixelData = packBitsCompress(frame.data);
      } else if (compression === "deflate") {
        pixelData = await deflateCompress(frame.data);
      } else {
        pixelData = frame.data;
      }

      for (let i = 0; i < pixelData.length; i++) {
        result.push(pixelData[i]);
      }
      currentOffset += pixelData.length;
    }

    // Write IFDs
    for (let i = 0; i < imageData.frames.length; i++) {
      const frame = imageData.frames[i];
      const isLastIFD = i === imageData.frames.length - 1;

      ifdOffsets.push(currentOffset);
      const ifdStart = result.length;

      // Count number of entries (including metadata only for first page)
      let numEntries = 12; // Base entries (including ExtraSamples)
      if (i === 0 && imageData.metadata) {
        if (imageData.metadata.description) numEntries++;
        if (imageData.metadata.author) numEntries++;
        if (imageData.metadata.copyright) numEntries++;
        if (imageData.metadata.creationDate) numEntries++;
      }

      this.writeUint16LE(result, numEntries);

      // Calculate offsets for variable-length data
      let dataOffset = ifdStart + 2 + numEntries * 12 + 4;

      // IFD entries
      this.writeIFDEntry(result, 0x0100, 4, 1, frame.width); // ImageWidth
      this.writeIFDEntry(result, 0x0101, 4, 1, frame.height); // ImageHeight

      // BitsPerSample
      this.writeIFDEntry(result, 0x0102, 3, 4, dataOffset);
      dataOffset += 8;

      // Compression
      let compressionCode: number;
      if (compression === "lzw") {
        compressionCode = 5;
      } else if (compression === "packbits") {
        compressionCode = 32773;
      } else if (compression === "deflate") {
        compressionCode = 8;
      } else {
        compressionCode = 1;
      }
      this.writeIFDEntry(result, 0x0103, 3, 1, compressionCode);

      // PhotometricInterpretation
      this.writeIFDEntry(result, 0x0106, 3, 1, 2);

      // StripOffsets
      this.writeIFDEntry(result, 0x0111, 4, 1, pixelDataOffsets[i]);

      // SamplesPerPixel
      this.writeIFDEntry(result, 0x0115, 3, 1, 4);

      // RowsPerStrip
      this.writeIFDEntry(result, 0x0116, 4, 1, frame.height);

      // StripByteCounts
      let pixelDataSize: number;
      if (compression === "lzw") {
        pixelDataSize = new TIFFLZWEncoder().compress(frame.data).length;
      } else if (compression === "packbits") {
        pixelDataSize = packBitsCompress(frame.data).length;
      } else if (compression === "deflate") {
        pixelDataSize = (await deflateCompress(frame.data)).length;
      } else {
        pixelDataSize = frame.data.length;
      }
      this.writeIFDEntry(result, 0x0117, 4, 1, pixelDataSize);

      // XResolution
      const xResOffset = dataOffset;
      this.writeIFDEntry(result, 0x011a, 5, 1, xResOffset);
      dataOffset += 8;

      // YResolution
      const yResOffset = dataOffset;
      this.writeIFDEntry(result, 0x011b, 5, 1, yResOffset);
      dataOffset += 8;

      // ExtraSamples (0x0152) - 2 = unassociated alpha
      this.writeIFDEntry(result, 0x0152, 3, 1, 2);

      // Metadata (only for first page)
      if (i === 0 && imageData.metadata) {
        if (imageData.metadata.description) {
          const descBytes = new TextEncoder().encode(
            imageData.metadata.description + "\0",
          );
          this.writeIFDEntry(result, 0x010e, 2, descBytes.length, dataOffset);
          dataOffset += descBytes.length;
        }

        if (imageData.metadata.author) {
          const authorBytes = new TextEncoder().encode(
            imageData.metadata.author + "\0",
          );
          this.writeIFDEntry(result, 0x013b, 2, authorBytes.length, dataOffset);
          dataOffset += authorBytes.length;
        }

        if (imageData.metadata.copyright) {
          const copyrightBytes = new TextEncoder().encode(
            imageData.metadata.copyright + "\0",
          );
          this.writeIFDEntry(
            result,
            0x8298,
            2,
            copyrightBytes.length,
            dataOffset,
          );
          dataOffset += copyrightBytes.length;
        }

        if (imageData.metadata.creationDate) {
          const date = imageData.metadata.creationDate;
          const dateStr = `${date.getFullYear()}:${
            String(date.getMonth() + 1).padStart(2, "0")
          }:${String(date.getDate()).padStart(2, "0")} ${
            String(date.getHours()).padStart(2, "0")
          }:${String(date.getMinutes()).padStart(2, "0")}:${
            String(date.getSeconds()).padStart(2, "0")
          }\0`;
          const dateBytes = new TextEncoder().encode(dateStr);
          this.writeIFDEntry(result, 0x0132, 2, dateBytes.length, dataOffset);
          dataOffset += dateBytes.length;
        }
      }

      // Next IFD offset
      const nextIFDOffset = isLastIFD ? 0 : dataOffset;
      this.writeUint32LE(result, nextIFDOffset);

      currentOffset = dataOffset;

      // Write variable-length data
      // BitsPerSample values (must be written first to match offset calculation)
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);
      this.writeUint16LE(result, 8);

      // XResolution value (rational)
      const dpiX = (i === 0 && imageData.metadata?.dpiX) ||
        DEFAULT_DPI;
      this.writeUint32LE(result, dpiX);
      this.writeUint32LE(result, 1);

      // YResolution value (rational)
      const dpiY = (i === 0 && imageData.metadata?.dpiY) ||
        DEFAULT_DPI;
      this.writeUint32LE(result, dpiY);
      this.writeUint32LE(result, 1);

      // Write metadata strings (only for first page)
      if (i === 0 && imageData.metadata) {
        if (imageData.metadata.description) {
          const descBytes = new TextEncoder().encode(
            imageData.metadata.description + "\0",
          );
          for (const byte of descBytes) {
            result.push(byte);
          }
        }

        if (imageData.metadata.author) {
          const authorBytes = new TextEncoder().encode(
            imageData.metadata.author + "\0",
          );
          for (const byte of authorBytes) {
            result.push(byte);
          }
        }

        if (imageData.metadata.copyright) {
          const copyrightBytes = new TextEncoder().encode(
            imageData.metadata.copyright + "\0",
          );
          for (const byte of copyrightBytes) {
            result.push(byte);
          }
        }

        if (imageData.metadata.creationDate) {
          const date = imageData.metadata.creationDate;
          const dateStr = `${date.getFullYear()}:${
            String(date.getMonth() + 1).padStart(2, "0")
          }:${String(date.getDate()).padStart(2, "0")} ${
            String(date.getHours()).padStart(2, "0")
          }:${String(date.getMinutes()).padStart(2, "0")}:${
            String(date.getSeconds()).padStart(2, "0")
          }\0`;
          const dateBytes = new TextEncoder().encode(dateStr);
          for (const byte of dateBytes) {
            result.push(byte);
          }
        }
      }

      currentOffset = result.length;
    }

    // Write first IFD offset to header
    const firstIFDOffset = ifdOffsets[0];
    result[firstIFDOffsetPos] = firstIFDOffset & 0xff;
    result[firstIFDOffsetPos + 1] = (firstIFDOffset >>> 8) & 0xff;
    result[firstIFDOffsetPos + 2] = (firstIFDOffset >>> 16) & 0xff;
    result[firstIFDOffsetPos + 3] = (firstIFDOffset >>> 24) & 0xff;

    return Promise.resolve(new Uint8Array(result));
  }

  /**
   * Decode a single page from TIFF given its IFD offset
   */
  private async decodePage(
    data: Uint8Array,
    ifdOffset: number,
    width: number,
    height: number,
  ): Promise<Uint8Array> {
    const isLittleEndian = data[0] === 0x49;

    // Try pure JavaScript decoder first
    try {
      const pureJSResult = await this.decodePureJSFromIFD(
        data,
        ifdOffset,
        width,
        height,
        isLittleEndian,
      );
      if (pureJSResult) {
        return pureJSResult;
      }
    } catch (_error) {
      // Pure JS decoder failed, fall through to ImageDecoder silently
    }

    // Fall back to runtime decoder
    return await this.decodeUsingRuntime(data, width, height);
  }

  /**
   * Extract metadata from an IFD
   */
  private extractMetadataFromIFD(
    data: Uint8Array,
    ifdOffset: number,
    isLittleEndian: boolean,
  ): ImageMetadata {
    const metadata: ImageMetadata = {};

    // XResolution and YResolution
    const xResOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x011a,
      isLittleEndian,
    );
    const yResOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x011b,
      isLittleEndian,
    );

    if (xResOffset && xResOffset < data.length - 8) {
      const numerator = this.readUint32(data, xResOffset, isLittleEndian);
      const denominator = this.readUint32(
        data,
        xResOffset + 4,
        isLittleEndian,
      );
      if (denominator > 0) {
        metadata.dpiX = Math.round(numerator / denominator);
      }
    }

    if (yResOffset && yResOffset < data.length - 8) {
      const numerator = this.readUint32(data, yResOffset, isLittleEndian);
      const denominator = this.readUint32(
        data,
        yResOffset + 4,
        isLittleEndian,
      );
      if (denominator > 0) {
        metadata.dpiY = Math.round(numerator / denominator);
      }
    }

    // ImageDescription
    const descOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x010e,
      isLittleEndian,
    );
    if (descOffset && descOffset < data.length) {
      metadata.description = this.readString(data, descOffset);
    }

    // Artist
    const artistOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x013b,
      isLittleEndian,
    );
    if (artistOffset && artistOffset < data.length) {
      metadata.author = this.readString(data, artistOffset);
    }

    // Copyright
    const copyrightOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x8298,
      isLittleEndian,
    );
    if (copyrightOffset && copyrightOffset < data.length) {
      metadata.copyright = this.readString(data, copyrightOffset);
    }

    // DateTime
    const dateTimeOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x0132,
      isLittleEndian,
    );
    if (dateTimeOffset && dateTimeOffset < data.length) {
      const dateStr = this.readString(data, dateTimeOffset);
      const match = dateStr.match(
        /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      );
      if (match) {
        metadata.creationDate = new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5]),
          parseInt(match[6]),
        );
      }
    }

    return metadata;
  }

  protected readUint16(
    data: Uint8Array,
    offset: number,
    isLittleEndian: boolean,
  ): number {
    if (offset + 1 >= data.length) {
      throw new Error("TIFF read error: offset out of bounds");
    }
    if (isLittleEndian) {
      return data[offset] | (data[offset + 1] << 8);
    } else {
      return (data[offset] << 8) | data[offset + 1];
    }
  }

  protected readUint32(
    data: Uint8Array,
    offset: number,
    isLittleEndian: boolean,
  ): number {
    if (offset + 3 >= data.length) {
      throw new Error("TIFF read error: offset out of bounds");
    }
    if (isLittleEndian) {
      return data[offset] | (data[offset + 1] << 8) |
        (data[offset + 2] << 16) | (data[offset + 3] << 24);
    } else {
      return (data[offset] << 24) | (data[offset + 1] << 16) |
        (data[offset + 2] << 8) | data[offset + 3];
    }
  }

  protected writeUint16LE(result: number[], value: number): void {
    result.push(value & 0xff, (value >>> 8) & 0xff);
  }

  protected writeUint32LE(result: number[], value: number): void {
    result.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  }

  protected writeIFDEntry(
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
    if (ifdOffset + 2 > data.length) return null;

    const numEntries = this.readUint16(data, ifdOffset, isLittleEndian);
    let pos = ifdOffset + 2;

    for (let i = 0; i < numEntries; i++) {
      if (pos + 12 > data.length) break;

      const entryTag = this.readUint16(data, pos, isLittleEndian);
      const entryType = this.readUint16(data, pos + 2, isLittleEndian);
      const entryCount = this.readUint32(data, pos + 4, isLittleEndian);
      const entryValue = this.readUint32(data, pos + 8, isLittleEndian);

      if (entryTag === tag) {
        // For SHORT/LONG types with count=1, value is stored directly
        // For other types or count>1, this returns the offset to the actual data
        // Callers should handle offsets appropriately based on the tag type
        if ((entryType === 3 || entryType === 4) && entryCount === 1) {
          return entryValue;
        }
        // Return the value/offset for other cases
        return entryValue;
      }

      pos += 12;
    }

    return null;
  }

  private async decodeUsingRuntime(
    data: Uint8Array,
    width: number,
    height: number,
  ): Promise<Uint8Array> {
    // Try pure JavaScript decoder first for uncompressed TIFFs
    try {
      const pureJSResult = await this.decodePureJS(data, width, height);
      if (pureJSResult) {
        return pureJSResult;
      }
    } catch (_error) {
      // Pure JS decoder failed, fall through to ImageDecoder silently
      // This is expected for compressed TIFFs
    }

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
      "TIFF decoding requires uncompressed TIFF or ImageDecoder API support",
    );
  }

  private readString(data: Uint8Array, offset: number): string {
    const endIndex = data.indexOf(0, offset);
    if (endIndex === -1 || endIndex <= offset) return "";
    return new TextDecoder().decode(data.slice(offset, endIndex));
  }

  /**
   * Pure JavaScript TIFF decoder for uncompressed, LZW, PackBits, and Deflate-compressed RGB/RGBA images
   * Returns null if the TIFF uses unsupported features
   */
  private async decodePureJS(
    data: Uint8Array,
    width: number,
    height: number,
  ): Promise<Uint8Array | null> {
    // Validate minimum TIFF header size
    if (data.length < 8) {
      return null;
    }

    // Determine byte order
    const isLittleEndian = data[0] === 0x49;

    // Read IFD offset
    const ifdOffset = this.readUint32(data, 4, isLittleEndian);

    // Check compression
    const compression = this.getIFDValue(
      data,
      ifdOffset,
      0x0103,
      isLittleEndian,
    );
    if (
      compression !== 1 && compression !== 5 && compression !== 8 &&
      compression !== 32773
    ) {
      // Support: 1 = uncompressed, 5 = LZW, 8 = Deflate, 32773 = PackBits
      return null;
    }

    // Check photometric interpretation
    const photometric = this.getIFDValue(
      data,
      ifdOffset,
      0x0106,
      isLittleEndian,
    );
    if (photometric !== 0 && photometric !== 1 && photometric !== 2) {
      // Support: 0 = WhiteIsZero, 1 = BlackIsZero, 2 = RGB
      return null;
    }

    // Get samples per pixel
    const samplesPerPixel = this.getIFDValue(
      data,
      ifdOffset,
      0x0115,
      isLittleEndian,
    );

    // For grayscale (photometric 0 or 1), expect 1 sample per pixel
    // For RGB, expect 3 or 4 samples per pixel
    if (!samplesPerPixel) {
      return null;
    }

    if ((photometric === 0 || photometric === 1) && samplesPerPixel !== 1) {
      // Grayscale requires 1 sample per pixel
      return null;
    }

    if (photometric === 2 && samplesPerPixel !== 3 && samplesPerPixel !== 4) {
      // RGB requires 3 or 4 samples per pixel
      return null;
    }

    // Get strip offset
    const stripOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x0111,
      isLittleEndian,
    );
    if (!stripOffset || stripOffset >= data.length) {
      return null;
    }

    // Get strip byte counts to know how much compressed data to read
    const stripByteCount = this.getIFDValue(
      data,
      ifdOffset,
      0x0117,
      isLittleEndian,
    );
    if (!stripByteCount) {
      return null;
    }

    // Read and decompress pixel data
    let pixelData: Uint8Array;

    if (compression === 5) {
      // LZW compressed
      const compressedData = data.slice(
        stripOffset,
        stripOffset + stripByteCount,
      );
      const decoder = new TIFFLZWDecoder(compressedData);
      pixelData = decoder.decompress();
    } else if (compression === 32773) {
      // PackBits compressed
      const compressedData = data.slice(
        stripOffset,
        stripOffset + stripByteCount,
      );
      pixelData = packBitsDecompress(compressedData);
    } else if (compression === 8) {
      // Deflate compressed
      const compressedData = data.slice(
        stripOffset,
        stripOffset + stripByteCount,
      );
      pixelData = await deflateDecompress(compressedData);
    } else {
      // Uncompressed
      pixelData = data.slice(stripOffset, stripOffset + stripByteCount);
    }

    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

    // Convert to RGBA
    const rgba = new Uint8Array(width * height * 4);
    let srcPos = 0;

    if (photometric === 0 || photometric === 1) {
      // Grayscale image
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dstIdx = (y * width + x) * 4;

          if (srcPos >= pixelData.length) {
            return null; // Not enough data
          }

          let gray = pixelData[srcPos++];

          // WhiteIsZero (0) means 0=white, 255=black, so invert
          if (photometric === 0) {
            gray = 255 - gray;
          }

          rgba[dstIdx] = gray; // R
          rgba[dstIdx + 1] = gray; // G
          rgba[dstIdx + 2] = gray; // B
          rgba[dstIdx + 3] = 255; // A (opaque)
        }
      }
    } else {
      // RGB/RGBA image
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dstIdx = (y * width + x) * 4;

          if (srcPos + samplesPerPixel > pixelData.length) {
            return null; // Not enough data
          }

          // TIFF stores RGB(A) in order
          rgba[dstIdx] = pixelData[srcPos++]; // R
          rgba[dstIdx + 1] = pixelData[srcPos++]; // G
          rgba[dstIdx + 2] = pixelData[srcPos++]; // B
          rgba[dstIdx + 3] = samplesPerPixel === 4 ? pixelData[srcPos++] : 255; // A
        }
      }
    }

    return rgba;
  }

  /**
   * Pure JavaScript TIFF decoder for a specific IFD
   * Returns null if the TIFF uses unsupported features
   */
  private async decodePureJSFromIFD(
    data: Uint8Array,
    ifdOffset: number,
    width: number,
    height: number,
    isLittleEndian: boolean,
  ): Promise<Uint8Array | null> {
    // Check compression
    const compression = this.getIFDValue(
      data,
      ifdOffset,
      0x0103,
      isLittleEndian,
    );
    if (
      compression !== 1 && compression !== 5 && compression !== 8 &&
      compression !== 32773
    ) {
      // Support: 1 = uncompressed, 5 = LZW, 8 = Deflate, 32773 = PackBits
      return null;
    }

    // Check photometric interpretation
    const photometric = this.getIFDValue(
      data,
      ifdOffset,
      0x0106,
      isLittleEndian,
    );
    if (photometric !== 0 && photometric !== 1 && photometric !== 2) {
      // Support: 0 = WhiteIsZero, 1 = BlackIsZero, 2 = RGB
      return null;
    }

    // Get samples per pixel
    const samplesPerPixel = this.getIFDValue(
      data,
      ifdOffset,
      0x0115,
      isLittleEndian,
    );

    // For grayscale (photometric 0 or 1), expect 1 sample per pixel
    // For RGB, expect 3 or 4 samples per pixel
    if (!samplesPerPixel) {
      return null;
    }

    if ((photometric === 0 || photometric === 1) && samplesPerPixel !== 1) {
      // Grayscale requires 1 sample per pixel
      return null;
    }

    if (photometric === 2 && samplesPerPixel !== 3 && samplesPerPixel !== 4) {
      // RGB requires 3 or 4 samples per pixel
      return null;
    }

    // Get strip offset
    const stripOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x0111,
      isLittleEndian,
    );
    if (!stripOffset || stripOffset >= data.length) {
      return null;
    }

    // Get strip byte counts to know how much compressed data to read
    const stripByteCount = this.getIFDValue(
      data,
      ifdOffset,
      0x0117,
      isLittleEndian,
    );
    if (!stripByteCount) {
      return null;
    }

    // Read and decompress pixel data
    let pixelData: Uint8Array;

    if (compression === 5) {
      // LZW compressed
      const compressedData = data.slice(
        stripOffset,
        stripOffset + stripByteCount,
      );
      const decoder = new TIFFLZWDecoder(compressedData);
      pixelData = decoder.decompress();
    } else if (compression === 32773) {
      // PackBits compressed
      const compressedData = data.slice(
        stripOffset,
        stripOffset + stripByteCount,
      );
      pixelData = packBitsDecompress(compressedData);
    } else if (compression === 8) {
      // Deflate compressed
      const compressedData = data.slice(
        stripOffset,
        stripOffset + stripByteCount,
      );
      pixelData = await deflateDecompress(compressedData);
    } else {
      // Uncompressed
      pixelData = data.slice(stripOffset, stripOffset + stripByteCount);
    }

    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

    // Convert to RGBA
    const rgba = new Uint8Array(width * height * 4);
    let srcPos = 0;

    if (photometric === 0 || photometric === 1) {
      // Grayscale image
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dstIdx = (y * width + x) * 4;

          if (srcPos >= pixelData.length) {
            return null; // Not enough data
          }

          let gray = pixelData[srcPos++];

          // WhiteIsZero (0) means 0=white, 255=black, so invert
          if (photometric === 0) {
            gray = 255 - gray;
          }

          rgba[dstIdx] = gray; // R
          rgba[dstIdx + 1] = gray; // G
          rgba[dstIdx + 2] = gray; // B
          rgba[dstIdx + 3] = 255; // A (opaque)
        }
      }
    } else {
      // RGB/RGBA image
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dstIdx = (y * width + x) * 4;

          if (srcPos + samplesPerPixel > pixelData.length) {
            return null; // Not enough data
          }

          // TIFF stores RGB(A) in order
          rgba[dstIdx] = pixelData[srcPos++]; // R
          rgba[dstIdx + 1] = pixelData[srcPos++]; // G
          rgba[dstIdx + 2] = pixelData[srcPos++]; // B
          rgba[dstIdx + 3] = samplesPerPixel === 4 ? pixelData[srcPos++] : 255; // A
        }
      }
    }

    return rgba;
  }

  /**
   * Get list of metadata fields supported by TIFF format
   * TIFF supports extensive EXIF metadata including GPS and InteropIFD
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "creationDate",
      "description",
      "author",
      "copyright",
      "cameraMake",
      "cameraModel",
      "orientation",
      "software",
      "iso",
      "exposureTime",
      "fNumber",
      "focalLength",
      "flash",
      "whiteBalance",
      "lensMake",
      "lensModel",
      "userComment",
      "latitude",
      "longitude",
      "dpiX",
      "dpiY",
      "physicalWidth",
      "physicalHeight",
    ];
  }

  /**
   * Extract metadata from TIFF data without fully decoding the pixel data
   * This quickly parses IFD entries to extract metadata
   * @param data Raw TIFF data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) {
      return Promise.resolve(undefined);
    }

    // Determine byte order
    const isLittleEndian = data[0] === 0x49 && data[1] === 0x49;
    if (
      !isLittleEndian && !(data[0] === 0x4d && data[1] === 0x4d)
    ) {
      return Promise.resolve(undefined);
    }

    // Read IFD offset
    const ifdOffset = this.readUint32(data, 4, isLittleEndian);
    if (ifdOffset >= data.length) {
      return Promise.resolve(undefined);
    }

    // Get dimensions for DPI calculation
    const width = this.getIFDValue(data, ifdOffset, 0x0100, isLittleEndian);
    const height = this.getIFDValue(data, ifdOffset, 0x0101, isLittleEndian);

    if (!width || !height) {
      return Promise.resolve(undefined);
    }

    // Extract metadata from TIFF tags
    const metadata: ImageMetadata = {
      format: "tiff",
      frameCount: 1,
      bitDepth: 8,
    };

    // Get compression type
    const compression = this.getIFDValue(
      data,
      ifdOffset,
      0x0103,
      isLittleEndian,
    );
    if (compression === 1) {
      metadata.compression = "none";
    } else if (compression === 5) {
      metadata.compression = "lzw";
    } else if (compression === 7 || compression === 6) {
      metadata.compression = "jpeg";
    } else if (compression === 8) {
      metadata.compression = "deflate";
    } else if (compression === 32773) {
      metadata.compression = "packbits";
    } else if (compression) {
      metadata.compression = `unknown-${compression}`;
    }

    // Get bits per sample
    const bitsPerSample = this.getIFDValue(
      data,
      ifdOffset,
      0x0102,
      isLittleEndian,
    );
    if (bitsPerSample) {
      metadata.bitDepth = bitsPerSample;
    }

    // Get photometric interpretation for color type
    const photometric = this.getIFDValue(
      data,
      ifdOffset,
      0x0106,
      isLittleEndian,
    );
    const samplesPerPixel = this.getIFDValue(
      data,
      ifdOffset,
      0x0115,
      isLittleEndian,
    );

    if (photometric === 0 || photometric === 1) {
      metadata.colorType = "grayscale";
    } else if (photometric === 2) {
      if (samplesPerPixel === 3) {
        metadata.colorType = "rgb";
      } else if (samplesPerPixel === 4) {
        metadata.colorType = "rgba";
      }
    } else if (photometric === 3) {
      metadata.colorType = "indexed";
    }

    // Count IFDs (pages/frames) by following the chain
    let currentIfdOffset = ifdOffset;
    let frameCount = 0;
    while (
      currentIfdOffset > 0 && currentIfdOffset < data.length &&
      frameCount < 1000
    ) {
      frameCount++;
      // Read number of entries in this IFD
      const numEntries = this.readUint16(
        data,
        currentIfdOffset,
        isLittleEndian,
      );
      // Next IFD offset is after all entries (2 + numEntries * 12 bytes)
      const nextIfdOffsetPos = currentIfdOffset + 2 + (numEntries * 12);
      if (nextIfdOffsetPos + 4 > data.length) break;
      currentIfdOffset = this.readUint32(
        data,
        nextIfdOffsetPos,
        isLittleEndian,
      );
    }
    metadata.frameCount = frameCount;

    // XResolution (0x011a) and YResolution (0x011b) for DPI
    const xResOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x011a,
      isLittleEndian,
    );
    const yResOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x011b,
      isLittleEndian,
    );

    if (xResOffset && xResOffset < data.length - 8) {
      const numerator = this.readUint32(data, xResOffset, isLittleEndian);
      const denominator = this.readUint32(
        data,
        xResOffset + 4,
        isLittleEndian,
      );
      if (denominator > 0) {
        metadata.dpiX = Math.round(numerator / denominator);
      }
    }

    if (yResOffset && yResOffset < data.length - 8) {
      const numerator = this.readUint32(data, yResOffset, isLittleEndian);
      const denominator = this.readUint32(
        data,
        yResOffset + 4,
        isLittleEndian,
      );
      if (denominator > 0) {
        metadata.dpiY = Math.round(numerator / denominator);
      }
    }

    // Calculate physical dimensions if DPI is available
    if (metadata.dpiX && metadata.dpiY) {
      metadata.physicalWidth = width / metadata.dpiX;
      metadata.physicalHeight = height / metadata.dpiY;
    }

    // ImageDescription (0x010e)
    const descOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x010e,
      isLittleEndian,
    );
    if (descOffset && descOffset < data.length) {
      metadata.description = this.readString(data, descOffset);
    }

    // Artist (0x013b)
    const artistOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x013b,
      isLittleEndian,
    );
    if (artistOffset && artistOffset < data.length) {
      metadata.author = this.readString(data, artistOffset);
    }

    // Copyright (0x8298)
    const copyrightOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x8298,
      isLittleEndian,
    );
    if (copyrightOffset && copyrightOffset < data.length) {
      metadata.copyright = this.readString(data, copyrightOffset);
    }

    // DateTime (0x0132)
    const dateTimeOffset = this.getIFDValue(
      data,
      ifdOffset,
      0x0132,
      isLittleEndian,
    );
    if (dateTimeOffset && dateTimeOffset < data.length) {
      const dateStr = this.readString(data, dateTimeOffset);
      const match = dateStr.match(
        /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      );
      if (match) {
        metadata.creationDate = new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5]),
          parseInt(match[6]),
        );
      }
    }

    return Promise.resolve(
      Object.keys(metadata).length > 0 ? metadata : undefined,
    );
  }
}
