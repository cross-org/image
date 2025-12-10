import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * HEIC format handler
 * Supports HEIC/HEIF images using runtime APIs (ImageDecoder/OffscreenCanvas)
 * Note: Pure JavaScript encode/decode is not supported due to complexity
 */
export class HEICFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "heic";
  /** MIME type for HEIC images */
  readonly mimeType = "image/heic";

  /**
   * Check if the given data is a HEIC/HEIF image
   * @param data Raw image data to check
   * @returns true if data has HEIC/HEIF signature
   */
  canDecode(data: Uint8Array): boolean {
    // HEIC/HEIF files are ISO Base Media File Format (ISOBMFF) containers
    // They start with ftyp box which contains brand identifiers
    if (data.length < 12) return false;

    // Check for ftyp box at the start
    // Bytes 4-7 should be "ftyp"
    if (
      data[4] === 0x66 && data[5] === 0x74 && // "ft"
      data[6] === 0x79 && data[7] === 0x70 // "yp"
    ) {
      // Check for HEIC/HEIF brand identifiers
      // Common brands: heic, heix, hevc, hevx, mif1, msf1
      const brand = String.fromCharCode(
        data[8],
        data[9],
        data[10],
        data[11],
      );
      return brand === "heic" || brand === "heix" || brand === "hevc" ||
        brand === "hevx" || brand === "mif1" || brand === "msf1";
    }

    return false;
  }

  /**
   * Decode HEIC image data to RGBA
   * Uses runtime APIs (ImageDecoder) for decoding
   * @param data Raw HEIC image data
   * @returns Decoded image data with RGBA pixels
   */
  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid HEIC signature");
    }

    // Extract metadata before decoding pixels
    const metadata = await this.extractMetadata(data);

    // Use runtime decoder
    const { width, height, rgba } = await this.decodeUsingRuntime(data);

    // Validate dimensions for security
    validateImageDimensions(width, height);

    return {
      width,
      height,
      data: rgba,
      metadata,
    };
  }

  /**
   * Encode RGBA image data to HEIC format
   * Uses runtime APIs (OffscreenCanvas) for encoding
   * @param imageData Image data to encode
   * @returns Encoded HEIC image bytes
   */
  async encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data, metadata } = imageData;

    // Try to use runtime encoding if available
    if (typeof OffscreenCanvas !== "undefined") {
      try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imgData = ctx.createImageData(width, height);
          const imgDataData = new Uint8ClampedArray(data);
          imgData.data.set(imgDataData);
          ctx.putImageData(imgData, 0, 0);

          // Try to encode as HEIC
          const blob = await canvas.convertToBlob({
            type: "image/heic",
          });
          const arrayBuffer = await blob.arrayBuffer();
          const encoded = new Uint8Array(arrayBuffer);

          // Note: Metadata injection for HEIC is complex and would require
          // parsing and modifying the ISOBMFF container structure
          // For now, we rely on the runtime encoder to preserve metadata
          // if it was passed through the canvas
          if (metadata) {
            // Future enhancement: inject metadata into HEIC container
            console.warn(
              "HEIC metadata injection not yet implemented, metadata may be lost",
            );
          }

          return encoded;
        }
      } catch (error) {
        throw new Error(`HEIC encoding failed: ${error}`);
      }
    }

    throw new Error(
      "HEIC encoding requires OffscreenCanvas API (not available in this runtime)",
    );
  }

  /**
   * Decode using runtime APIs
   * @param data Raw HEIC data
   * @returns Decoded image dimensions and pixel data
   */
  private async decodeUsingRuntime(
    data: Uint8Array,
  ): Promise<{ width: number; height: number; rgba: Uint8Array }> {
    // Try to use ImageDecoder API if available
    if (typeof ImageDecoder !== "undefined") {
      try {
        const decoder = new ImageDecoder({ data, type: "image/heic" });
        const result = await decoder.decode();
        const bitmap = result.image;

        // Create a canvas to extract pixel data
        const canvas = new OffscreenCanvas(
          bitmap.displayWidth,
          bitmap.displayHeight,
        );
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        bitmap.close();

        return {
          width: canvas.width,
          height: canvas.height,
          rgba: new Uint8Array(imageData.data.buffer),
        };
      } catch (error) {
        throw new Error(`HEIC decoding with ImageDecoder failed: ${error}`);
      }
    }

    throw new Error(
      "HEIC decoding requires ImageDecoder API (not available in this runtime)",
    );
  }

  /**
   * Parse EXIF metadata from HEIC data
   * HEIC files can contain EXIF data in the meta box
   * @param data Raw HEIC data
   * @param metadata Metadata object to populate
   */
  private parseEXIF(data: Uint8Array, metadata: ImageMetadata): void {
    // HEIC EXIF parsing would require navigating the ISOBMFF box structure
    // to find the 'meta' box and then the 'Exif' item
    // This is complex and not implemented in pure JS here
    // The runtime decoder typically handles this

    // For now, we'll attempt a simple search for EXIF header
    // This is a simplified approach and may not work in all cases
    try {
      // Look for Exif header
      for (let i = 0; i < data.length - 6; i++) {
        if (
          data[i] === 0x45 && data[i + 1] === 0x78 && // "Ex"
          data[i + 2] === 0x69 && data[i + 3] === 0x66 && // "if"
          data[i + 4] === 0x00 && data[i + 5] === 0x00 // padding
        ) {
          // Found EXIF header, parse TIFF structure
          const exifData = data.slice(i + 6);
          this.parseTIFFExif(exifData, metadata);
          break;
        }
      }
    } catch (_e) {
      // Ignore EXIF parsing errors
    }
  }

  /**
   * Parse TIFF-formatted EXIF data
   * @param data EXIF data in TIFF format
   * @param metadata Metadata object to populate
   */
  private parseTIFFExif(data: Uint8Array, metadata: ImageMetadata): void {
    if (data.length < 8) return;

    try {
      const byteOrder = String.fromCharCode(data[0], data[1]);
      const littleEndian = byteOrder === "II";

      const ifd0Offset = littleEndian
        ? data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)
        : (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];

      if (ifd0Offset + 2 > data.length) return;

      const numEntries = littleEndian
        ? data[ifd0Offset] | (data[ifd0Offset + 1] << 8)
        : (data[ifd0Offset] << 8) | data[ifd0Offset + 1];

      // Parse IFD entries
      for (let i = 0; i < numEntries && i < 100; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        // Parse common EXIF tags (simplified)
        // DateTime (0x0132)
        if (tag === 0x0132) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              const dateStr = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
              const match = dateStr.match(
                /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
              );
              if (match) {
                metadata.creationDate = new Date(
                  parseInt(match[1]),
                  parseInt(match[2]) - 1,
                  parseInt(match[3]),
                  parseInt(match[4]),
                  parseInt(match[5]),
                  parseInt(match[6]),
                );
              }
            }
          }
        }
      }
    } catch (_e) {
      // Ignore parsing errors
    }
  }

  /**
   * Get the list of metadata fields supported by HEIC format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "creationDate",
      "latitude",
      "longitude",
      "cameraMake",
      "cameraModel",
      "iso",
      "exposureTime",
      "fNumber",
      "focalLength",
      "orientation",
      "software",
    ];
  }

  /**
   * Extract metadata from HEIC data without fully decoding the pixel data
   * @param data Raw HEIC data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) {
      return Promise.resolve(undefined);
    }

    const metadata: ImageMetadata = {};
    this.parseEXIF(data, metadata);

    return Promise.resolve(
      Object.keys(metadata).length > 0 ? metadata : undefined,
    );
  }
}
