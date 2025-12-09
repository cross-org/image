import type { ImageData, ImageFormat } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * PPM format handler
 * Implements the Netpbm PPM (Portable PixMap) format.
 * This is a simple uncompressed RGB format supported by many image tools.
 *
 * Format structure:
 * - P3 (ASCII format):
 *   P3
 *   <width> <height>
 *   <maxval>
 *   R G B R G B ... (space-separated decimal values)
 *
 * - P6 (Binary format):
 *   P6
 *   <width> <height>
 *   <maxval>
 *   RGB RGB RGB ... (binary byte data)
 */
export class PPMFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "ppm";
  /** MIME type for PPM images */
  readonly mimeType = "image/x-portable-pixmap";

  /**
   * Check if the given data is a PPM image
   * @param data Raw image data to check
   * @returns true if data has PPM signature (P3 or P6)
   */
  canDecode(data: Uint8Array): boolean {
    // Check if data has at least magic bytes
    if (data.length < 3) {
      return false;
    }

    // Check for P3 or P6 followed by whitespace
    return data[0] === 0x50 && // P
      (data[1] === 0x33 || data[1] === 0x36) && // 3 or 6
      (data[2] === 0x0a || data[2] === 0x0d || data[2] === 0x20 ||
        data[2] === 0x09); // \n, \r, space, or tab
  }

  /**
   * Decode PPM image data to RGBA
   * Supports both P3 (ASCII) and P6 (binary) formats
   * @param data Raw PPM image data
   * @returns Decoded image data with RGBA pixels
   */
  decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid PPM signature");
    }

    const isBinary = data[1] === 0x36; // P6

    // Parse header
    let offset = 0;
    let width = 0;
    let height = 0;
    let maxval = 0;
    let headerValues = 0; // Track how many values we've parsed (need 3: width, height, maxval)

    // Skip magic number and whitespace
    offset = 2;
    while (offset < data.length && this.isWhitespace(data[offset])) {
      offset++;
    }

    // Parse header values (width, height, maxval)
    while (headerValues < 3 && offset < data.length) {
      // Skip comments (lines starting with #)
      if (data[offset] === 0x23) { // #
        // Skip until newline
        while (offset < data.length && data[offset] !== 0x0a) {
          offset++;
        }
        if (offset < data.length) offset++; // Skip the newline
        continue;
      }

      // Skip whitespace
      while (offset < data.length && this.isWhitespace(data[offset])) {
        offset++;
      }

      // Read number
      let numStr = "";
      while (
        offset < data.length &&
        !this.isWhitespace(data[offset]) &&
        data[offset] !== 0x23
      ) {
        numStr += String.fromCharCode(data[offset]);
        offset++;
      }

      if (numStr) {
        const num = parseInt(numStr, 10);
        if (isNaN(num) || num <= 0) {
          throw new Error(`Invalid PPM header value: ${numStr}`);
        }

        if (headerValues === 0) {
          width = num;
        } else if (headerValues === 1) {
          height = num;
        } else if (headerValues === 2) {
          maxval = num;
        }
        headerValues++;
      }
    }

    if (headerValues < 3) {
      throw new Error("Incomplete PPM header");
    }

    // Skip single whitespace character after maxval (required by spec)
    if (offset < data.length && this.isWhitespace(data[offset])) {
      offset++;
    }

    // Validate dimensions
    validateImageDimensions(width, height);

    // Validate maxval
    if (maxval > 255) {
      throw new Error(
        `Unsupported PPM maxval: ${maxval}. Only maxval <= 255 is supported.`,
      );
    }

    const pixelCount = width * height;
    const rgba = new Uint8Array(pixelCount * 4);

    if (isBinary) {
      // P6: Binary format
      const expectedDataLength = pixelCount * 3;
      const actualDataLength = data.length - offset;

      if (actualDataLength < expectedDataLength) {
        throw new Error(
          `Invalid PPM data length: expected ${expectedDataLength}, got ${actualDataLength}`,
        );
      }

      // Read RGB data and convert to RGBA
      for (let i = 0; i < pixelCount; i++) {
        const srcIndex = offset + i * 3;
        const dstIndex = i * 4;

        rgba[dstIndex] = data[srcIndex]; // R
        rgba[dstIndex + 1] = data[srcIndex + 1]; // G
        rgba[dstIndex + 2] = data[srcIndex + 2]; // B
        rgba[dstIndex + 3] = 255; // A (fully opaque)
      }
    } else {
      // P3: ASCII format
      let pixelIndex = 0;

      while (pixelIndex < pixelCount * 3 && offset < data.length) {
        // Skip whitespace and comments
        while (offset < data.length) {
          if (data[offset] === 0x23) { // #
            // Skip comment
            while (offset < data.length && data[offset] !== 0x0a) {
              offset++;
            }
            if (offset < data.length) offset++;
          } else if (this.isWhitespace(data[offset])) {
            offset++;
          } else {
            break;
          }
        }

        // Read number
        let numStr = "";
        while (
          offset < data.length &&
          !this.isWhitespace(data[offset]) &&
          data[offset] !== 0x23
        ) {
          numStr += String.fromCharCode(data[offset]);
          offset++;
        }

        if (numStr) {
          const value = parseInt(numStr, 10);
          if (isNaN(value) || value < 0 || value > maxval) {
            throw new Error(`Invalid PPM pixel value: ${numStr}`);
          }

          // Scale to 0-255 if needed
          const scaledValue = maxval === 255 ? value : Math.round(
            (value * 255) / maxval,
          );

          const component = pixelIndex % 3;
          const rgbaIndex = Math.floor(pixelIndex / 3) * 4;

          if (component === 0) {
            rgba[rgbaIndex] = scaledValue; // R
          } else if (component === 1) {
            rgba[rgbaIndex + 1] = scaledValue; // G
          } else {
            rgba[rgbaIndex + 2] = scaledValue; // B
            rgba[rgbaIndex + 3] = 255; // A
          }

          pixelIndex++;
        }
      }

      if (pixelIndex < pixelCount * 3) {
        throw new Error(
          `Incomplete PPM pixel data: expected ${
            pixelCount * 3
          } values, got ${pixelIndex}`,
        );
      }
    }

    return Promise.resolve({ width, height, data: rgba });
  }

  /**
   * Encode RGBA image data to PPM format (P6 binary)
   * Note: Alpha channel is ignored as PPM doesn't support transparency
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

    // Create output buffer (header + RGB data)
    const pixelCount = width * height;
    const output = new Uint8Array(headerBytes.length + pixelCount * 3);

    // Write header
    output.set(headerBytes, 0);

    // Write RGB pixel data (discard alpha channel)
    let outputOffset = headerBytes.length;
    for (let i = 0; i < pixelCount; i++) {
      const srcIndex = i * 4;
      output[outputOffset++] = data[srcIndex]; // R
      output[outputOffset++] = data[srcIndex + 1]; // G
      output[outputOffset++] = data[srcIndex + 2]; // B
    }

    return Promise.resolve(output);
  }

  /**
   * Check if a byte is whitespace (space, tab, CR, LF)
   */
  private isWhitespace(byte: number): boolean {
    return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
  }
}
