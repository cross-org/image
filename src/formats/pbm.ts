import type { ImageData, ImageDecoderOptions, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * PBM format handler
 * Implements the Netpbm PBM (Portable BitMap) format.
 * Supports both P1 (ASCII) and P4 (binary) variants.
 *
 * In PBM, 0 = white and 1 = black (the opposite of most image formats).
 *
 * Format structure:
 * - P1 (ASCII format):
 *   P1
 *   <width> <height>
 *   0 1 0 1 ... (0=white, 1=black)
 *
 * - P4 (Binary format):
 *   P4
 *   <width> <height>
 *   <packed bits: 1 bit per pixel, MSB first, rows padded to byte boundary>
 */
export class PBMFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "pbm";
  /** MIME type for PBM images */
  readonly mimeType = "image/x-portable-bitmap";

  /**
   * Check if the given data is a PBM image
   * @param data Raw image data to check
   * @returns true if data has PBM signature (P1 or P4)
   */
  canDecode(data: Uint8Array): boolean {
    if (data.length < 3) return false;
    return (
      data[0] === 0x50 && // P
      (data[1] === 0x31 || data[1] === 0x34) && // 1 or 4
      (data[2] === 0x0a || data[2] === 0x0d || data[2] === 0x20 || data[2] === 0x09)
    );
  }

  /**
   * Decode PBM image data to RGBA
   * Supports both P1 (ASCII) and P4 (binary) formats
   * @param data Raw PBM image data
   * @returns Decoded image data with RGBA pixels (0=white 255,255,255, 1=black 0,0,0)
   */
  decode(data: Uint8Array, _options?: ImageDecoderOptions): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid PBM signature");
    }

    const isBinary = data[1] === 0x34; // P4

    let offset = 2;
    let width = 0;
    let height = 0;
    let headerValues = 0;

    while (offset < data.length && this.isWhitespace(data[offset])) offset++;

    while (headerValues < 2 && offset < data.length) {
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
          throw new Error(`Invalid PBM header value: ${numStr}`);
        }
        if (headerValues === 0) width = num;
        else if (headerValues === 1) height = num;
        headerValues++;
      }
    }

    if (headerValues < 2) {
      throw new Error("Incomplete PBM header");
    }

    if (offset < data.length && this.isWhitespace(data[offset])) offset++;

    validateImageDimensions(width, height);

    const pixelCount = width * height;
    const rgba = new Uint8Array(pixelCount * 4);

    if (isBinary) {
      // P4: packed bits, 1 bit per pixel, rows padded to byte boundary, MSB first
      const rowBytes = Math.ceil(width / 8);
      const expectedDataLength = rowBytes * height;
      if (data.length - offset < expectedDataLength) {
        throw new Error(
          `Invalid PBM data length: expected ${expectedDataLength}, got ${data.length - offset}`,
        );
      }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const byteIndex = offset + y * rowBytes + Math.floor(x / 8);
          const bitIndex = 7 - (x % 8);
          const bit = (data[byteIndex] >> bitIndex) & 1;
          const i = (y * width + x) * 4;
          const v = bit ? 0 : 255; // 1=black, 0=white
          rgba[i] = v;
          rgba[i + 1] = v;
          rgba[i + 2] = v;
          rgba[i + 3] = 255;
        }
      }
    } else {
      // P1: ASCII format, values are '0' or '1' separated by whitespace
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
        if (offset >= data.length) break;

        const ch = data[offset];
        if (ch !== 0x30 && ch !== 0x31) { // '0' or '1'
          throw new Error(`Invalid PBM pixel value at offset ${offset}`);
        }
        const bit = ch - 0x30;
        offset++;

        const v = bit ? 0 : 255;
        rgba[pixelIndex * 4] = v;
        rgba[pixelIndex * 4 + 1] = v;
        rgba[pixelIndex * 4 + 2] = v;
        rgba[pixelIndex * 4 + 3] = 255;
        pixelIndex++;
      }

      if (pixelIndex < pixelCount) {
        throw new Error(
          `Incomplete PBM pixel data: expected ${pixelCount} values, got ${pixelIndex}`,
        );
      }
    }

    return Promise.resolve({ width, height, data: rgba });
  }

  /**
   * Encode RGBA image data to PBM format (P4 binary)
   * Converts to monochrome using standard luminance threshold (128)
   * Note: Alpha channel is ignored during encoding
   * @param imageData Image data to encode
   * @returns Encoded PBM image bytes
   */
  encode(imageData: ImageData, _options?: unknown): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    if (data.length !== width * height * 4) {
      throw new Error(
        `Data length mismatch: expected ${width * height * 4}, got ${data.length}`,
      );
    }

    const header = `P4\n${width} ${height}\n`;
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);

    const rowBytes = Math.ceil(width / 8);
    const output = new Uint8Array(headerBytes.length + rowBytes * height);
    output.set(headerBytes, 0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = (y * width + x) * 4;
        const gray = Math.round(
          0.299 * data[si] + 0.587 * data[si + 1] + 0.114 * data[si + 2],
        );
        // dark pixels become 1 (black in PBM), bright pixels become 0 (white)
        const bit = gray < 128 ? 1 : 0;
        const byteIndex = headerBytes.length + y * rowBytes + Math.floor(x / 8);
        const bitPosition = 7 - (x % 8);
        output[byteIndex] |= bit << bitPosition;
      }
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
   * Get the list of metadata fields supported by PBM format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [];
  }

  /**
   * Extract metadata from PBM data without fully decoding the pixel data
   * @param data Raw PBM data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) return Promise.resolve(undefined);
    return Promise.resolve({
      format: "pbm",
      compression: "none",
      frameCount: 1,
      bitDepth: 1,
      colorType: "grayscale",
    });
  }
}
