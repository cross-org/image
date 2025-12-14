import type {
  ImageData,
  ImageDecoderOptions,
  ImageFormat,
  ImageMetadata,
} from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";
import {
  readInt32LE,
  readUint16LE,
  readUint32LE,
  writeInt32LE,
  writeUint16LE,
  writeUint32LE,
} from "../utils/byte_utils.ts";

// Constants for unit conversions
const INCHES_PER_METER = 39.3701;

/**
 * BMP format handler
 * Implements a pure JavaScript BMP decoder and encoder
 */
export class BMPFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "bmp";
  /** MIME type for BMP images */
  readonly mimeType = "image/bmp";

  /**
   * Check if the given data is a BMP image
   * @param data Raw image data to check
   * @returns true if data has BMP signature
   */
  canDecode(data: Uint8Array): boolean {
    // BMP signature: 'BM' (0x42 0x4D)
    return data.length >= 2 &&
      data[0] === 0x42 && data[1] === 0x4d;
  }

  /**
   * Decode BMP image data to RGBA
   * @param data Raw BMP image data
   * @returns Decoded image data with RGBA pixels
   */
  decode(data: Uint8Array, _options?: ImageDecoderOptions): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid BMP signature");
    }

    // Read BMP file header (14 bytes)
    const _fileSize = readUint32LE(data, 2);
    const dataOffset = readUint32LE(data, 10);

    // Read DIB header (at least 40 bytes for BITMAPINFOHEADER)
    const dibHeaderSize = readUint32LE(data, 14);
    let width: number;
    let height: number;
    let bitDepth: number;
    let compression: number;
    const metadata: ImageMetadata = {};

    if (dibHeaderSize >= 40) {
      // BITMAPINFOHEADER or later
      width = readInt32LE(data, 18);
      height = readInt32LE(data, 22);
      bitDepth = readUint16LE(data, 28);
      compression = readUint32LE(data, 30);

      // Read DPI information (pixels per meter)
      const xPixelsPerMeter = readInt32LE(data, 38);
      const yPixelsPerMeter = readInt32LE(data, 42);

      if (xPixelsPerMeter > 0 && yPixelsPerMeter > 0) {
        // Convert pixels per meter to DPI
        metadata.dpiX = Math.round(xPixelsPerMeter / INCHES_PER_METER);
        metadata.dpiY = Math.round(yPixelsPerMeter / INCHES_PER_METER);
        metadata.physicalWidth = Math.abs(width) / metadata.dpiX;
        metadata.physicalHeight = Math.abs(height) / metadata.dpiY;
      }
    } else {
      throw new Error("Unsupported BMP header format");
    }

    // Handle negative height (top-down bitmap)
    const isTopDown = height < 0;
    const absHeight = Math.abs(height);

    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, absHeight);

    // Only support uncompressed BMPs for now
    if (compression !== 0) {
      throw new Error(
        `Compressed BMP not supported (compression type: ${compression})`,
      );
    }

    // Only support 24-bit and 32-bit BMPs
    if (bitDepth !== 24 && bitDepth !== 32) {
      throw new Error(
        `Unsupported bit depth: ${bitDepth}. Only 24 and 32-bit BMPs are supported.`,
      );
    }

    // Calculate row size (must be multiple of 4 bytes)
    const bytesPerPixel = bitDepth / 8;
    const rowSize = Math.floor((bitDepth * width + 31) / 32) * 4;

    // Read pixel data
    const rgba = new Uint8Array(width * absHeight * 4);

    for (let y = 0; y < absHeight; y++) {
      const rowIndex = isTopDown ? y : (absHeight - 1 - y); // BMP stores bottom-to-top by default
      const rowOffset = dataOffset + y * rowSize;

      for (let x = 0; x < width; x++) {
        const pixelOffset = rowOffset + x * bytesPerPixel;
        const outIndex = (rowIndex * width + x) * 4;

        // BMP stores pixels as BGR(A)
        rgba[outIndex] = data[pixelOffset + 2]; // R
        rgba[outIndex + 1] = data[pixelOffset + 1]; // G
        rgba[outIndex + 2] = data[pixelOffset]; // B
        rgba[outIndex + 3] = bitDepth === 32 ? data[pixelOffset + 3] : 255; // A
      }
    }

    return Promise.resolve({
      width,
      height: absHeight,
      data: rgba,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  /**
   * Encode RGBA image data to BMP format
   * @param imageData Image data to encode
   * @returns Encoded BMP image bytes
   */
  encode(
    imageData: ImageData,
    _options?: unknown,
  ): Promise<Uint8Array> {
    const { width, height, data, metadata } = imageData;

    // Calculate sizes
    const bytesPerPixel = 4; // We'll encode as 32-bit RGBA
    const rowSize = Math.floor((32 * width + 31) / 32) * 4;
    const pixelDataSize = rowSize * height;
    const fileSize = 14 + 40 + pixelDataSize; // File header + DIB header + pixel data

    const result = new Uint8Array(fileSize);

    // Calculate DPI values
    let xPixelsPerMeter = 2835; // Default 72 DPI
    let yPixelsPerMeter = 2835;

    if (metadata?.dpiX && metadata.dpiX > 0) {
      xPixelsPerMeter = Math.round(metadata.dpiX * INCHES_PER_METER);
    }
    if (metadata?.dpiY && metadata.dpiY > 0) {
      yPixelsPerMeter = Math.round(metadata.dpiY * INCHES_PER_METER);
    }

    // BMP File Header (14 bytes)
    result[0] = 0x42; // 'B'
    result[1] = 0x4d; // 'M'
    writeUint32LE(result, 2, fileSize); // File size
    writeUint32LE(result, 6, 0); // Reserved
    writeUint32LE(result, 10, 54); // Offset to pixel data (14 + 40)

    // DIB Header (BITMAPINFOHEADER - 40 bytes)
    writeUint32LE(result, 14, 40); // DIB header size
    writeInt32LE(result, 18, width); // Width
    writeInt32LE(result, 22, height); // Height (positive = bottom-up)
    writeUint16LE(result, 26, 1); // Planes
    writeUint16LE(result, 28, 32); // Bits per pixel
    writeUint32LE(result, 30, 0); // Compression (0 = uncompressed)
    writeUint32LE(result, 34, pixelDataSize); // Image size
    writeInt32LE(result, 38, xPixelsPerMeter); // X pixels per meter
    writeInt32LE(result, 42, yPixelsPerMeter); // Y pixels per meter
    writeUint32LE(result, 46, 0); // Colors in palette
    writeUint32LE(result, 50, 0); // Important colors

    // Write pixel data (bottom-to-top, BGR(A) format)
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const srcIndex = (y * width + x) * 4;
        result[offset++] = data[srcIndex + 2]; // B
        result[offset++] = data[srcIndex + 1]; // G
        result[offset++] = data[srcIndex]; // R
        result[offset++] = data[srcIndex + 3]; // A
      }
      // Add padding to make row size multiple of 4
      const padding = rowSize - width * bytesPerPixel;
      for (let p = 0; p < padding; p++) {
        result[offset++] = 0;
      }
    }

    return Promise.resolve(result);
  }

  /**
   * Get the list of metadata fields supported by BMP format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "dpiX", // Pixels per meter in header
      "dpiY", // Pixels per meter in header
    ];
  }

  /**
   * Extract metadata from BMP data without fully decoding the pixel data
   * @param data Raw BMP data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) {
      return Promise.resolve(undefined);
    }

    const metadata: ImageMetadata = {
      format: "bmp",
      frameCount: 1,
      bitDepth: 24,
      colorType: "rgb",
    };

    // Read BMP header to determine version
    const headerSize = readUint32LE(data, 14);

    if (headerSize >= 40) {
      // BITMAPINFOHEADER or later
      const bitsPerPixel = readUint16LE(data, 28);
      metadata.bitDepth = bitsPerPixel;

      if (bitsPerPixel === 1 || bitsPerPixel === 8) {
        metadata.colorType = "indexed";
      } else if (bitsPerPixel === 24) {
        metadata.colorType = "rgb";
      } else if (bitsPerPixel === 32) {
        metadata.colorType = "rgba";
      }

      const compression = readUint32LE(data, 30);
      if (compression === 0) {
        metadata.compression = "none";
      } else if (compression === 1) {
        metadata.compression = "rle8";
      } else if (compression === 2) {
        metadata.compression = "rle4";
      } else if (compression === 3) {
        metadata.compression = "bitfields";
      } else {
        metadata.compression = `unknown-${compression}`;
      }

      // DPI information (pixels per meter)
      if (headerSize >= 40) {
        const xPelsPerMeter = readUint32LE(data, 38);
        const yPelsPerMeter = readUint32LE(data, 42);

        if (xPelsPerMeter > 0) {
          metadata.dpiX = Math.round(xPelsPerMeter * 0.0254);
        }
        if (yPelsPerMeter > 0) {
          metadata.dpiY = Math.round(yPelsPerMeter * 0.0254);
        }
      }
    } else {
      // BITMAPCOREHEADER
      metadata.compression = "none";
    }

    return Promise.resolve(
      Object.keys(metadata).length > 0 ? metadata : undefined,
    );
  }
}
