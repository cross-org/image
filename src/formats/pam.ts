import type { ImageData, ImageFormat } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * PAM format handler
 * Implements the Netpbm PAM (Portable Arbitrary Map) format.
 * This is a standard uncompressed format supported by GIMP and other tools.
 *
 * Format structure:
 * - Header (text):
 *   P7
 *   WIDTH <width>
 *   HEIGHT <height>
 *   DEPTH 4
 *   MAXVAL 255
 *   TUPLTYPE RGB_ALPHA
 *   ENDHDR
 * - Data (binary):
 *   RGBA pixel data (width * height * 4 bytes)
 */
export class PAMFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "pam";
  /** MIME type for PAM images */
  readonly mimeType = "image/x-portable-arbitrary-map";

  /**
   * Check if the given data is a PAM image
   * @param data Raw image data to check
   * @returns true if data has PAM signature
   */
  canDecode(data: Uint8Array): boolean {
    // Check if data has at least magic bytes
    if (data.length < 3) {
      return false;
    }

    // Check for P7 followed by whitespace (usually newline)
    return data[0] === 0x50 && // P
      data[1] === 0x37 && // 7
      (data[2] === 0x0a || data[2] === 0x0d || data[2] === 0x20); // \n, \r, or space
  }

  /**
   * Decode PAM image data to RGBA
   * @param data Raw PAM image data
   * @returns Decoded image data with RGBA pixels
   */
  decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid PAM signature");
    }

    // Parse header
    let offset = 0;
    let width = 0;
    let height = 0;
    let depth = 0;
    let maxval = 0;
    let headerDone = false;

    const decoder = new TextDecoder();

    // Find end of header
    // We need to read line by line.
    // Since we have the full buffer, we can just scan for newlines.

    let lineStart = 0;
    while (!headerDone && offset < data.length) {
      // Find next newline
      let lineEnd = -1;
      for (let i = offset; i < data.length; i++) {
        if (data[i] === 0x0a) {
          lineEnd = i;
          break;
        }
      }

      if (lineEnd === -1) {
        throw new Error("Unexpected end of file in header");
      }

      const line = decoder.decode(data.subarray(lineStart, lineEnd)).trim();
      offset = lineEnd + 1; // Skip newline
      lineStart = offset;

      // Skip comments
      if (line.startsWith("#")) continue;
      if (line === "") continue;

      if (line === "P7") continue;
      if (line === "ENDHDR") {
        headerDone = true;
        break;
      }

      // Parse fields
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const key = parts[0];
        const value = parts[1];

        switch (key) {
          case "WIDTH":
            width = parseInt(value, 10);
            break;
          case "HEIGHT":
            height = parseInt(value, 10);
            break;
          case "DEPTH":
            depth = parseInt(value, 10);
            break;
          case "MAXVAL":
            maxval = parseInt(value, 10);
            break;
          case "TUPLTYPE":
            // Optional check
            break;
        }
      }
    }

    if (!headerDone) {
      throw new Error("Invalid PAM header: missing ENDHDR");
    }

    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid PAM dimensions: ${width}x${height}`);
    }

    // Validate dimensions for security
    validateImageDimensions(width, height);

    // We only support DEPTH 4 (RGBA) and MAXVAL 255 for now
    if (depth !== 4) {
      throw new Error(
        `Unsupported PAM depth: ${depth}. Only depth 4 (RGBA) is supported.`,
      );
    }
    if (maxval !== 255) {
      throw new Error(
        `Unsupported PAM maxval: ${maxval}. Only maxval 255 is supported.`,
      );
    }

    const expectedDataLength = width * height * 4;
    const actualDataLength = data.length - offset;

    if (actualDataLength < expectedDataLength) {
      throw new Error(
        `Invalid PAM data length: expected ${expectedDataLength}, got ${actualDataLength}`,
      );
    }

    // Extract pixel data
    const pixelData = new Uint8Array(expectedDataLength);
    pixelData.set(data.subarray(offset, offset + expectedDataLength));

    return Promise.resolve({ width, height, data: pixelData });
  }

  /**
   * Encode RGBA image data to PAM format
   * @param imageData Image data to encode
   * @returns Encoded PAM image bytes
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
    const header = `P7\n` +
      `WIDTH ${width}\n` +
      `HEIGHT ${height}\n` +
      `DEPTH 4\n` +
      `MAXVAL 255\n` +
      `TUPLTYPE RGB_ALPHA\n` +
      `ENDHDR\n`;

    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);

    // Create output buffer
    const output = new Uint8Array(headerBytes.length + data.length);

    // Write header
    output.set(headerBytes, 0);

    // Write pixel data
    output.set(data, headerBytes.length);

    return Promise.resolve(output);
  }
}
