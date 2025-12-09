import type { ImageData, ImageFormat } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * PPM format handler
 * Implements the Netpbm PPM (Portable Pixmap) format.
 * This is a standard uncompressed RGB format supported by many image tools.
 *
 * Format structure:
 * - Header (text):
 *   P6
 *   <width> <height>
 *   <maxval>
 * - Data (binary):
 *   RGB pixel data (width * height * 3 bytes)
 *
 * Note: This implementation supports P6 (binary) format only.
 * Maxval is always set to 255 for 8-bit color depth.
 */
export class PPMFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "ppm";
  /** MIME type for PPM images */
  readonly mimeType = "image/x-portable-pixmap";

  /**
   * Check if the given data is a PPM image
   * @param data Raw image data to check
   * @returns true if data has PPM signature
   */
  canDecode(data: Uint8Array): boolean {
    // Check if data has at least magic bytes
    if (data.length < 3) {
      return false;
    }

    // Check for P6 followed by whitespace (usually newline or space)
    return data[0] === 0x50 && // P
      data[1] === 0x36 && // 6
      (data[2] === 0x0a || data[2] === 0x0d || data[2] === 0x20); // \n, \r, or space
  }

  /**
   * Decode PPM image data to RGBA
   * @param data Raw PPM image data
   * @returns Decoded image data with RGBA pixels
   */
  decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid PPM signature");
    }

    let offset = 0;
    let width = 0;
    let height = 0;
    let maxval = 0;

    // Parse header
    // PPM header format:
    // P6
    // <width> <height>
    // <maxval>
    // Each line is separated by whitespace (space, tab, newline, etc.)

    // Skip magic number (P6)
    while (
      offset < data.length && data[offset] !== 0x0a && data[offset] !== 0x0d &&
      data[offset] !== 0x20
    ) {
      offset++;
    }

    // Read tokens from header
    const tokens: number[] = [];
    let currentToken = "";

    while (offset < data.length && tokens.length < 3) {
      const char = data[offset++];
      const charStr = String.fromCharCode(char);

      // Skip whitespace
      if (char === 0x0a || char === 0x0d || char === 0x20 || char === 0x09) {
        if (currentToken) {
          // Check for comments (lines starting with #)
          if (currentToken.startsWith("#")) {
            // Skip rest of comment line
            while (
              offset < data.length && data[offset] !== 0x0a &&
              data[offset] !== 0x0d
            ) {
              offset++;
            }
            currentToken = "";
            continue;
          }
          const num = parseInt(currentToken, 10);
          if (!isNaN(num)) {
            tokens.push(num);
          }
          currentToken = "";
        }
        continue;
      }

      currentToken += charStr;
    }

    // Handle last token if not yet processed
    if (currentToken && tokens.length < 3) {
      const num = parseInt(currentToken, 10);
      if (!isNaN(num)) {
        tokens.push(num);
      }
    }

    if (tokens.length !== 3) {
      throw new Error(
        `Invalid PPM header: expected 3 values, got ${tokens.length}`,
      );
    }

    width = tokens[0];
    height = tokens[1];
    maxval = tokens[2];

    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid PPM dimensions: ${width}x${height}`);
    }

    // Validate dimensions for security
    validateImageDimensions(width, height);

    // We only support maxval 255 for now
    if (maxval !== 255) {
      throw new Error(
        `Unsupported PPM maxval: ${maxval}. Only maxval 255 is supported.`,
      );
    }

    const expectedDataLength = width * height * 3;
    const actualDataLength = data.length - offset;

    if (actualDataLength < expectedDataLength) {
      throw new Error(
        `Invalid PPM data length: expected ${expectedDataLength}, got ${actualDataLength}`,
      );
    }

    // Convert RGB to RGBA
    const rgbaData = new Uint8Array(width * height * 4);
    let rgbOffset = offset;
    let rgbaOffset = 0;

    for (let i = 0; i < width * height; i++) {
      rgbaData[rgbaOffset++] = data[rgbOffset++]; // R
      rgbaData[rgbaOffset++] = data[rgbOffset++]; // G
      rgbaData[rgbaOffset++] = data[rgbOffset++]; // B
      rgbaData[rgbaOffset++] = 255; // A (opaque)
    }

    return Promise.resolve({ width, height, data: rgbaData });
  }

  /**
   * Encode RGBA image data to PPM format
   * @param imageData Image data to encode
   * @returns Encoded PPM image bytes
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

    // Create header
    const header = `P6\n${width} ${height}\n255\n`;
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);

    // Calculate RGB data size
    const rgbDataSize = width * height * 3;
    const output = new Uint8Array(headerBytes.length + rgbDataSize);

    // Write header
    output.set(headerBytes, 0);

    // Convert RGBA to RGB and write pixel data
    let rgbaOffset = 0;
    let rgbOffset = headerBytes.length;

    for (let i = 0; i < width * height; i++) {
      output[rgbOffset++] = data[rgbaOffset++]; // R
      output[rgbOffset++] = data[rgbaOffset++]; // G
      output[rgbOffset++] = data[rgbaOffset++]; // B
      rgbaOffset++; // Skip A
    }

    return Promise.resolve(output);
  }
}
