import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

// Constants for unit conversions
const CM_PER_INCH = 2.54;

/**
 * JPEG format handler
 * Implements a basic JPEG decoder and encoder
 */
export class JPEGFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "jpeg";
  /** MIME type for JPEG images */
  readonly mimeType = "image/jpeg";

  /**
   * Check if the given data is a JPEG image
   * @param data Raw image data to check
   * @returns true if data has JPEG signature
   */
  canDecode(data: Uint8Array): boolean {
    // JPEG signature: FF D8 FF
    return data.length >= 3 &&
      data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }

  /**
   * Decode JPEG image data to RGBA
   * @param data Raw JPEG image data
   * @returns Decoded image data with RGBA pixels
   */
  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid JPEG signature");
    }

    // Parse JPEG structure to get dimensions and metadata
    let pos = 2; // Skip initial FF D8
    let width = 0;
    let height = 0;
    const metadata: ImageMetadata = {};

    while (pos < data.length - 1) {
      if (data[pos] !== 0xff) {
        pos++;
        continue;
      }

      const marker = data[pos + 1];
      pos += 2;

      // SOF markers (Start of Frame)
      if (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        const _length = (data[pos] << 8) | data[pos + 1];
        // precision at pos+2
        height = (data[pos + 3] << 8) | data[pos + 4];
        width = (data[pos + 5] << 8) | data[pos + 6];
        break;
      }

      // APP0 marker (JFIF)
      if (marker === 0xe0) {
        const length = (data[pos] << 8) | data[pos + 1];
        const appData = data.slice(pos + 2, pos + length);
        this.parseJFIF(appData, metadata, width, height);
        pos += length;
        continue;
      }

      // APP1 marker (EXIF)
      if (marker === 0xe1) {
        const length = (data[pos] << 8) | data[pos + 1];
        const appData = data.slice(pos + 2, pos + length);
        this.parseEXIF(appData, metadata);
        pos += length;
        continue;
      }

      // Skip other markers
      if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS
      if (marker >= 0xd0 && marker <= 0xd8) continue; // RST markers have no length
      if (marker === 0x01) continue; // TEM has no length

      const length = (data[pos] << 8) | data[pos + 1];
      pos += length;
    }

    if (width === 0 || height === 0) {
      throw new Error("Could not determine JPEG dimensions");
    }

    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

    // For a pure JS implementation, we'd need to implement full JPEG decoding
    // which is very complex. Instead, we'll use the browser/runtime's decoder.
    const rgba = await this.decodeUsingRuntime(data, width, height);

    return {
      width,
      height,
      data: rgba,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Encode RGBA image data to JPEG format
   * @param imageData Image data to encode
   * @returns Encoded JPEG image bytes
   */
  async encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data, metadata } = imageData;

    // Try to use runtime encoding if available (better quality)
    if (typeof OffscreenCanvas !== "undefined") {
      try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imgData = ctx.createImageData(width, height);
          const imgDataData = new Uint8ClampedArray(data);
          imgData.data.set(imgDataData);
          ctx.putImageData(imgData, 0, 0);

          const blob = await canvas.convertToBlob({
            type: "image/jpeg",
            quality: 0.9,
          });
          const arrayBuffer = await blob.arrayBuffer();
          const encoded = new Uint8Array(arrayBuffer);

          // If we have metadata, we need to inject it into the JPEG
          if (metadata && Object.keys(metadata).length > 0) {
            return this.injectMetadata(encoded, metadata);
          }

          return encoded;
        }
      } catch (_error) {
        // Fall through to pure JS encoder
      }
    }

    // Fallback to pure JavaScript encoder
    const { JPEGEncoder } = await import("../utils/jpeg_encoder.ts");
    const dpiX = metadata?.dpiX ?? 72;
    const dpiY = metadata?.dpiY ?? 72;
    const encoder = new JPEGEncoder(85); // Quality 85
    const encoded = encoder.encode(width, height, data, dpiX, dpiY);

    // Add EXIF metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      return this.injectMetadata(encoded, metadata);
    }

    return encoded;
  }

  private injectMetadata(
    encoded: Uint8Array,
    metadata: ImageMetadata,
  ): Uint8Array {
    // Find the position after SOI and APP0 to inject APP1 (EXIF)
    let pos = 2; // After SOI (0xFF 0xD8)

    // Skip APP0 if present
    if (
      pos + 2 < encoded.length && encoded[pos] === 0xff &&
      encoded[pos + 1] === 0xe0
    ) {
      const length = (encoded[pos + 2] << 8) | encoded[pos + 3];
      pos += length + 2;
    }

    // Create EXIF data
    const exifData = this.createEXIFData(metadata);
    if (exifData.length === 0) {
      return encoded;
    }

    // Create APP1 marker with EXIF data
    // APP1 structure: FF E1 [length 2 bytes] "Exif\0\0" [exif data]
    const app1Length = 2 + 6 + exifData.length; // length field + "Exif\0\0" + data
    const app1 = new Uint8Array(2 + 2 + 6 + exifData.length); // marker + length + "Exif\0\0" + data
    app1[0] = 0xff;
    app1[1] = 0xe1; // APP1 marker
    app1[2] = (app1Length >> 8) & 0xff;
    app1[3] = app1Length & 0xff;
    app1[4] = 0x45; // 'E'
    app1[5] = 0x78; // 'x'
    app1[6] = 0x69; // 'i'
    app1[7] = 0x66; // 'f'
    app1[8] = 0x00;
    app1[9] = 0x00;
    app1.set(exifData, 10);

    // Inject APP1 into the JPEG
    const result = new Uint8Array(encoded.length + app1.length);
    result.set(encoded.slice(0, pos), 0);
    result.set(app1, pos);
    result.set(encoded.slice(pos), pos + app1.length);

    return result;
  }

  private async decodeUsingRuntime(
    data: Uint8Array,
    _width: number,
    _height: number,
  ): Promise<Uint8Array> {
    // Try to use ImageDecoder API if available (Deno, modern browsers)
    if (typeof ImageDecoder !== "undefined") {
      try {
        const decoder = new ImageDecoder({ data, type: "image/jpeg" });
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

        return new Uint8Array(imageData.data.buffer);
      } catch (error) {
        // ImageDecoder API failed, fall through to pure JS decoder
        console.warn(
          "JPEG decoding with ImageDecoder failed, using pure JS decoder:",
          error,
        );
      }
    }

    // Fallback to pure JavaScript decoder
    try {
      const { JPEGDecoder } = await import("../utils/jpeg_decoder.ts");
      const decoder = new JPEGDecoder(data);
      return decoder.decode();
    } catch (error) {
      throw new Error(
        `JPEG decoding failed: ${error}`,
      );
    }
  }

  // Metadata parsing and creation methods

  private parseJFIF(
    data: Uint8Array,
    metadata: ImageMetadata,
    width: number,
    height: number,
  ): void {
    // JFIF format: "JFIF\0" version units xDensity yDensity
    if (data.length < 14) return;

    // Check for JFIF identifier
    if (
      data[0] !== 0x4a || data[1] !== 0x46 || data[2] !== 0x49 ||
      data[3] !== 0x46 || data[4] !== 0x00
    ) return;

    const units = data[7]; // 0=no units, 1=dpi, 2=dpcm
    const xDensity = (data[8] << 8) | data[9];
    const yDensity = (data[10] << 8) | data[11];

    if (units === 1 && xDensity > 0 && yDensity > 0) {
      // Units are DPI
      metadata.dpiX = xDensity;
      metadata.dpiY = yDensity;
      metadata.physicalWidth = width / xDensity;
      metadata.physicalHeight = height / yDensity;
    } else if (units === 2 && xDensity > 0 && yDensity > 0) {
      // Units are dots per cm, convert to DPI
      metadata.dpiX = Math.round(xDensity * CM_PER_INCH);
      metadata.dpiY = Math.round(yDensity * CM_PER_INCH);
      metadata.physicalWidth = width / metadata.dpiX;
      metadata.physicalHeight = height / metadata.dpiY;
    }
  }

  private parseEXIF(data: Uint8Array, metadata: ImageMetadata): void {
    // Check for EXIF identifier
    if (
      data.length < 6 || data[0] !== 0x45 || data[1] !== 0x78 ||
      data[2] !== 0x69 || data[3] !== 0x66 || data[4] !== 0x00 ||
      data[5] !== 0x00
    ) return;

    // Skip "Exif\0\0" header
    const exifData = data.slice(6);
    if (exifData.length < 8) return;

    try {
      const byteOrder = String.fromCharCode(exifData[0], exifData[1]);
      const littleEndian = byteOrder === "II";

      // Read IFD0 offset
      const ifd0Offset = littleEndian
        ? exifData[4] | (exifData[5] << 8) | (exifData[6] << 16) |
          (exifData[7] << 24)
        : (exifData[4] << 24) | (exifData[5] << 16) | (exifData[6] << 8) |
          exifData[7];

      if (ifd0Offset + 2 > exifData.length) return;

      // Read number of entries with bounds check
      const numEntries = littleEndian
        ? exifData[ifd0Offset] | (exifData[ifd0Offset + 1] << 8)
        : (exifData[ifd0Offset] << 8) | exifData[ifd0Offset + 1];

      let gpsIfdOffset = 0;

      // Parse entries
      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        if (entryOffset + 12 > exifData.length) break;

        const tag = littleEndian
          ? exifData[entryOffset] | (exifData[entryOffset + 1] << 8)
          : (exifData[entryOffset] << 8) | exifData[entryOffset + 1];

        // DateTime tag (0x0132)
        if (tag === 0x0132) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              const dateStr = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
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

        // ImageDescription tag (0x010E)
        if (tag === 0x010e) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.description = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Artist tag (0x013B)
        if (tag === 0x013b) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.author = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Copyright tag (0x8298)
        if (tag === 0x8298) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.copyright = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Make tag (0x010F)
        if (tag === 0x010f) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.cameraMake = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Model tag (0x0110)
        if (tag === 0x0110) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.cameraModel = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // Orientation tag (0x0112)
        if (tag === 0x0112) {
          const value = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8)
            : (exifData[entryOffset + 8] << 8) | exifData[entryOffset + 9];
          metadata.orientation = value;
        }

        // Software tag (0x0131)
        if (tag === 0x0131) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.software = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // GPS IFD Pointer tag (0x8825)
        if (tag === 0x8825) {
          gpsIfdOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];
        }

        // ExifIFD Pointer tag (0x8769) - points to EXIF Sub-IFD
        const type = littleEndian
          ? exifData[entryOffset + 2] | (exifData[entryOffset + 3] << 8)
          : (exifData[entryOffset + 2] << 8) | exifData[entryOffset + 3];

        if (tag === 0x8769 && type === 4) {
          const exifIfdOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (exifIfdOffset > 0 && exifIfdOffset + 2 <= exifData.length) {
            this.parseExifSubIFD(
              exifData,
              exifIfdOffset,
              littleEndian,
              metadata,
            );
          }
        }
      }

      // Parse GPS IFD if present
      if (gpsIfdOffset > 0 && gpsIfdOffset + 2 <= exifData.length) {
        this.parseGPSIFD(exifData, gpsIfdOffset, littleEndian, metadata);
      }
    } catch (_e) {
      // Ignore EXIF parsing errors
    }
  }

  private parseExifSubIFD(
    exifData: Uint8Array,
    exifIfdOffset: number,
    littleEndian: boolean,
    metadata: ImageMetadata,
  ): void {
    try {
      const numEntries = littleEndian
        ? exifData[exifIfdOffset] | (exifData[exifIfdOffset + 1] << 8)
        : (exifData[exifIfdOffset] << 8) | exifData[exifIfdOffset + 1];

      for (let i = 0; i < numEntries; i++) {
        const entryOffset = exifIfdOffset + 2 + i * 12;
        if (entryOffset + 12 > exifData.length) break;

        const tag = littleEndian
          ? exifData[entryOffset] | (exifData[entryOffset + 1] << 8)
          : (exifData[entryOffset] << 8) | exifData[entryOffset + 1];

        const type = littleEndian
          ? exifData[entryOffset + 2] | (exifData[entryOffset + 3] << 8)
          : (exifData[entryOffset + 2] << 8) | exifData[entryOffset + 3];

        // ExposureTime tag (0x829A) - RATIONAL
        if (tag === 0x829a && type === 5) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset + 8 <= exifData.length) {
            metadata.exposureTime = this.readRational(
              exifData,
              valueOffset,
              littleEndian,
            );
          }
        }

        // FNumber tag (0x829D) - RATIONAL
        if (tag === 0x829d && type === 5) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset + 8 <= exifData.length) {
            metadata.fNumber = this.readRational(
              exifData,
              valueOffset,
              littleEndian,
            );
          }
        }

        // ISOSpeedRatings tag (0x8827) - SHORT
        if (tag === 0x8827 && type === 3) {
          metadata.iso = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8)
            : (exifData[entryOffset + 8] << 8) | exifData[entryOffset + 9];
        }

        // FocalLength tag (0x920A) - RATIONAL
        if (tag === 0x920a && type === 5) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset + 8 <= exifData.length) {
            metadata.focalLength = this.readRational(
              exifData,
              valueOffset,
              littleEndian,
            );
          }
        }

        // UserComment tag (0x9286) - UNDEFINED
        if (tag === 0x9286) {
          const count = littleEndian
            ? exifData[entryOffset + 4] | (exifData[entryOffset + 5] << 8) |
              (exifData[entryOffset + 6] << 16) |
              (exifData[entryOffset + 7] << 24)
            : (exifData[entryOffset + 4] << 24) |
              (exifData[entryOffset + 5] << 16) |
              (exifData[entryOffset + 6] << 8) | exifData[entryOffset + 7];

          if (count > 8) {
            const valueOffset = littleEndian
              ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
                (exifData[entryOffset + 10] << 16) |
                (exifData[entryOffset + 11] << 24)
              : (exifData[entryOffset + 8] << 24) |
                (exifData[entryOffset + 9] << 16) |
                (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

            if (valueOffset + count <= exifData.length) {
              // Skip 8-byte character code prefix
              const commentData = exifData.slice(
                valueOffset + 8,
                valueOffset + count,
              );
              metadata.userComment = new TextDecoder().decode(commentData)
                .replace(/\0+$/, "");
            }
          }
        }

        // Flash tag (0x9209) - SHORT
        if (tag === 0x9209 && type === 3) {
          metadata.flash = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8)
            : (exifData[entryOffset + 8] << 8) | exifData[entryOffset + 9];
        }

        // WhiteBalance tag (0xA403) - SHORT
        if (tag === 0xa403 && type === 3) {
          metadata.whiteBalance = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8)
            : (exifData[entryOffset + 8] << 8) | exifData[entryOffset + 9];
        }

        // LensMake tag (0xA433) - ASCII
        if (tag === 0xa433 && type === 2) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.lensMake = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }

        // LensModel tag (0xA434) - ASCII
        if (tag === 0xa434 && type === 2) {
          const valueOffset = littleEndian
            ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
              (exifData[entryOffset + 10] << 16) |
              (exifData[entryOffset + 11] << 24)
            : (exifData[entryOffset + 8] << 24) |
              (exifData[entryOffset + 9] << 16) |
              (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

          if (valueOffset < exifData.length) {
            const endIndex = exifData.indexOf(0, valueOffset);
            if (endIndex > valueOffset) {
              metadata.lensModel = new TextDecoder().decode(
                exifData.slice(valueOffset, endIndex),
              );
            }
          }
        }
      }
    } catch (_e) {
      // Ignore EXIF Sub-IFD parsing errors
    }
  }

  private parseGPSIFD(
    exifData: Uint8Array,
    gpsIfdOffset: number,
    littleEndian: boolean,
    metadata: ImageMetadata,
  ): void {
    try {
      const numEntries = littleEndian
        ? exifData[gpsIfdOffset] | (exifData[gpsIfdOffset + 1] << 8)
        : (exifData[gpsIfdOffset] << 8) | exifData[gpsIfdOffset + 1];

      let latRef = "";
      let lonRef = "";
      let latitude: number | undefined;
      let longitude: number | undefined;

      for (let i = 0; i < numEntries; i++) {
        const entryOffset = gpsIfdOffset + 2 + i * 12;
        if (entryOffset + 12 > exifData.length) break;

        const tag = littleEndian
          ? exifData[entryOffset] | (exifData[entryOffset + 1] << 8)
          : (exifData[entryOffset] << 8) | exifData[entryOffset + 1];

        const type = littleEndian
          ? exifData[entryOffset + 2] | (exifData[entryOffset + 3] << 8)
          : (exifData[entryOffset + 2] << 8) | exifData[entryOffset + 3];

        const valueOffset = littleEndian
          ? exifData[entryOffset + 8] | (exifData[entryOffset + 9] << 8) |
            (exifData[entryOffset + 10] << 16) |
            (exifData[entryOffset + 11] << 24)
          : (exifData[entryOffset + 8] << 24) |
            (exifData[entryOffset + 9] << 16) |
            (exifData[entryOffset + 10] << 8) | exifData[entryOffset + 11];

        // GPSLatitudeRef (0x0001) - 'N' or 'S'
        if (tag === 0x0001 && type === 2) {
          latRef = String.fromCharCode(exifData[entryOffset + 8]);
        }

        // GPSLatitude (0x0002) - three rationals: degrees, minutes, seconds
        if (
          tag === 0x0002 && type === 5 && valueOffset + 24 <= exifData.length
        ) {
          const degrees = this.readRational(
            exifData,
            valueOffset,
            littleEndian,
          );
          const minutes = this.readRational(
            exifData,
            valueOffset + 8,
            littleEndian,
          );
          const seconds = this.readRational(
            exifData,
            valueOffset + 16,
            littleEndian,
          );
          latitude = degrees + minutes / 60 + seconds / 3600;
        }

        // GPSLongitudeRef (0x0003) - 'E' or 'W'
        if (tag === 0x0003 && type === 2) {
          lonRef = String.fromCharCode(exifData[entryOffset + 8]);
        }

        // GPSLongitude (0x0004) - three rationals: degrees, minutes, seconds
        if (
          tag === 0x0004 && type === 5 && valueOffset + 24 <= exifData.length
        ) {
          const degrees = this.readRational(
            exifData,
            valueOffset,
            littleEndian,
          );
          const minutes = this.readRational(
            exifData,
            valueOffset + 8,
            littleEndian,
          );
          const seconds = this.readRational(
            exifData,
            valueOffset + 16,
            littleEndian,
          );
          longitude = degrees + minutes / 60 + seconds / 3600;
        }
      }

      // Apply hemisphere references
      if (latitude !== undefined && latRef) {
        metadata.latitude = latRef === "S" ? -latitude : latitude;
      }
      if (longitude !== undefined && lonRef) {
        metadata.longitude = lonRef === "W" ? -longitude : longitude;
      }
    } catch (_e) {
      // Ignore GPS parsing errors
    }
  }

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
      ? data[offset + 4] | (data[offset + 5] << 8) | (data[offset + 6] << 16) |
        (data[offset + 7] << 24)
      : (data[offset + 4] << 24) | (data[offset + 5] << 16) |
        (data[offset + 6] << 8) | data[offset + 7];

    return denominator !== 0 ? numerator / denominator : 0;
  }

  private createEXIFData(metadata: ImageMetadata): number[] {
    const entries: {
      tag: number;
      type: number;
      value: Uint8Array;
    }[] = [];

    // Add DateTime if available
    if (metadata.creationDate) {
      const date = metadata.creationDate;
      const dateStr = `${date.getFullYear()}:${
        String(date.getMonth() + 1).padStart(2, "0")
      }:${String(date.getDate()).padStart(2, "0")} ${
        String(date.getHours()).padStart(2, "0")
      }:${String(date.getMinutes()).padStart(2, "0")}:${
        String(date.getSeconds()).padStart(2, "0")
      }\0`;
      entries.push({
        tag: 0x0132,
        type: 2, // ASCII
        value: new TextEncoder().encode(dateStr),
      });
    }

    // Add ImageDescription
    if (metadata.description) {
      entries.push({
        tag: 0x010e,
        type: 2,
        value: new TextEncoder().encode(metadata.description + "\0"),
      });
    }

    // Add Artist
    if (metadata.author) {
      entries.push({
        tag: 0x013b,
        type: 2,
        value: new TextEncoder().encode(metadata.author + "\0"),
      });
    }

    // Add Copyright
    if (metadata.copyright) {
      entries.push({
        tag: 0x8298,
        type: 2,
        value: new TextEncoder().encode(metadata.copyright + "\0"),
      });
    }

    // Add Make (camera manufacturer)
    if (metadata.cameraMake) {
      entries.push({
        tag: 0x010f,
        type: 2,
        value: new TextEncoder().encode(metadata.cameraMake + "\0"),
      });
    }

    // Add Model (camera model)
    if (metadata.cameraModel) {
      entries.push({
        tag: 0x0110,
        type: 2,
        value: new TextEncoder().encode(metadata.cameraModel + "\0"),
      });
    }

    // Add Orientation
    if (metadata.orientation !== undefined) {
      const orientationBytes = new Uint8Array(2);
      orientationBytes[0] = metadata.orientation & 0xff;
      orientationBytes[1] = (metadata.orientation >> 8) & 0xff;
      entries.push({
        tag: 0x0112,
        type: 3, // SHORT
        value: orientationBytes,
      });
    }

    // Add Software
    if (metadata.software) {
      entries.push({
        tag: 0x0131,
        type: 2,
        value: new TextEncoder().encode(metadata.software + "\0"),
      });
    }

    // Check if we have GPS data
    const hasGPS = metadata.latitude !== undefined &&
      metadata.longitude !== undefined;

    // Check if we have Exif Sub-IFD data
    const hasExifSubIFD = metadata.iso !== undefined ||
      metadata.exposureTime !== undefined ||
      metadata.fNumber !== undefined ||
      metadata.focalLength !== undefined ||
      metadata.flash !== undefined ||
      metadata.whiteBalance !== undefined ||
      metadata.lensMake !== undefined ||
      metadata.lensModel !== undefined ||
      metadata.userComment !== undefined;

    if (entries.length === 0 && !hasGPS && !hasExifSubIFD) return [];

    // Build EXIF structure
    const exif: number[] = [];

    // Byte order marker (little endian)
    exif.push(0x49, 0x49); // "II"
    exif.push(0x2a, 0x00); // 42

    // Offset to IFD0 (8 bytes from start)
    exif.push(0x08, 0x00, 0x00, 0x00);

    // Number of entries (add GPS IFD pointer and Exif Sub-IFD pointer if needed)
    const ifd0Entries = entries.length + (hasGPS ? 1 : 0) +
      (hasExifSubIFD ? 1 : 0);
    exif.push(ifd0Entries & 0xff, (ifd0Entries >> 8) & 0xff);

    // Calculate data offset
    let dataOffset = 8 + 2 + ifd0Entries * 12 + 4;

    for (const entry of entries) {
      // Tag
      exif.push(entry.tag & 0xff, (entry.tag >> 8) & 0xff);
      // Type
      exif.push(entry.type & 0xff, (entry.type >> 8) & 0xff);
      // Count
      const count = entry.value.length;
      exif.push(
        count & 0xff,
        (count >> 8) & 0xff,
        (count >> 16) & 0xff,
        (count >> 24) & 0xff,
      );
      // Value/Offset
      if (entry.value.length <= 4) {
        for (let i = 0; i < 4; i++) {
          exif.push(i < entry.value.length ? entry.value[i] : 0);
        }
      } else {
        exif.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += entry.value.length;
      }
    }

    // Add Exif Sub-IFD pointer if we have camera metadata
    let exifSubIfdOffset = 0;
    if (hasExifSubIFD) {
      exifSubIfdOffset = dataOffset;
      // Exif IFD Pointer tag (0x8769), type 4 (LONG), count 1
      exif.push(0x69, 0x87); // Tag
      exif.push(0x04, 0x00); // Type
      exif.push(0x01, 0x00, 0x00, 0x00); // Count
      exif.push(
        exifSubIfdOffset & 0xff,
        (exifSubIfdOffset >> 8) & 0xff,
        (exifSubIfdOffset >> 16) & 0xff,
        (exifSubIfdOffset >> 24) & 0xff,
      );
    }

    // Add GPS IFD pointer if we have GPS data
    let gpsIfdOffset = 0;
    if (hasGPS) {
      gpsIfdOffset = dataOffset;
      // GPS IFD Pointer tag (0x8825), type 4 (LONG), count 1
      exif.push(0x25, 0x88); // Tag
      exif.push(0x04, 0x00); // Type
      exif.push(0x01, 0x00, 0x00, 0x00); // Count
      exif.push(
        gpsIfdOffset & 0xff,
        (gpsIfdOffset >> 8) & 0xff,
        (gpsIfdOffset >> 16) & 0xff,
        (gpsIfdOffset >> 24) & 0xff,
      );
    }

    // Next IFD offset (0 = no more IFDs)
    exif.push(0x00, 0x00, 0x00, 0x00);

    // Append data for entries that didn't fit in value field
    for (const entry of entries) {
      if (entry.value.length > 4) {
        for (const byte of entry.value) {
          exif.push(byte);
        }
      }
    }

    // Add Exif Sub-IFD if we have camera metadata
    if (hasExifSubIFD) {
      const exifSubIfd = this.createExifSubIFD(metadata, exifSubIfdOffset);
      for (const byte of exifSubIfd) {
        exif.push(byte);
      }
      // Update GPS offset since we added the Sub-IFD
      if (hasGPS) {
        gpsIfdOffset = exif.length;
      }
    }

    // Add GPS IFD if we have GPS data
    if (hasGPS) {
      const gpsIfd = this.createGPSIFD(metadata, gpsIfdOffset);
      for (const byte of gpsIfd) {
        exif.push(byte);
      }
    }

    return exif;
  }

  private createGPSIFD(metadata: ImageMetadata, gpsIfdStart: number): number[] {
    const gps: number[] = [];

    // We'll create 4 GPS entries: LatitudeRef, Latitude, LongitudeRef, Longitude
    const numEntries = 4;
    gps.push(numEntries & 0xff, (numEntries >> 8) & 0xff);

    const latitude = metadata.latitude!;
    const longitude = metadata.longitude!;

    // Convert to absolute values for DMS calculation
    const absLat = Math.abs(latitude);
    const absLon = Math.abs(longitude);

    // Calculate degrees, minutes, seconds
    const latDeg = Math.floor(absLat);
    const latMin = Math.floor((absLat - latDeg) * 60);
    const latSec = ((absLat - latDeg) * 60 - latMin) * 60;

    const lonDeg = Math.floor(absLon);
    const lonMin = Math.floor((absLon - lonDeg) * 60);
    const lonSec = ((absLon - lonDeg) * 60 - lonMin) * 60;

    // Calculate offset for rational data (relative to start of EXIF data, not GPS IFD)
    let dataOffset = gpsIfdStart + 2 + numEntries * 12 + 4;

    // Entry 1: GPSLatitudeRef (tag 0x0001)
    gps.push(0x01, 0x00); // Tag
    gps.push(0x02, 0x00); // Type (ASCII)
    gps.push(0x02, 0x00, 0x00, 0x00); // Count (2 bytes including null)
    // Value stored inline: 'N' or 'S' + null
    gps.push(latitude >= 0 ? 78 : 83, 0x00, 0x00, 0x00); // 'N' = 78, 'S' = 83

    // Entry 2: GPSLatitude (tag 0x0002)
    gps.push(0x02, 0x00); // Tag
    gps.push(0x05, 0x00); // Type (RATIONAL)
    gps.push(0x03, 0x00, 0x00, 0x00); // Count (3 rationals)
    gps.push(
      dataOffset & 0xff,
      (dataOffset >> 8) & 0xff,
      (dataOffset >> 16) & 0xff,
      (dataOffset >> 24) & 0xff,
    );
    dataOffset += 24; // 3 rationals * 8 bytes

    // Entry 3: GPSLongitudeRef (tag 0x0003)
    gps.push(0x03, 0x00); // Tag
    gps.push(0x02, 0x00); // Type (ASCII)
    gps.push(0x02, 0x00, 0x00, 0x00); // Count
    gps.push(longitude >= 0 ? 69 : 87, 0x00, 0x00, 0x00); // 'E' = 69, 'W' = 87

    // Entry 4: GPSLongitude (tag 0x0004)
    gps.push(0x04, 0x00); // Tag
    gps.push(0x05, 0x00); // Type (RATIONAL)
    gps.push(0x03, 0x00, 0x00, 0x00); // Count
    gps.push(
      dataOffset & 0xff,
      (dataOffset >> 8) & 0xff,
      (dataOffset >> 16) & 0xff,
      (dataOffset >> 24) & 0xff,
    );

    // Next IFD offset (0 = no more IFDs)
    gps.push(0x00, 0x00, 0x00, 0x00);

    // Write latitude rationals (degrees, minutes, seconds)
    this.writeRational(gps, latDeg, 1);
    this.writeRational(gps, latMin, 1);
    this.writeRational(gps, Math.round(latSec * 1000000), 1000000);

    // Write longitude rationals
    this.writeRational(gps, lonDeg, 1);
    this.writeRational(gps, lonMin, 1);
    this.writeRational(gps, Math.round(lonSec * 1000000), 1000000);

    return gps;
  }

  private createExifSubIFD(
    metadata: ImageMetadata,
    exifIfdStart: number,
  ): number[] {
    const entries: { tag: number; type: number; data: number[] }[] = [];

    // ISO Speed Ratings (0x8827) - SHORT
    if (metadata.iso !== undefined) {
      entries.push({
        tag: 0x8827,
        type: 3,
        data: [metadata.iso & 0xff, (metadata.iso >> 8) & 0xff],
      });
    }

    // Exposure Time (0x829A) - RATIONAL
    if (metadata.exposureTime !== undefined) {
      entries.push({ tag: 0x829a, type: 5, data: [] }); // Will add offset later
    }

    // FNumber (0x829D) - RATIONAL
    if (metadata.fNumber !== undefined) {
      entries.push({ tag: 0x829d, type: 5, data: [] }); // Will add offset later
    }

    // Flash (0x9209) - SHORT
    if (metadata.flash !== undefined) {
      entries.push({
        tag: 0x9209,
        type: 3,
        data: [metadata.flash & 0xff, (metadata.flash >> 8) & 0xff],
      });
    }

    // Focal Length (0x920A) - RATIONAL
    if (metadata.focalLength !== undefined) {
      entries.push({ tag: 0x920a, type: 5, data: [] }); // Will add offset later
    }

    // User Comment (0x9286) - UNDEFINED
    if (metadata.userComment !== undefined) {
      entries.push({ tag: 0x9286, type: 7, data: [] }); // Will add offset later
    }

    // White Balance (0xA403) - SHORT
    if (metadata.whiteBalance !== undefined) {
      entries.push({
        tag: 0xa403,
        type: 3,
        data: [
          metadata.whiteBalance & 0xff,
          (metadata.whiteBalance >> 8) & 0xff,
        ],
      });
    }

    // Lens Make (0xA433) - ASCII
    if (metadata.lensMake !== undefined) {
      entries.push({ tag: 0xa433, type: 2, data: [] }); // Will add offset later
    }

    // Lens Model (0xA434) - ASCII
    if (metadata.lensModel !== undefined) {
      entries.push({ tag: 0xa434, type: 2, data: [] }); // Will add offset later
    }

    const exifSubIfd: number[] = [];
    const numEntries = entries.length;
    exifSubIfd.push(numEntries & 0xff, (numEntries >> 8) & 0xff);

    let dataOffset = exifIfdStart + 2 + numEntries * 12 + 4;

    // Write entry headers
    for (const entry of entries) {
      exifSubIfd.push(entry.tag & 0xff, (entry.tag >> 8) & 0xff);
      exifSubIfd.push(entry.type & 0xff, (entry.type >> 8) & 0xff);

      if (entry.tag === 0x829a && metadata.exposureTime !== undefined) {
        // Exposure Time - 1 RATIONAL
        exifSubIfd.push(0x01, 0x00, 0x00, 0x00); // Count
        exifSubIfd.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += 8;
      } else if (entry.tag === 0x829d && metadata.fNumber !== undefined) {
        // FNumber - 1 RATIONAL
        exifSubIfd.push(0x01, 0x00, 0x00, 0x00); // Count
        exifSubIfd.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += 8;
      } else if (entry.tag === 0x920a && metadata.focalLength !== undefined) {
        // Focal Length - 1 RATIONAL
        exifSubIfd.push(0x01, 0x00, 0x00, 0x00); // Count
        exifSubIfd.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += 8;
      } else if (entry.tag === 0x9286 && metadata.userComment !== undefined) {
        // User Comment - UNDEFINED with character code
        const commentBytes = new TextEncoder().encode(metadata.userComment);
        const totalLength = 8 + commentBytes.length; // 8 bytes for character code
        exifSubIfd.push(
          totalLength & 0xff,
          (totalLength >> 8) & 0xff,
          (totalLength >> 16) & 0xff,
          (totalLength >> 24) & 0xff,
        );
        exifSubIfd.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += totalLength;
      } else if (entry.tag === 0xa433 && metadata.lensMake !== undefined) {
        // Lens Make - ASCII
        const bytes = new TextEncoder().encode(metadata.lensMake + "\0");
        exifSubIfd.push(
          bytes.length & 0xff,
          (bytes.length >> 8) & 0xff,
          (bytes.length >> 16) & 0xff,
          (bytes.length >> 24) & 0xff,
        );
        exifSubIfd.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += bytes.length;
      } else if (entry.tag === 0xa434 && metadata.lensModel !== undefined) {
        // Lens Model - ASCII
        const bytes = new TextEncoder().encode(metadata.lensModel + "\0");
        exifSubIfd.push(
          bytes.length & 0xff,
          (bytes.length >> 8) & 0xff,
          (bytes.length >> 16) & 0xff,
          (bytes.length >> 24) & 0xff,
        );
        exifSubIfd.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += bytes.length;
      } else {
        // SHORT types stored inline
        exifSubIfd.push(0x01, 0x00, 0x00, 0x00); // Count
        exifSubIfd.push(...entry.data, 0x00, 0x00); // Value (4 bytes)
      }
    }

    // Next IFD offset
    exifSubIfd.push(0x00, 0x00, 0x00, 0x00);

    // Write data for RATIONAL and ASCII types
    for (const entry of entries) {
      if (entry.tag === 0x829a && metadata.exposureTime !== undefined) {
        // Convert exposure time to rational (numerator/denominator)
        const [num, den] = this.toRational(metadata.exposureTime);
        this.writeRational(exifSubIfd, num, den);
      } else if (entry.tag === 0x829d && metadata.fNumber !== undefined) {
        const [num, den] = this.toRational(metadata.fNumber);
        this.writeRational(exifSubIfd, num, den);
      } else if (entry.tag === 0x920a && metadata.focalLength !== undefined) {
        const [num, den] = this.toRational(metadata.focalLength);
        this.writeRational(exifSubIfd, num, den);
      } else if (entry.tag === 0x9286 && metadata.userComment !== undefined) {
        // Character code: ASCII (8 bytes)
        exifSubIfd.push(0x41, 0x53, 0x43, 0x49, 0x49, 0x00, 0x00, 0x00);
        const commentBytes = new TextEncoder().encode(metadata.userComment);
        for (const byte of commentBytes) {
          exifSubIfd.push(byte);
        }
      } else if (entry.tag === 0xa433 && metadata.lensMake !== undefined) {
        const bytes = new TextEncoder().encode(metadata.lensMake + "\0");
        for (const byte of bytes) {
          exifSubIfd.push(byte);
        }
      } else if (entry.tag === 0xa434 && metadata.lensModel !== undefined) {
        const bytes = new TextEncoder().encode(metadata.lensModel + "\0");
        for (const byte of bytes) {
          exifSubIfd.push(byte);
        }
      }
    }

    return exifSubIfd;
  }

  private toRational(value: number): [number, number] {
    // Convert decimal to rational representation
    // Try to find a reasonable denominator
    const denominators = [1, 10, 100, 1000, 10000, 100000, 1000000];
    for (const den of denominators) {
      const num = Math.round(value * den);
      if (Math.abs(num / den - value) < 0.000001) {
        return [num, den];
      }
    }
    // Fallback
    return [Math.round(value * 1000000), 1000000];
  }

  private writeRational(
    output: number[],
    numerator: number,
    denominator: number,
  ): void {
    // Write as little endian
    output.push(
      numerator & 0xff,
      (numerator >> 8) & 0xff,
      (numerator >> 16) & 0xff,
      (numerator >> 24) & 0xff,
    );
    output.push(
      denominator & 0xff,
      (denominator >> 8) & 0xff,
      (denominator >> 16) & 0xff,
      (denominator >> 24) & 0xff,
    );
  }

  /**
   * Get the list of metadata fields supported by JPEG format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "creationDate",
      "description",
      "author",
      "copyright",
      "cameraMake",
      "cameraModel",
      "orientation",
      "software",
      "latitude",
      "longitude",
      "iso",
      "exposureTime",
      "fNumber",
      "focalLength",
      "flash",
      "whiteBalance",
      "lensMake",
      "lensModel",
      "userComment",
      "dpiX",
      "dpiY",
    ];
  }

  /**
   * Extract metadata from JPEG data without fully decoding the pixel data
   * This quickly parses JFIF and EXIF markers to extract metadata
   * @param data Raw JPEG data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) {
      return Promise.resolve(undefined);
    }

    // Parse JPEG structure to extract metadata
    let pos = 2; // Skip initial FF D8
    const metadata: ImageMetadata = {};
    let width = 0;
    let height = 0;

    while (pos < data.length - 1) {
      if (data[pos] !== 0xff) {
        pos++;
        continue;
      }

      const marker = data[pos + 1];
      pos += 2;

      // SOF markers (Start of Frame) - get dimensions for DPI calculation
      if (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        const length = (data[pos] << 8) | data[pos + 1];
        // precision at pos+2
        height = (data[pos + 3] << 8) | data[pos + 4];
        width = (data[pos + 5] << 8) | data[pos + 6];
        // Don't break - continue parsing for metadata
        pos += length;
        continue;
      }

      // APP0 marker (JFIF)
      if (marker === 0xe0) {
        const length = (data[pos] << 8) | data[pos + 1];
        const appData = data.slice(pos + 2, pos + length);
        this.parseJFIF(appData, metadata, width, height);
        pos += length;
        continue;
      }

      // APP1 marker (EXIF)
      if (marker === 0xe1) {
        const length = (data[pos] << 8) | data[pos + 1];
        const appData = data.slice(pos + 2, pos + length);
        this.parseEXIF(appData, metadata);
        pos += length;
        continue;
      }

      // Skip other markers
      if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS
      if (marker >= 0xd0 && marker <= 0xd8) continue; // RST markers have no length
      if (marker === 0x01) continue; // TEM has no length

      const length = (data[pos] << 8) | data[pos + 1];
      pos += length;
    }

    return Promise.resolve(
      Object.keys(metadata).length > 0 ? metadata : undefined,
    );
  }
}
