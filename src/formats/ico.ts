import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";
import { PNGFormat } from "./png.ts";
import {
  readInt32LE,
  readUint16LE,
  readUint32LE,
  writeUint16LE,
  writeUint32LE,
} from "../utils/byte_utils.ts";

/**
 * ICO format handler
 * Implements a pure JavaScript ICO (Windows Icon) decoder and encoder
 *
 * ICO files can contain multiple images at different sizes.
 * This implementation decodes the largest image and encodes as a single-image ICO.
 */
export class ICOFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "ico";
  /** MIME type for ICO images */
  readonly mimeType = "image/x-icon";

  private pngFormat = new PNGFormat();

  /**
   * Check if the given data is an ICO image
   * @param data Raw image data to check
   * @returns true if data has ICO/CUR signature
   */
  canDecode(data: Uint8Array): boolean {
    // ICO signature: reserved=0, type=1 (icon) or 2 (cursor)
    return data.length >= 6 &&
      data[0] === 0 && data[1] === 0 && // Reserved
      (data[2] === 1 || data[2] === 2) && data[3] === 0 && // Type = 1 (icon) or 2 (cursor)
      data[4] !== 0; // Count > 0
  }

  /**
   * Decode ICO image data to RGBA
   * Selects and decodes the largest image in the ICO file
   * @param data Raw ICO image data
   * @returns Decoded image data with RGBA pixels
   */
  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid ICO signature");
    }

    // Read ICONDIR header
    const count = readUint16LE(data, 4);

    if (count === 0) {
      throw new Error("ICO file contains no images");
    }

    // Read all ICONDIRENTRY structures (16 bytes each, starting at offset 6)
    const entries: Array<{
      width: number;
      height: number;
      size: number;
      offset: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const entryOffset = 6 + i * 16;

      if (entryOffset + 16 > data.length) {
        throw new Error("Invalid ICO file: entry data out of bounds");
      }

      let width = data[entryOffset]; // 0 means 256
      let height = data[entryOffset + 1]; // 0 means 256

      // Width/height of 0 means 256 pixels
      if (width === 0) width = 256;
      if (height === 0) height = 256;

      const size = readUint32LE(data, entryOffset + 8);
      const offset = readUint32LE(data, entryOffset + 12);

      entries.push({ width, height, size, offset });
    }

    // Find the largest image (by area)
    let largestEntry = entries[0];
    let largestArea = largestEntry.width * largestEntry.height;

    for (const entry of entries) {
      const area = entry.width * entry.height;
      if (area > largestArea) {
        largestEntry = entry;
        largestArea = area;
      }
    }

    // Extract image data
    const imageStart = largestEntry.offset;
    const imageEnd = imageStart + largestEntry.size;

    if (imageEnd > data.length) {
      throw new Error("Invalid ICO file: image data out of bounds");
    }

    const imageData = data.slice(imageStart, imageEnd);

    // Check if it's a PNG (starts with PNG signature)
    if (
      imageData.length >= 8 &&
      imageData[0] === 0x89 &&
      imageData[1] === 0x50 &&
      imageData[2] === 0x4e &&
      imageData[3] === 0x47
    ) {
      // It's a PNG, decode it
      return await this.pngFormat.decode(imageData);
    }

    // Otherwise, it's a BMP without the file header (DIB format)
    return this.decodeDIB(imageData);
  }

  /**
   * Decode a DIB (Device Independent Bitmap) format
   * This is a BMP without the 14-byte file header
   */
  private decodeDIB(data: Uint8Array): Promise<ImageData> {
    // Read DIB header
    const dibHeaderSize = readUint32LE(data, 0);

    if (dibHeaderSize < 40) {
      throw new Error("Unsupported DIB header size");
    }

    const width = readInt32LE(data, 4);
    const height = readInt32LE(data, 8);
    const bitDepth = readUint16LE(data, 14);
    const compression = readUint32LE(data, 16);

    // Validate dimensions
    validateImageDimensions(width, Math.abs(height) / 2); // DIB height includes both XOR and AND mask data

    // ICO files store height as 2x actual height (for AND mask)
    const actualHeight = Math.abs(height) / 2;

    // Only support uncompressed DIBs
    if (compression !== 0) {
      throw new Error(
        `Compressed DIB not supported (compression: ${compression})`,
      );
    }

    // Support common bit depths
    if (bitDepth !== 24 && bitDepth !== 32) {
      throw new Error(`Unsupported bit depth: ${bitDepth}`);
    }

    // Calculate data offset (after header and optional color table)
    const dataOffset = dibHeaderSize;

    // Calculate row size (must be multiple of 4 bytes)
    const bytesPerPixel = bitDepth / 8;
    const rowSize = Math.floor((bitDepth * width + 31) / 32) * 4;

    // Read XOR mask (color data)
    const rgba = new Uint8Array(width * actualHeight * 4);

    for (let y = 0; y < actualHeight; y++) {
      // DIB data is stored bottom-to-top
      const rowIndex = actualHeight - 1 - y;
      const rowOffset = dataOffset + y * rowSize;

      for (let x = 0; x < width; x++) {
        const pixelOffset = rowOffset + x * bytesPerPixel;
        const outIndex = (rowIndex * width + x) * 4;

        // DIB stores pixels as BGR(A)
        rgba[outIndex] = data[pixelOffset + 2]; // R
        rgba[outIndex + 1] = data[pixelOffset + 1]; // G
        rgba[outIndex + 2] = data[pixelOffset]; // B
        rgba[outIndex + 3] = bitDepth === 32 ? data[pixelOffset + 3] : 255; // A
      }
    }

    // Read AND mask if present (for transparency in 24-bit images)
    if (bitDepth === 24) {
      const andMaskOffset = dataOffset + rowSize * actualHeight;
      const andMaskRowSize = Math.floor((width + 31) / 32) * 4;

      for (let y = 0; y < actualHeight; y++) {
        const rowIndex = actualHeight - 1 - y;
        const rowOffset = andMaskOffset + y * andMaskRowSize;

        for (let x = 0; x < width; x++) {
          const byteOffset = rowOffset + Math.floor(x / 8);
          const bitOffset = 7 - (x % 8);
          const isTransparent = (data[byteOffset] & (1 << bitOffset)) !== 0;

          if (isTransparent) {
            const outIndex = (rowIndex * width + x) * 4 + 3;
            rgba[outIndex] = 0; // Set alpha to 0 for transparent pixels
          }
        }
      }
    }

    return Promise.resolve({
      width,
      height: actualHeight,
      data: rgba,
    });
  }

  /**
   * Encode RGBA image data to ICO format
   * Creates an ICO file with a single PNG-encoded image
   * @param imageData Image data to encode
   * @returns Encoded ICO image bytes
   */
  async encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height } = imageData;

    // Encode the image as PNG
    const pngData = await this.pngFormat.encode(imageData);

    // Create ICO file structure
    // ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) + PNG data
    const icoSize = 6 + 16 + pngData.length;
    const result = new Uint8Array(icoSize);

    // Write ICONDIR header
    result[0] = 0; // Reserved
    result[1] = 0; // Reserved
    result[2] = 1; // Type = 1 (icon)
    result[3] = 0; // Type high byte
    result[4] = 1; // Count = 1
    result[5] = 0; // Count high byte

    // Write ICONDIRENTRY
    const entryOffset = 6;
    result[entryOffset] = width >= 256 ? 0 : width; // Width (0 = 256)
    result[entryOffset + 1] = height >= 256 ? 0 : height; // Height (0 = 256)
    result[entryOffset + 2] = 0; // Color count (0 = no palette)
    result[entryOffset + 3] = 0; // Reserved
    writeUint16LE(result, entryOffset + 4, 1); // Color planes
    writeUint16LE(result, entryOffset + 6, 32); // Bits per pixel
    writeUint32LE(result, entryOffset + 8, pngData.length); // Image size
    writeUint32LE(result, entryOffset + 12, 22); // Image offset (6 + 16)

    // Write PNG data
    result.set(pngData, 22);

    return result;
  }

  /**
   * Get the list of metadata fields supported by ICO format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "frameCount", // Number of images in ICO file
    ];
  }

  /**
   * Extract metadata from ICO data without fully decoding the pixel data
   * @param data Raw ICO data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) {
      return Promise.resolve(undefined);
    }

    // ICO files can contain multiple images, count them
    const count = readUint16LE(data, 4);

    const metadata: ImageMetadata = {
      format: "ico",
      compression: "none", // ICO typically contains uncompressed PNG or BMP
      frameCount: count,
      bitDepth: 32, // Most modern ICOs use 32-bit RGBA
      colorType: "rgba",
    };

    return Promise.resolve(metadata);
  }
}
