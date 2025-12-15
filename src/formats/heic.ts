import type {
  HEICEncoderOptions,
  ImageData,
  ImageDecoderOptions,
  ImageFormat,
  ImageMetadata,
} from "../types.ts";
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
  async decode(
    data: Uint8Array,
    settings?: ImageDecoderOptions,
  ): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid HEIC signature");
    }

    if (settings?.runtimeDecoding === "never") {
      throw new Error(
        "HEIC decoding requires runtime APIs; set runtimeDecoding to 'prefer'",
      );
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
   *
   * Note: Metadata injection is not currently implemented. Metadata may be lost during encoding
   * as it would require parsing and modifying the ISOBMFF container structure.
   *
   * @param imageData Image data to encode
   * @returns Encoded HEIC image bytes
   */
  async encode(
    imageData: ImageData,
    options?: HEICEncoderOptions,
  ): Promise<Uint8Array> {
    const { width, height, data, metadata: _metadata } = imageData;

    const requestedQuality = options?.quality;

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

          const quality = requestedQuality === undefined
            ? undefined
            : (requestedQuality <= 1
              ? Math.max(0, Math.min(1, requestedQuality))
              : Math.max(1, Math.min(100, requestedQuality)) / 100);

          // Try to encode as HEIC
          const blob = await canvas.convertToBlob({
            type: "image/heic",
            ...(quality === undefined ? {} : { quality }),
          });

          if (blob.type !== "image/heic") {
            throw new Error(
              `Runtime did not encode HEIC (got '${blob.type || "(empty)"}')`,
            );
          }

          const arrayBuffer = await blob.arrayBuffer();
          const encoded = new Uint8Array(arrayBuffer);

          // Note: Metadata injection for HEIC is complex and would require
          // parsing and modifying the ISOBMFF container structure
          // For now, we rely on the runtime encoder to preserve metadata
          // if it was passed through the canvas
          // Future enhancement: inject metadata into HEIC container

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
   *
   * Note: This is a simplified implementation that searches for EXIF headers linearly.
   * A full implementation would require navigating the ISOBMFF box structure to find
   * the 'meta' box and then the 'Exif' item. This simplified approach may not work
   * in all cases but is suitable for basic metadata extraction when runtime APIs are
   * not available or as a fallback.
   *
   * @param data Raw HEIC data
   * @param metadata Metadata object to populate
   */
  private parseEXIF(data: Uint8Array, metadata: ImageMetadata): void {
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

      let gpsIfdOffset = 0;

      // Parse IFD0 entries
      for (let i = 0; i < numEntries && i < 100; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        const type = littleEndian
          ? data[entryOffset + 2] | (data[entryOffset + 3] << 8)
          : (data[entryOffset + 2] << 8) | data[entryOffset + 3];

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

        // ImageDescription (0x010E)
        if (tag === 0x010e) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.description = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Artist (0x013B)
        if (tag === 0x013b) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.author = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Copyright (0x8298)
        if (tag === 0x8298) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.copyright = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Make (0x010F)
        if (tag === 0x010f) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.cameraMake = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Model (0x0110)
        if (tag === 0x0110) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.cameraModel = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Orientation (0x0112)
        if (tag === 0x0112) {
          const value = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8)
            : (data[entryOffset + 8] << 8) | data[entryOffset + 9];
          metadata.orientation = value;
        }

        // Software (0x0131)
        if (tag === 0x0131) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.software = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // GPS IFD Pointer (0x8825)
        if (tag === 0x8825) {
          gpsIfdOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];
        }

        // ExifIFD Pointer (0x8769)
        if (tag === 0x8769 && type === 4) {
          const exifIfdOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (exifIfdOffset > 0 && exifIfdOffset + 2 <= data.length) {
            this.parseExifSubIFD(data, exifIfdOffset, littleEndian, metadata);
          }
        }
      }

      // Parse GPS IFD if present
      if (gpsIfdOffset > 0 && gpsIfdOffset + 2 <= data.length) {
        this.parseGPSIFD(data, gpsIfdOffset, littleEndian, metadata);
      }
    } catch (_e) {
      // Ignore parsing errors
    }
  }

  /**
   * Parse Exif Sub-IFD for camera settings
   * @param data EXIF data
   * @param exifIfdOffset Offset to Exif Sub-IFD
   * @param littleEndian Byte order
   * @param metadata Metadata object to populate
   */
  private parseExifSubIFD(
    data: Uint8Array,
    exifIfdOffset: number,
    littleEndian: boolean,
    metadata: ImageMetadata,
  ): void {
    try {
      const numEntries = littleEndian
        ? data[exifIfdOffset] | (data[exifIfdOffset + 1] << 8)
        : (data[exifIfdOffset] << 8) | data[exifIfdOffset + 1];

      for (let i = 0; i < numEntries && i < 100; i++) {
        const entryOffset = exifIfdOffset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        const type = littleEndian
          ? data[entryOffset + 2] | (data[entryOffset + 3] << 8)
          : (data[entryOffset + 2] << 8) | data[entryOffset + 3];

        // ExposureTime (0x829A)
        if (tag === 0x829a && type === 5) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset + 8 <= data.length) {
            metadata.exposureTime = this.readRational(
              data,
              valueOffset,
              littleEndian,
            );
          }
        }

        // FNumber (0x829D)
        if (tag === 0x829d && type === 5) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset + 8 <= data.length) {
            metadata.fNumber = this.readRational(
              data,
              valueOffset,
              littleEndian,
            );
          }
        }

        // ISOSpeedRatings (0x8827)
        if (tag === 0x8827 && type === 3) {
          metadata.iso = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8)
            : (data[entryOffset + 8] << 8) | data[entryOffset + 9];
        }

        // FocalLength (0x920A)
        if (tag === 0x920a && type === 5) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset + 8 <= data.length) {
            metadata.focalLength = this.readRational(
              data,
              valueOffset,
              littleEndian,
            );
          }
        }

        // UserComment (0x9286)
        if (tag === 0x9286) {
          const count = littleEndian
            ? data[entryOffset + 4] | (data[entryOffset + 5] << 8) |
              (data[entryOffset + 6] << 16) | (data[entryOffset + 7] << 24)
            : (data[entryOffset + 4] << 24) | (data[entryOffset + 5] << 16) |
              (data[entryOffset + 6] << 8) | data[entryOffset + 7];

          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset + count <= data.length && count > 8) {
            const commentData = data.slice(
              valueOffset + 8,
              valueOffset + count,
            );
            metadata.userComment = new TextDecoder().decode(commentData)
              .replace(
                /\0+$/,
                "",
              );
          }
        }

        // Flash (0x9209)
        if (tag === 0x9209 && type === 3) {
          metadata.flash = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8)
            : (data[entryOffset + 8] << 8) | data[entryOffset + 9];
        }

        // WhiteBalance (0xA403)
        if (tag === 0xa403 && type === 3) {
          metadata.whiteBalance = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8)
            : (data[entryOffset + 8] << 8) | data[entryOffset + 9];
        }

        // LensMake (0xA433)
        if (tag === 0xa433 && type === 2) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.lensMake = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // LensModel (0xA434)
        if (tag === 0xa434 && type === 2) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const endIndex = data.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.lensModel = new TextDecoder().decode(
                data.slice(valueOffset, endIndex),
              );
            }
          }
        }
      }
    } catch (_e) {
      // Ignore parsing errors
    }
  }

  /**
   * Parse GPS IFD for location data
   * @param data EXIF data
   * @param gpsIfdOffset Offset to GPS IFD
   * @param littleEndian Byte order
   * @param metadata Metadata object to populate
   */
  private parseGPSIFD(
    data: Uint8Array,
    gpsIfdOffset: number,
    littleEndian: boolean,
    metadata: ImageMetadata,
  ): void {
    try {
      const numEntries = littleEndian
        ? data[gpsIfdOffset] | (data[gpsIfdOffset + 1] << 8)
        : (data[gpsIfdOffset] << 8) | data[gpsIfdOffset + 1];

      let latRef = "";
      let lonRef = "";
      let latitude: number | undefined;
      let longitude: number | undefined;

      for (let i = 0; i < numEntries && i < 100; i++) {
        const entryOffset = gpsIfdOffset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        const type = littleEndian
          ? data[entryOffset + 2] | (data[entryOffset + 3] << 8)
          : (data[entryOffset + 2] << 8) | data[entryOffset + 3];

        // GPSLatitudeRef (0x0001)
        if (tag === 0x0001 && type === 2) {
          latRef = String.fromCharCode(data[entryOffset + 8]);
        }

        // GPSLatitude (0x0002)
        if (tag === 0x0002 && type === 5) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset + 24 <= data.length) {
            const degrees = this.readRational(
              data,
              valueOffset,
              littleEndian,
            );
            const minutes = this.readRational(
              data,
              valueOffset + 8,
              littleEndian,
            );
            const seconds = this.readRational(
              data,
              valueOffset + 16,
              littleEndian,
            );
            latitude = degrees + minutes / 60 + seconds / 3600;
          }
        }

        // GPSLongitudeRef (0x0003)
        if (tag === 0x0003 && type === 2) {
          lonRef = String.fromCharCode(data[entryOffset + 8]);
        }

        // GPSLongitude (0x0004)
        if (tag === 0x0004 && type === 5) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset + 24 <= data.length) {
            const degrees = this.readRational(
              data,
              valueOffset,
              littleEndian,
            );
            const minutes = this.readRational(
              data,
              valueOffset + 8,
              littleEndian,
            );
            const seconds = this.readRational(
              data,
              valueOffset + 16,
              littleEndian,
            );
            longitude = degrees + minutes / 60 + seconds / 3600;
          }
        }
      }

      // Apply reference direction
      if (latitude !== undefined) {
        metadata.latitude = latRef === "S" ? -latitude : latitude;
      }
      if (longitude !== undefined) {
        metadata.longitude = lonRef === "W" ? -longitude : longitude;
      }
    } catch (_e) {
      // Ignore parsing errors
    }
  }

  /**
   * Read a rational value (numerator/denominator)
   * @param data Data buffer
   * @param offset Offset to rational
   * @param littleEndian Byte order
   * @returns Decimal value
   */
  private readRational(
    data: Uint8Array,
    offset: number,
    littleEndian: boolean,
  ): number {
    const numerator = littleEndian
      ? data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) |
        (data[offset + 3] << 24)
      : (data[offset] << 24) | (data[offset + 1] << 16) |
        (data[offset + 2] << 8) | data[offset + 3];

    const denominator = littleEndian
      ? data[offset + 4] | (data[offset + 5] << 8) |
        (data[offset + 6] << 16) | (data[offset + 7] << 24)
      : (data[offset + 4] << 24) | (data[offset + 5] << 16) |
        (data[offset + 6] << 8) | data[offset + 7];

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Get the list of metadata fields supported by HEIC format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "creationDate",
      "description",
      "author",
      "copyright",
      "latitude",
      "longitude",
      "cameraMake",
      "cameraModel",
      "iso",
      "exposureTime",
      "fNumber",
      "focalLength",
      "flash",
      "whiteBalance",
      "lensMake",
      "lensModel",
      "orientation",
      "software",
      "userComment",
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
