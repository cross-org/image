import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";

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
      }
    } catch (_e) {
      // Ignore EXIF parsing errors
    }
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

    if (entries.length === 0) return [];

    // Build EXIF structure
    const exif: number[] = [];

    // Byte order marker (little endian)
    exif.push(0x49, 0x49); // "II"
    exif.push(0x2a, 0x00); // 42

    // Offset to IFD0 (8 bytes from start)
    exif.push(0x08, 0x00, 0x00, 0x00);

    // Number of entries
    exif.push(entries.length & 0xff, (entries.length >> 8) & 0xff);

    // Calculate data offset
    let dataOffset = 8 + 2 + entries.length * 12 + 4;

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

    return exif;
  }
}
