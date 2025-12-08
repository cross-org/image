import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

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
  decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid BMP signature");
    }

    // Read BMP file header (14 bytes)
    const _fileSize = this.readUint32LE(data, 2);
    const dataOffset = this.readUint32LE(data, 10);

    // Read DIB header (at least 40 bytes for BITMAPINFOHEADER)
    const dibHeaderSize = this.readUint32LE(data, 14);
    let width: number;
    let height: number;
    let bitDepth: number;
    let compression: number;
    const metadata: ImageMetadata = {};

    if (dibHeaderSize >= 40) {
      // BITMAPINFOHEADER or later
      width = this.readInt32LE(data, 18);
      height = this.readInt32LE(data, 22);
      bitDepth = this.readUint16LE(data, 28);
      compression = this.readUint32LE(data, 30);

      // Read DPI information (pixels per meter)
      const xPixelsPerMeter = this.readInt32LE(data, 38);
      const yPixelsPerMeter = this.readInt32LE(data, 42);

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
  encode(imageData: ImageData): Promise<Uint8Array> {
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
    this.writeUint32LE(result, 2, fileSize); // File size
    this.writeUint32LE(result, 6, 0); // Reserved
    this.writeUint32LE(result, 10, 54); // Offset to pixel data (14 + 40)

    // DIB Header (BITMAPINFOHEADER - 40 bytes)
    this.writeUint32LE(result, 14, 40); // DIB header size
    this.writeInt32LE(result, 18, width); // Width
    this.writeInt32LE(result, 22, height); // Height (positive = bottom-up)
    this.writeUint16LE(result, 26, 1); // Planes
    this.writeUint16LE(result, 28, 32); // Bits per pixel
    this.writeUint32LE(result, 30, 0); // Compression (0 = uncompressed)
    this.writeUint32LE(result, 34, pixelDataSize); // Image size
    this.writeInt32LE(result, 38, xPixelsPerMeter); // X pixels per meter
    this.writeInt32LE(result, 42, yPixelsPerMeter); // Y pixels per meter
    this.writeUint32LE(result, 46, 0); // Colors in palette
    this.writeUint32LE(result, 50, 0); // Important colors

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

  private readUint16LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
  }

  private readUint32LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8) |
      (data[offset + 2] << 16) | (data[offset + 3] << 24);
  }

  private readInt32LE(data: Uint8Array, offset: number): number {
    const value = this.readUint32LE(data, offset);
    return value > 0x7fffffff ? value - 0x100000000 : value;
  }

  private writeUint16LE(data: Uint8Array, offset: number, value: number): void {
    data[offset] = value & 0xff;
    data[offset + 1] = (value >>> 8) & 0xff;
  }

  private writeUint32LE(data: Uint8Array, offset: number, value: number): void {
    data[offset] = value & 0xff;
    data[offset + 1] = (value >>> 8) & 0xff;
    data[offset + 2] = (value >>> 16) & 0xff;
    data[offset + 3] = (value >>> 24) & 0xff;
  }

  private writeInt32LE(data: Uint8Array, offset: number, value: number): void {
    this.writeUint32LE(data, offset, value < 0 ? value + 0x100000000 : value);
  }
}
