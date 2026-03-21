import type { ImageData, ImageDecoderOptions, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

// QOI magic bytes: "qoif"
const QOI_MAGIC_0 = 0x71; // q
const QOI_MAGIC_1 = 0x6f; // o
const QOI_MAGIC_2 = 0x69; // i
const QOI_MAGIC_3 = 0x66; // f

// QOI chunk tags (top 2 bits)
const QOI_OP_INDEX = 0x00; // 00xxxxxx
const QOI_OP_DIFF = 0x40; // 01xxxxxx
const QOI_OP_LUMA = 0x80; // 10xxxxxx
const QOI_OP_RUN = 0xc0; // 11xxxxxx

// QOI special 8-bit tags
const QOI_OP_RGB = 0xfe; // 11111110
const QOI_OP_RGBA = 0xff; // 11111111

/**
 * Compute the QOI running color array hash index for a pixel
 */
function qoiHash(r: number, g: number, b: number, a: number): number {
  return (r * 3 + g * 5 + b * 7 + a * 11) % 64;
}

/**
 * QOI format handler
 * Implements the QOI (Quite OK Image) format — a fast, lossless image format.
 * https://qoiformat.org/
 *
 * Format structure:
 * - Header (14 bytes):
 *   magic: "qoif" (4 bytes)
 *   width: uint32 big-endian
 *   height: uint32 big-endian
 *   channels: uint8 (3=RGB, 4=RGBA)
 *   colorspace: uint8 (0=sRGB with linear alpha, 1=all channels linear)
 * - Pixel data: sequence of QOI chunks (variable length)
 * - End marker: 8 bytes [0x00 × 7, 0x01]
 */
export class QOIFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "qoi";
  /** MIME type for QOI images */
  readonly mimeType = "image/qoi";

  /**
   * Check if the given data is a QOI image
   * @param data Raw image data to check
   * @returns true if data has QOI signature ("qoif")
   */
  canDecode(data: Uint8Array): boolean {
    return (
      data.length >= 14 &&
      data[0] === QOI_MAGIC_0 &&
      data[1] === QOI_MAGIC_1 &&
      data[2] === QOI_MAGIC_2 &&
      data[3] === QOI_MAGIC_3
    );
  }

  /**
   * Decode QOI image data to RGBA
   * @param data Raw QOI image data
   * @returns Decoded image data with RGBA pixels
   */
  decode(data: Uint8Array, _options?: ImageDecoderOptions): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid QOI signature");
    }

    // Parse header (big-endian)
    const width = ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
    const height = ((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0;
    const channels = data[12]; // 3=RGB, 4=RGBA
    // data[13] = colorspace (informational only, not used for decoding)

    validateImageDimensions(width, height);

    if (channels !== 3 && channels !== 4) {
      throw new Error(`Unsupported QOI channels: ${channels}`);
    }

    const pixelCount = width * height;
    const rgba = new Uint8Array(pixelCount * 4);

    // Running color array: 64 entries × 4 bytes (RGBA), initialized to zero
    const colorArray = new Uint8Array(64 * 4);

    let r = 0, g = 0, b = 0, a = 255;
    let offset = 14;
    let pixelIndex = 0;

    // Reserve 8 bytes for end marker at tail
    const dataEnd = data.length - 8;

    while (pixelIndex < pixelCount && offset < dataEnd) {
      const byte = data[offset++];

      if (byte === QOI_OP_RGB) {
        r = data[offset++];
        g = data[offset++];
        b = data[offset++];
        // a unchanged
        const hash = qoiHash(r, g, b, a);
        colorArray[hash * 4] = r;
        colorArray[hash * 4 + 1] = g;
        colorArray[hash * 4 + 2] = b;
        colorArray[hash * 4 + 3] = a;
      } else if (byte === QOI_OP_RGBA) {
        r = data[offset++];
        g = data[offset++];
        b = data[offset++];
        a = data[offset++];
        const hash = qoiHash(r, g, b, a);
        colorArray[hash * 4] = r;
        colorArray[hash * 4 + 1] = g;
        colorArray[hash * 4 + 2] = b;
        colorArray[hash * 4 + 3] = a;
      } else if ((byte & 0xc0) === QOI_OP_INDEX) {
        const index = byte & 0x3f;
        r = colorArray[index * 4];
        g = colorArray[index * 4 + 1];
        b = colorArray[index * 4 + 2];
        a = colorArray[index * 4 + 3];
        // INDEX does not update the color array
      } else if ((byte & 0xc0) === QOI_OP_DIFF) {
        r = (r + ((byte >> 4) & 0x03) - 2) & 0xff;
        g = (g + ((byte >> 2) & 0x03) - 2) & 0xff;
        b = (b + (byte & 0x03) - 2) & 0xff;
        const hash = qoiHash(r, g, b, a);
        colorArray[hash * 4] = r;
        colorArray[hash * 4 + 1] = g;
        colorArray[hash * 4 + 2] = b;
        colorArray[hash * 4 + 3] = a;
      } else if ((byte & 0xc0) === QOI_OP_LUMA) {
        const byte2 = data[offset++];
        const dg = (byte & 0x3f) - 32;
        r = (r + dg - 8 + ((byte2 >> 4) & 0x0f)) & 0xff;
        g = (g + dg) & 0xff;
        b = (b + dg - 8 + (byte2 & 0x0f)) & 0xff;
        const hash = qoiHash(r, g, b, a);
        colorArray[hash * 4] = r;
        colorArray[hash * 4 + 1] = g;
        colorArray[hash * 4 + 2] = b;
        colorArray[hash * 4 + 3] = a;
      } else {
        // QOI_OP_RUN: top 2 bits are 11, byte is 0xC0–0xFD
        // run count stored as bias-1: (byte & 0x3F) + 1 pixels
        const run = (byte & 0x3f) + 1;
        // RUN does not update the color array
        for (let i = 0; i < run && pixelIndex < pixelCount; i++, pixelIndex++) {
          const di = pixelIndex * 4;
          rgba[di] = r;
          rgba[di + 1] = g;
          rgba[di + 2] = b;
          rgba[di + 3] = a;
        }
        continue;
      }

      const di = pixelIndex * 4;
      rgba[di] = r;
      rgba[di + 1] = g;
      rgba[di + 2] = b;
      rgba[di + 3] = a;
      pixelIndex++;
    }

    return Promise.resolve({ width, height, data: rgba });
  }

  /**
   * Encode RGBA image data to QOI format
   * @param imageData Image data to encode
   * @returns Encoded QOI image bytes
   */
  encode(imageData: ImageData, _options?: unknown): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    if (data.length !== width * height * 4) {
      throw new Error(
        `Data length mismatch: expected ${width * height * 4}, got ${data.length}`,
      );
    }

    // Worst case: every pixel is QOI_OP_RGBA (5 bytes) + header (14) + end marker (8)
    const maxSize = 14 + width * height * 5 + 8;
    const out = new Uint8Array(maxSize);

    // Write header
    out[0] = QOI_MAGIC_0;
    out[1] = QOI_MAGIC_1;
    out[2] = QOI_MAGIC_2;
    out[3] = QOI_MAGIC_3;
    // Width (big-endian uint32)
    out[4] = (width >>> 24) & 0xff;
    out[5] = (width >>> 16) & 0xff;
    out[6] = (width >>> 8) & 0xff;
    out[7] = width & 0xff;
    // Height (big-endian uint32)
    out[8] = (height >>> 24) & 0xff;
    out[9] = (height >>> 16) & 0xff;
    out[10] = (height >>> 8) & 0xff;
    out[11] = height & 0xff;
    out[12] = 4; // channels: RGBA
    out[13] = 0; // colorspace: sRGB with linear alpha

    // Running color array: 64 entries × 4 bytes (RGBA), initialized to zero
    const colorArray = new Uint8Array(64 * 4);

    let offset = 14;
    let prevR = 0, prevG = 0, prevB = 0, prevA = 255;
    let run = 0;
    const pixelCount = width * height;

    const flushRun = () => {
      if (run > 0) {
        out[offset++] = QOI_OP_RUN | (run - 1);
        run = 0;
      }
    };

    for (let i = 0; i < pixelCount; i++) {
      const di = i * 4;
      const r = data[di];
      const g = data[di + 1];
      const b = data[di + 2];
      const a = data[di + 3];

      if (r === prevR && g === prevG && b === prevB && a === prevA) {
        run++;
        if (run === 62) {
          flushRun();
        }
        continue;
      }

      flushRun();

      const hash = qoiHash(r, g, b, a);

      if (
        colorArray[hash * 4] === r &&
        colorArray[hash * 4 + 1] === g &&
        colorArray[hash * 4 + 2] === b &&
        colorArray[hash * 4 + 3] === a
      ) {
        out[offset++] = QOI_OP_INDEX | hash;
      } else if (a === prevA) {
        const dr = (r - prevR) | 0;
        const dg = (g - prevG) | 0;
        const db = (b - prevB) | 0;

        if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) {
          out[offset++] = QOI_OP_DIFF | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2);
        } else {
          const dgR = dr - dg;
          const dgB = db - dg;
          if (dg >= -32 && dg <= 31 && dgR >= -8 && dgR <= 7 && dgB >= -8 && dgB <= 7) {
            out[offset++] = QOI_OP_LUMA | (dg + 32);
            out[offset++] = ((dgR + 8) << 4) | (dgB + 8);
          } else {
            out[offset++] = QOI_OP_RGB;
            out[offset++] = r;
            out[offset++] = g;
            out[offset++] = b;
          }
        }
      } else {
        out[offset++] = QOI_OP_RGBA;
        out[offset++] = r;
        out[offset++] = g;
        out[offset++] = b;
        out[offset++] = a;
      }

      colorArray[hash * 4] = r;
      colorArray[hash * 4 + 1] = g;
      colorArray[hash * 4 + 2] = b;
      colorArray[hash * 4 + 3] = a;

      prevR = r;
      prevG = g;
      prevB = b;
      prevA = a;
    }

    flushRun();

    // Write end marker
    out[offset++] = 0x00;
    out[offset++] = 0x00;
    out[offset++] = 0x00;
    out[offset++] = 0x00;
    out[offset++] = 0x00;
    out[offset++] = 0x00;
    out[offset++] = 0x00;
    out[offset++] = 0x01;

    return Promise.resolve(out.subarray(0, offset));
  }

  /**
   * Get the list of metadata fields supported by QOI format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [];
  }

  /**
   * Extract metadata from QOI data without fully decoding the pixel data
   * @param data Raw QOI data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) return Promise.resolve(undefined);

    const channels = data[12];

    return Promise.resolve({
      format: "qoi",
      compression: "none",
      frameCount: 1,
      bitDepth: 8,
      colorType: channels === 4 ? "rgba" : "rgb",
    });
  }
}
