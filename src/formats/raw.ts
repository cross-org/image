import type { ImageData, ImageFormat } from "../types.ts";

/**
 * RAW format handler
 * Implements a simple uncompressed RGBA format with a minimal header
 *
 * Format structure:
 * - Magic bytes (4 bytes): "RGBA" (0x52 0x47 0x42 0x41)
 * - Width (4 bytes, big-endian)
 * - Height (4 bytes, big-endian)
 * - RGBA pixel data (width * height * 4 bytes)
 */
export class RAWFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "raw";
  /** MIME type for RAW images */
  readonly mimeType = "image/raw";

  private readonly MAGIC_BYTES = new Uint8Array([0x52, 0x47, 0x42, 0x41]); // "RGBA"
  private readonly HEADER_SIZE = 12; // 4 bytes magic + 4 bytes width + 4 bytes height

  /**
   * Check if the given data is a RAW image
   * @param data Raw image data to check
   * @returns true if data has RAW signature
   */
  canDecode(data: Uint8Array): boolean {
    // Check if data has at least header size and matches magic bytes
    if (data.length < this.HEADER_SIZE) {
      return false;
    }

    return data[0] === this.MAGIC_BYTES[0] &&
      data[1] === this.MAGIC_BYTES[1] &&
      data[2] === this.MAGIC_BYTES[2] &&
      data[3] === this.MAGIC_BYTES[3];
  }

  /**
   * Decode RAW image data to RGBA
   * @param data Raw RAW image data
   * @returns Decoded image data with RGBA pixels
   */
  decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid RAW signature");
    }

    // Read width and height from header (big-endian)
    const width = this.readUint32(data, 4);
    const height = this.readUint32(data, 8);

    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid RAW dimensions: ${width}x${height}`);
    }

    const expectedDataLength = width * height * 4;
    const actualDataLength = data.length - this.HEADER_SIZE;

    if (actualDataLength !== expectedDataLength) {
      throw new Error(
        `Invalid RAW data length: expected ${expectedDataLength}, got ${actualDataLength}`,
      );
    }

    // Extract pixel data
    const pixelData = new Uint8Array(expectedDataLength);
    pixelData.set(data.subarray(this.HEADER_SIZE));

    return Promise.resolve({ width, height, data: pixelData });
  }

  /**
   * Encode RGBA image data to RAW format
   * @param imageData Image data to encode
   * @returns Encoded RAW image bytes
   */
  encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    // Validate input
    if (data.length !== width * height * 4) {
      throw new Error(
        `Data length mismatch: expected ${
          width * height * 4
        }, got ${data.length}`,
      );
    }

    // Create output buffer with header + pixel data
    const output = new Uint8Array(this.HEADER_SIZE + data.length);

    // Write magic bytes
    output.set(this.MAGIC_BYTES, 0);

    // Write width and height (big-endian)
    this.writeUint32(output, 4, width);
    this.writeUint32(output, 8, height);

    // Write pixel data
    output.set(data, this.HEADER_SIZE);

    return Promise.resolve(output);
  }

  private readUint32(data: Uint8Array, offset: number): number {
    return (
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]
    );
  }

  private writeUint32(data: Uint8Array, offset: number, value: number): void {
    data[offset] = (value >>> 24) & 0xff;
    data[offset + 1] = (value >>> 16) & 0xff;
    data[offset + 2] = (value >>> 8) & 0xff;
    data[offset + 3] = value & 0xff;
  }
}
