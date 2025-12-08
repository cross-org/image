import type {
  ImageData,
  ImageFormat,
  ImageMetadata,
  WebPEncodeOptions,
} from "../types.ts";

// Default quality for WebP encoding when not specified
const DEFAULT_WEBP_QUALITY = 90;

/**
 * WebP format handler
 * Implements a basic WebP decoder and encoder
 */
export class WebPFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "webp";
  /** MIME type for WebP images */
  readonly mimeType = "image/webp";

  /**
   * Check if the given data is a WebP image
   * @param data Raw image data to check
   * @returns true if data has WebP signature
   */
  canDecode(data: Uint8Array): boolean {
    // WebP signature: "RIFF" + size + "WEBP"
    return data.length >= 12 &&
      data[0] === 0x52 && data[1] === 0x49 && // "RI"
      data[2] === 0x46 && data[3] === 0x46 && // "FF"
      data[8] === 0x57 && data[9] === 0x45 && // "WE"
      data[10] === 0x42 && data[11] === 0x50; // "BP"
  }

  /**
   * Decode WebP image data to RGBA
   * @param data Raw WebP image data
   * @returns Decoded image data with RGBA pixels
   */
  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid WebP signature");
    }

    // Parse WebP structure
    let pos = 12; // Skip RIFF header
    let width = 0;
    let height = 0;
    const metadata: ImageMetadata = {};

    // Read all chunks to extract metadata
    while (pos + 8 <= data.length) {
      const chunkType = String.fromCharCode(
        data[pos],
        data[pos + 1],
        data[pos + 2],
        data[pos + 3],
      );
      const chunkSize = this.readUint32LE(data, pos + 4);
      pos += 8;

      // Stop if we've gone past the end
      if (pos + chunkSize > data.length) break;

      const chunkData = data.slice(pos, pos + chunkSize);

      if (chunkType === "VP8 ") {
        // Lossy format - extract dimensions
        if (chunkData.length >= 10) {
          const frameTag = chunkData[0] | (chunkData[1] << 8) |
            (chunkData[2] << 16);
          const keyFrame = (frameTag & 1) === 0;
          if (
            keyFrame && chunkData[3] === 0x9d && chunkData[4] === 0x01 &&
            chunkData[5] === 0x2a
          ) {
            width = chunkData[6] | ((chunkData[7] & 0x3f) << 8);
            height = chunkData[8] | ((chunkData[9] & 0x3f) << 8);
          }
        }
      } else if (chunkType === "VP8L") {
        // Lossless format - extract dimensions
        if (chunkData.length >= 5 && chunkData[0] === 0x2f) {
          const bits = this.readUint32LE(chunkData, 1);
          width = (bits & 0x3fff) + 1;
          height = ((bits >> 14) & 0x3fff) + 1;
        }
      } else if (chunkType === "VP8X") {
        // Extended format - extract dimensions
        if (chunkData.length >= 10) {
          width = this.readUint24LE(chunkData, 4) + 1;
          height = this.readUint24LE(chunkData, 7) + 1;
        }
      } else if (chunkType === "EXIF") {
        // EXIF metadata chunk
        this.parseEXIF(chunkData, metadata);
      } else if (chunkType === "XMP ") {
        // XMP metadata chunk
        this.parseXMP(chunkData, metadata);
      }

      pos += chunkSize;
      // Chunks are padded to even length
      if (chunkSize % 2 === 1) pos++;
    }

    if (width === 0 || height === 0) {
      throw new Error("Could not determine WebP dimensions");
    }

    // For a pure JS implementation, we'd need to implement full WebP decoding
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
   * Encode RGBA image data to WebP format
   * @param imageData Image data to encode
   * @param options Optional WebP encoding options
   * @returns Encoded WebP image bytes
   */
  async encode(
    imageData: ImageData,
    options?: WebPEncodeOptions,
  ): Promise<Uint8Array> {
    const { width, height, data, metadata } = imageData;
    const quality = options?.quality ?? DEFAULT_WEBP_QUALITY;
    const forceLossless = options?.lossless ?? false;

    // Determine if we should use lossless encoding
    // Use lossless if: quality is 100, or lossless flag is set
    const useLossless = quality === 100 || forceLossless;

    // Try to use runtime encoding if available (better quality and compression)
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
            type: "image/webp",
            quality: quality / 100, // Convert 1-100 to 0-1
          });
          const arrayBuffer = await blob.arrayBuffer();
          const encoded = new Uint8Array(arrayBuffer);

          // Inject metadata if present
          if (metadata && Object.keys(metadata).length > 0) {
            const injected = this.injectMetadata(encoded, metadata);
            return injected;
          }

          return encoded;
        }
      } catch (_error) {
        // Fall through to pure JS encoder
      }
    }

    // Fallback to pure JavaScript encoder
    // VP8L (lossless) encoder with optional quality-based quantization
    const { WebPEncoder } = await import("../utils/webp_encoder.ts");
    const encoder = new WebPEncoder(width, height, data);
    const encoded = encoder.encode(useLossless ? 100 : quality);

    // Inject metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      return this.injectMetadata(encoded, metadata);
    }

    return encoded;
  }

  private readUint32LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8) |
      (data[offset + 2] << 16) | (data[offset + 3] << 24);
  }

  private readUint24LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
  }

  private async decodeUsingRuntime(
    data: Uint8Array,
    _width: number,
    _height: number,
  ): Promise<Uint8Array> {
    // Try to use ImageDecoder API if available (Deno, modern browsers)
    if (typeof ImageDecoder !== "undefined") {
      try {
        const decoder = new ImageDecoder({ data, type: "image/webp" });
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
          "WebP decoding with ImageDecoder failed, using pure JS decoder:",
          error,
        );
      }
    }

    // Fallback to pure JavaScript decoder (VP8L lossless only)
    try {
      const { WebPDecoder } = await import("../utils/webp_decoder.ts");
      const decoder = new WebPDecoder(data);
      const result = decoder.decode();
      return result.data;
    } catch (error) {
      throw new Error(
        `WebP decoding failed: ${error}`,
      );
    }
  }

  // Metadata parsing and injection methods

  private parseEXIF(data: Uint8Array, metadata: ImageMetadata): void {
    // EXIF data parsing (similar to JPEG/PNG EXIF parsing)
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

      // Parse basic EXIF tags (simplified version)
      for (let i = 0; i < numEntries && i < 50; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        // DateTime tag
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
      // Ignore EXIF parsing errors
    }
  }

  private parseXMP(data: Uint8Array, metadata: ImageMetadata): void {
    // XMP is XML-based metadata - simple parsing for common fields
    try {
      const xmpStr = new TextDecoder().decode(data);

      // Extract title
      const titleMatch = xmpStr.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
      if (titleMatch) metadata.title = titleMatch[1].trim();

      // Extract description
      const descMatch = xmpStr.match(
        /<dc:description[^>]*>([^<]+)<\/dc:description>/,
      );
      if (descMatch) metadata.description = descMatch[1].trim();

      // Extract creator/author
      const creatorMatch = xmpStr.match(
        /<dc:creator[^>]*>([^<]+)<\/dc:creator>/,
      );
      if (creatorMatch) metadata.author = creatorMatch[1].trim();

      // Extract rights/copyright
      const rightsMatch = xmpStr.match(/<dc:rights[^>]*>([^<]+)<\/dc:rights>/);
      if (rightsMatch) metadata.copyright = rightsMatch[1].trim();
    } catch (_e) {
      // Ignore XMP parsing errors
    }
  }

  private injectMetadata(
    webpData: Uint8Array,
    metadata: ImageMetadata,
  ): Uint8Array {
    // WebP files are RIFF containers: RIFF + size + WEBP + chunks
    // We need to inject EXIF and/or XMP chunks before the image data

    const chunks: Uint8Array[] = [];

    // Copy RIFF header (12 bytes)
    chunks.push(webpData.slice(0, 12));

    // Create metadata chunks
    const metadataChunks: Uint8Array[] = [];

    // Create EXIF chunk if we have date or other EXIF data
    if (metadata.creationDate) {
      const exifData = this.createEXIFChunk(metadata);
      if (exifData) {
        metadataChunks.push(exifData);
      }
    }

    // Create XMP chunk if we have text metadata
    if (
      metadata.title || metadata.description || metadata.author ||
      metadata.copyright
    ) {
      const xmpData = this.createXMPChunk(metadata);
      if (xmpData) {
        metadataChunks.push(xmpData);
      }
    }

    // Copy original chunks (skip header)
    let pos = 12;
    while (pos + 8 <= webpData.length) {
      const chunkType = String.fromCharCode(
        webpData[pos],
        webpData[pos + 1],
        webpData[pos + 2],
        webpData[pos + 3],
      );
      const chunkSize = this.readUint32LE(webpData, pos + 4);

      // Don't copy existing EXIF/XMP chunks (we'll add new ones)
      if (chunkType !== "EXIF" && chunkType !== "XMP ") {
        const chunkEnd = pos + 8 + chunkSize + (chunkSize % 2);
        chunks.push(webpData.slice(pos, chunkEnd));
      }

      pos += 8 + chunkSize;
      if (chunkSize % 2 === 1) pos++; // Padding
    }

    // Insert metadata chunks after VP8/VP8L/VP8X chunk
    const result: Uint8Array[] = [chunks[0]]; // RIFF header
    if (chunks.length > 1) {
      result.push(chunks[1]); // First chunk (VP8/VP8L/VP8X)
    }
    result.push(...metadataChunks);
    for (let i = 2; i < chunks.length; i++) {
      result.push(chunks[i]);
    }

    // Recalculate total size
    const totalSize = result.reduce((sum, chunk) => sum + chunk.length, 0) - 8;
    const finalData = new Uint8Array(totalSize + 8);

    // Write RIFF header with updated size
    finalData.set(new TextEncoder().encode("RIFF"), 0);
    finalData[4] = totalSize & 0xff;
    finalData[5] = (totalSize >> 8) & 0xff;
    finalData[6] = (totalSize >> 16) & 0xff;
    finalData[7] = (totalSize >> 24) & 0xff;
    finalData.set(new TextEncoder().encode("WEBP"), 8);

    // Copy all chunks
    let offset = 12;
    for (let i = 1; i < result.length; i++) {
      finalData.set(result[i], offset);
      offset += result[i].length;
    }

    return finalData;
  }

  private createEXIFChunk(metadata: ImageMetadata): Uint8Array | null {
    if (!metadata.creationDate) return null;

    const exifData: number[] = [];

    // Byte order marker (little endian)
    exifData.push(0x49, 0x49); // "II"
    exifData.push(0x2a, 0x00); // 42

    // IFD0 offset
    exifData.push(0x08, 0x00, 0x00, 0x00);

    // Number of entries
    exifData.push(0x01, 0x00);

    // DateTime entry
    const date = metadata.creationDate;
    const dateStr = `${date.getFullYear()}:${
      String(date.getMonth() + 1).padStart(2, "0")
    }:${String(date.getDate()).padStart(2, "0")} ${
      String(date.getHours()).padStart(2, "0")
    }:${String(date.getMinutes()).padStart(2, "0")}:${
      String(date.getSeconds()).padStart(2, "0")
    }\0`;
    const dateBytes = new TextEncoder().encode(dateStr);

    // Tag 0x0132, Type 2 (ASCII), Count, Offset
    exifData.push(0x32, 0x01, 0x02, 0x00);
    exifData.push(
      dateBytes.length & 0xff,
      (dateBytes.length >> 8) & 0xff,
      (dateBytes.length >> 16) & 0xff,
      (dateBytes.length >> 24) & 0xff,
    );
    exifData.push(0x12, 0x00, 0x00, 0x00); // Offset to data

    // Next IFD
    exifData.push(0x00, 0x00, 0x00, 0x00);

    // Date string data
    for (const byte of dateBytes) {
      exifData.push(byte);
    }

    // Create chunk header
    const chunkData = new Uint8Array(exifData);
    const chunk = new Uint8Array(8 + chunkData.length);
    chunk.set(new TextEncoder().encode("EXIF"), 0);
    chunk[4] = chunkData.length & 0xff;
    chunk[5] = (chunkData.length >> 8) & 0xff;
    chunk[6] = (chunkData.length >> 16) & 0xff;
    chunk[7] = (chunkData.length >> 24) & 0xff;
    chunk.set(chunkData, 8);

    return chunk;
  }

  private createXMPChunk(metadata: ImageMetadata): Uint8Array | null {
    const xmpParts: string[] = [];
    xmpParts.push('<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>');
    xmpParts.push('<x:xmpmeta xmlns:x="adobe:ns:meta/">');
    xmpParts.push(
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    );
    xmpParts.push(
      '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">',
    );

    if (metadata.title) {
      xmpParts.push(`<dc:title>${this.escapeXML(metadata.title)}</dc:title>`);
    }
    if (metadata.description) {
      xmpParts.push(
        `<dc:description>${
          this.escapeXML(metadata.description)
        }</dc:description>`,
      );
    }
    if (metadata.author) {
      xmpParts.push(
        `<dc:creator>${this.escapeXML(metadata.author)}</dc:creator>`,
      );
    }
    if (metadata.copyright) {
      xmpParts.push(
        `<dc:rights>${this.escapeXML(metadata.copyright)}</dc:rights>`,
      );
    }

    xmpParts.push("</rdf:Description>");
    xmpParts.push("</rdf:RDF>");
    xmpParts.push("</x:xmpmeta>");
    xmpParts.push('<?xpacket end="w"?>');

    const xmpStr = xmpParts.join("\n");
    const xmpData = new TextEncoder().encode(xmpStr);

    // Create chunk
    const chunk = new Uint8Array(8 + xmpData.length);
    chunk.set(new TextEncoder().encode("XMP "), 0);
    chunk[4] = xmpData.length & 0xff;
    chunk[5] = (xmpData.length >> 8) & 0xff;
    chunk[6] = (xmpData.length >> 16) & 0xff;
    chunk[7] = (xmpData.length >> 24) & 0xff;
    chunk.set(xmpData, 8);

    return chunk;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
