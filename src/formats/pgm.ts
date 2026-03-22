import type { ImageData, ImageDecoderOptions, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * PGM format handler
 * Implements the Netpbm PGM (Portable GrayMap) format.
 * Supports both P2 (ASCII) and P5 (binary) variants.
 *
 * Format structure:
 * - P2 (ASCII format):
 *   P2
 *   <width> <height>
 *   <maxval>
 *   V V V ... (space-separated decimal grayscale values, 0=black, maxval=white)
 *
 * - P5 (Binary format):
 *   P5
 *   <width> <height>
 *   <maxval>
 *   <binary 8-bit grayscale data>
 */
export class PGMFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "pgm";
  /** MIME type for PGM images */
  readonly mimeType = "image/x-portable-graymap";

  /**
   * Check if the given data is a PGM image
   * @param data Raw image data to check
   * @returns true if data has PGM signature (P2 or P5)
   */
  canDecode(data: Uint8Array): boolean {
    if (data.length < 3) return false;
    return (
      data[0] === 0x50 && // P
      (data[1] === 0x32 || data[1] === 0x35) && // 2 or 5
      (data[2] === 0x0a || data[2] === 0x0d || data[2] === 0x20 || data[2] === 0x09)
    );
  }

  /**
   * Decode PGM image data to RGBA
   * Supports both P2 (ASCII) and P5 (binary) formats
   * @param data Raw PGM image data
   * @returns Decoded image data with RGBA pixels (grayscale expanded to RGB with A=255)
   */
  decode(data: Uint8Array, _options?: ImageDecoderOptions): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid PGM signature");
    }

    const isBinary = data[1] === 0x35; // P5

    let offset = 2;
    let width = 0;
    let height = 0;
    let maxval = 0;
    let headerValues = 0;

    while (offset < data.length && this.isWhitespace(data[offset])) offset++;

    while (headerValues < 3 && offset < data.length) {
      if (data[offset] === 0x23) { // #
        while (offset < data.length && data[offset] !== 0x0a) offset++;
        if (offset < data.length) offset++;
        continue;
      }

      while (offset < data.length && this.isWhitespace(data[offset])) offset++;

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
          throw new Error(`Invalid PGM header value: ${numStr}`);
        }
        if (headerValues === 0) width = num;
        else if (headerValues === 1) height = num;
        else if (headerValues === 2) maxval = num;
        headerValues++;
      }
    }

    if (headerValues < 3) {
      throw new Error("Incomplete PGM header");
    }

    if (offset < data.length && this.isWhitespace(data[offset])) offset++;

    validateImageDimensions(width, height);

    if (maxval > 255) {
      throw new Error(
        `Unsupported PGM maxval: ${maxval}. Only maxval <= 255 is supported.`,
      );
    }

    const pixelCount = width * height;
    const rgba = new Uint8Array(pixelCount * 4);

    if (isBinary) {
      // P5: binary format, 1 byte per pixel
      if (data.length - offset < pixelCount) {
        throw new Error(
          `Invalid PGM data length: expected ${pixelCount}, got ${data.length - offset}`,
        );
      }
      for (let i = 0; i < pixelCount; i++) {
        const v = maxval === 255 ? data[offset + i] : Math.round((data[offset + i] * 255) / maxval);
        rgba[i * 4] = v;
        rgba[i * 4 + 1] = v;
        rgba[i * 4 + 2] = v;
        rgba[i * 4 + 3] = 255;
      }
    } else {
      // P2: ASCII format
      let pixelIndex = 0;
      while (pixelIndex < pixelCount && offset < data.length) {
        while (offset < data.length) {
          if (data[offset] === 0x23) {
            while (offset < data.length && data[offset] !== 0x0a) offset++;
            if (offset < data.length) offset++;
          } else if (this.isWhitespace(data[offset])) {
            offset++;
          } else {
            break;
          }
        }

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
            throw new Error(`Invalid PGM pixel value: ${numStr}`);
          }
          const v = maxval === 255 ? value : Math.round((value * 255) / maxval);
          rgba[pixelIndex * 4] = v;
          rgba[pixelIndex * 4 + 1] = v;
          rgba[pixelIndex * 4 + 2] = v;
          rgba[pixelIndex * 4 + 3] = 255;
          pixelIndex++;
        }
      }

      if (pixelIndex < pixelCount) {
        throw new Error(
          `Incomplete PGM pixel data: expected ${pixelCount} values, got ${pixelIndex}`,
        );
      }
    }

    return Promise.resolve({ width, height, data: rgba });
  }

  /**
   * Encode RGBA image data to PGM format (P5 binary)
   * Converts to grayscale using standard luminance formula
   * @param imageData Image data to encode
   * @returns Encoded PGM image bytes
   */
  encode(imageData: ImageData, _options?: unknown): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    if (data.length !== width * height * 4) {
      throw new Error(
        `Data length mismatch: expected ${width * height * 4}, got ${data.length}`,
      );
    }

    const header = `P5\n${width} ${height}\n255\n`;
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);

    const pixelCount = width * height;
    const output = new Uint8Array(headerBytes.length + pixelCount);
    output.set(headerBytes, 0);

    let outputOffset = headerBytes.length;
    for (let i = 0; i < pixelCount; i++) {
      const si = i * 4;
      // Standard luminance-preserving grayscale conversion
      output[outputOffset++] = Math.round(
        0.299 * data[si] + 0.587 * data[si + 1] + 0.114 * data[si + 2],
      );
    }

    return Promise.resolve(output);
  }

  /**
   * Check if a byte is whitespace (space, tab, CR, LF)
   */
  private isWhitespace(byte: number): boolean {
    return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
  }

  /**
   * Get the list of metadata fields supported by PGM format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [];
  }

  /**
   * Extract metadata from PGM data without fully decoding the pixel data
   * @param data Raw PGM data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) return Promise.resolve(undefined);
    return Promise.resolve({
      format: "pgm",
      compression: "none",
      frameCount: 1,
      bitDepth: 8,
      colorType: "grayscale",
    });
  }
}
