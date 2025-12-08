import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * AVIF format handler
 * Uses native ImageDecoder API for decoding and OffscreenCanvas for encoding
 * AVIF is based on AV1 codec in HEIF container - too complex for pure-JS
 */
export class AVIFFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "avif";
  /** MIME type for AVIF images */
  readonly mimeType = "image/avif";

  /**
   * Check if the given data is an AVIF image
   * AVIF files are ISO BMFF with 'ftyp' box containing 'avif' or 'avis' brand
   * @param data Raw image data to check
   * @returns true if data has AVIF signature
   */
  canDecode(data: Uint8Array): boolean {
    // AVIF files start with ISO BMFF structure:
    // [box size (4 bytes)][box type "ftyp" (4 bytes)][major brand (4 bytes)]...
    // The major brand should be "avif" (still image) or "avis" (sequence)

    if (data.length < 12) return false;

    // Check for 'ftyp' box at offset 4
    if (
      data[4] !== 0x66 || // 'f'
      data[5] !== 0x74 || // 't'
      data[6] !== 0x79 || // 'y'
      data[7] !== 0x70 // 'p'
    ) {
      return false;
    }

    // Check for 'avif' or 'avis' major brand at offset 8
    const isAvif = data[8] === 0x61 && // 'a'
      data[9] === 0x76 && // 'v'
      data[10] === 0x69 && // 'i'
      data[11] === 0x66; // 'f'

    const isAvis = data[8] === 0x61 && // 'a'
      data[9] === 0x76 && // 'v'
      data[10] === 0x69 && // 'i'
      data[11] === 0x73; // 's'

    return isAvif || isAvis;
  }

  /**
   * Decode AVIF image data to RGBA using native ImageDecoder API
   * @param data Raw AVIF image data
   * @returns Decoded image data with RGBA pixels
   */
  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid AVIF signature");
    }

    // Check if ImageDecoder is available
    if (typeof ImageDecoder === "undefined") {
      throw new Error(
        "ImageDecoder API is not available in this runtime. AVIF decoding requires native API support.",
      );
    }

    try {
      const decoder = new ImageDecoder({
        data,
        type: this.mimeType,
      });

      const result = await decoder.decode({ frameIndex: 0 });
      const image = result.image;

      const width = image.displayWidth;
      const height = image.displayHeight;

      // Validate dimensions for security
      validateImageDimensions(width, height);

      // Create a canvas to extract RGBA data
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to get 2D context");
      }

      // Draw the decoded image to canvas
      ctx.drawImage(image, 0, 0);

      // Extract RGBA pixel data
      const imageData = ctx.getImageData(0, 0, width, height);
      const rgba = new Uint8Array(imageData.data);

      // Close the image to free resources
      image.close();
      decoder.close();

      const metadata: ImageMetadata = {};

      return {
        width,
        height,
        data: rgba,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to decode AVIF image: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Encode image data to AVIF format using native OffscreenCanvas API
   * @param imageData Image data to encode
   * @param _options Optional encoding options (reserved for future use)
   * @returns Encoded AVIF image bytes
   */
  async encode(
    imageData: ImageData,
    _options?: unknown,
  ): Promise<Uint8Array> {
    // Check if OffscreenCanvas is available
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error(
        "OffscreenCanvas API is not available in this runtime. AVIF encoding requires native API support.",
      );
    }

    try {
      const { width, height, data } = imageData;

      // Validate dimensions
      validateImageDimensions(width, height);

      // Create canvas and context
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to get 2D context");
      }

      // Put the RGBA data onto the canvas
      const imgData = new globalThis.ImageData(
        new Uint8ClampedArray(data),
        width,
        height,
      );
      ctx.putImageData(imgData, 0, 0);

      // Convert canvas to AVIF blob
      const blob = await canvas.convertToBlob({
        type: this.mimeType,
      });

      // Convert blob to Uint8Array
      const arrayBuffer = await blob.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new Error(
        `Failed to encode AVIF image: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Helper method to read uint32 in big-endian format
   */
  private readUint32BE(data: Uint8Array, offset: number): number {
    return (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3];
  }
}
