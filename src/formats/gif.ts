import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";

/**
 * GIF format handler
 * Uses runtime APIs (ImageDecoder/OffscreenCanvas) for encoding/decoding.
 *
 * Pure-JS implementation not currently available due to complexity:
 * - Requires LZW compression/decompression
 * - Color quantization and palette generation for encoding
 * - Interlacing support
 * - Animation frame handling
 *
 * Note: Only decodes the first frame of animated GIFs
 */
export class GIFFormat implements ImageFormat {
  readonly name = "gif";
  readonly mimeType = "image/gif";

  canDecode(data: Uint8Array): boolean {
    // GIF signature: "GIF87a" or "GIF89a"
    return data.length >= 6 &&
      data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && // "GIF"
      data[3] === 0x38 && // "8"
      (data[4] === 0x37 || data[4] === 0x39) && // "7" or "9"
      data[5] === 0x61; // "a"
  }

  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid GIF signature");
    }

    // For a complete pure JS implementation, we'd need to implement LZW decompression
    // and handle all GIF features (animation, transparency, interlacing, etc.)
    // This is quite complex, so we'll use the runtime's decoder.

    let pos = 6; // Skip "GIF89a" or "GIF87a"

    // Read logical screen descriptor
    const width = this.readUint16LE(data, pos);
    pos += 2;
    const height = this.readUint16LE(data, pos);
    pos += 2;

    if (width === 0 || height === 0) {
      throw new Error("Invalid GIF dimensions");
    }

    // Extract metadata from comment extensions
    const metadata: ImageMetadata = {};

    // Skip packed fields, background color, aspect ratio
    const packed = data[pos++];
    const hasGlobalColorTable = (packed & 0x80) !== 0;
    const globalColorTableSize = 2 << (packed & 0x07);
    pos++; // background color
    pos++; // aspect ratio

    // Skip global color table if present
    if (hasGlobalColorTable) {
      pos += globalColorTableSize * 3;
    }

    // Parse extensions
    while (pos < data.length) {
      if (data[pos] === 0x21) { // Extension
        const label = data[pos + 1];
        pos += 2;

        if (label === 0xfe) { // Comment Extension
          const comment = this.readDataSubBlocks(data, pos);
          if (comment.text) {
            // Try to parse structured comment
            this.parseComment(comment.text, metadata);
          }
          pos = comment.endPos;
        } else if (label === 0xff) { // Application Extension
          const appData = this.readDataSubBlocks(data, pos);
          // Check for XMP data
          if (
            appData.text && appData.text.startsWith("XMP DataXMP") ||
            appData.text.includes("<?xpacket")
          ) {
            this.parseXMP(appData.text, metadata);
          }
          pos = appData.endPos;
        } else {
          // Skip other extensions
          while (pos < data.length && data[pos] !== 0) {
            const blockSize = data[pos++];
            pos += blockSize;
          }
          pos++; // Skip block terminator
        }
      } else if (data[pos] === 0x3b) { // Trailer
        break;
      } else {
        pos++;
      }
    }

    // Use runtime decoder for full GIF support
    const rgba = await this.decodeUsingRuntime(data, width, height);

    return {
      width,
      height,
      data: rgba,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    // GIF encoding is complex due to LZW compression and color quantization
    // We'll use runtime encoding if available
    const { width, height, data, metadata } = imageData;

    if (typeof OffscreenCanvas !== "undefined") {
      try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        const imgData = ctx.createImageData(width, height);
        const imgDataData = new Uint8ClampedArray(data);
        imgData.data.set(imgDataData);
        ctx.putImageData(imgData, 0, 0);

        const blob = await canvas.convertToBlob({
          type: "image/gif",
        });
        const arrayBuffer = await blob.arrayBuffer();
        const encoded = new Uint8Array(arrayBuffer);

        // Inject metadata if present
        if (metadata && Object.keys(metadata).length > 0) {
          const injected = this.injectMetadata(encoded, metadata);
          return injected;
        }

        return encoded;
      } catch (error) {
        throw new Error(`GIF encoding failed: ${error}`);
      }
    }

    throw new Error(
      "GIF encoding requires OffscreenCanvas API or equivalent runtime support",
    );
  }

  private readUint16LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
  }

  private async decodeUsingRuntime(
    data: Uint8Array,
    _width: number,
    _height: number,
  ): Promise<Uint8Array> {
    // Try to use ImageDecoder API if available (Deno, modern browsers)
    if (typeof ImageDecoder !== "undefined") {
      try {
        const decoder = new ImageDecoder({ data, type: "image/gif" });
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
        throw new Error(`GIF decoding failed: ${error}`);
      }
    }

    throw new Error(
      "GIF decoding requires ImageDecoder API or equivalent runtime support",
    );
  }

  // Metadata parsing and injection methods

  private readDataSubBlocks(
    data: Uint8Array,
    pos: number,
  ): { text: string; endPos: number } {
    const blocks: number[] = [];
    while (pos < data.length) {
      const blockSize = data[pos++];
      if (blockSize === 0) break;
      for (let i = 0; i < blockSize && pos < data.length; i++) {
        blocks.push(data[pos++]);
      }
    }
    return {
      text: new TextDecoder().decode(new Uint8Array(blocks)),
      endPos: pos,
    };
  }

  private parseComment(comment: string, metadata: ImageMetadata): void {
    // Try to parse structured comments like "Title: xxx" or JSON
    const lines = comment.split("\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        switch (key) {
          case "title":
            metadata.title = value;
            break;
          case "description":
            metadata.description = value;
            break;
          case "author":
          case "artist":
            metadata.author = value;
            break;
          case "copyright":
            metadata.copyright = value;
            break;
        }
      }
    }

    // If no structured data, use entire comment as description
    if (
      !metadata.title && !metadata.description && !metadata.author &&
      !metadata.copyright
    ) {
      metadata.description = comment.trim();
    }
  }

  private parseXMP(xmpStr: string, metadata: ImageMetadata): void {
    // Simple XMP parsing for common fields
    try {
      const titleMatch = xmpStr.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
      if (titleMatch) metadata.title = titleMatch[1].trim();

      const descMatch = xmpStr.match(
        /<dc:description[^>]*>([^<]+)<\/dc:description>/,
      );
      if (descMatch) metadata.description = descMatch[1].trim();

      const creatorMatch = xmpStr.match(
        /<dc:creator[^>]*>([^<]+)<\/dc:creator>/,
      );
      if (creatorMatch) metadata.author = creatorMatch[1].trim();

      const rightsMatch = xmpStr.match(/<dc:rights[^>]*>([^<]+)<\/dc:rights>/);
      if (rightsMatch) metadata.copyright = rightsMatch[1].trim();
    } catch (_e) {
      // Ignore XMP parsing errors
    }
  }

  private injectMetadata(
    gifData: Uint8Array,
    metadata: ImageMetadata,
  ): Uint8Array {
    // GIF structure: Header + Logical Screen Descriptor + [Global Color Table] + Data + Trailer
    // We'll inject a Comment Extension after the Logical Screen Descriptor

    const result: number[] = [];

    // Copy header and logical screen descriptor
    let pos = 0;
    for (let i = 0; i < 13; i++) {
      result.push(gifData[pos++]);
    }

    // Check if there's a global color table
    const packed = gifData[10];
    const hasGlobalColorTable = (packed & 0x80) !== 0;
    const globalColorTableSize = 2 << (packed & 0x07);

    // Copy global color table if present
    if (hasGlobalColorTable) {
      for (let i = 0; i < globalColorTableSize * 3; i++) {
        result.push(gifData[pos++]);
      }
    }

    // Inject Comment Extension with metadata
    const commentText = this.createCommentText(metadata);
    if (commentText) {
      result.push(0x21); // Extension Introducer
      result.push(0xfe); // Comment Label

      // Write comment in sub-blocks (max 255 bytes per block)
      const commentBytes = new TextEncoder().encode(commentText);
      for (let i = 0; i < commentBytes.length; i += 255) {
        const blockSize = Math.min(255, commentBytes.length - i);
        result.push(blockSize);
        for (let j = 0; j < blockSize; j++) {
          result.push(commentBytes[i + j]);
        }
      }
      result.push(0); // Block Terminator
    }

    // Copy rest of the GIF data
    while (pos < gifData.length) {
      result.push(gifData[pos++]);
    }

    return new Uint8Array(result);
  }

  private createCommentText(metadata: ImageMetadata): string | null {
    const parts: string[] = [];

    if (metadata.title) parts.push(`Title: ${metadata.title}`);
    if (metadata.description) {
      parts.push(`Description: ${metadata.description}`);
    }
    if (metadata.author) parts.push(`Author: ${metadata.author}`);
    if (metadata.copyright) parts.push(`Copyright: ${metadata.copyright}`);

    return parts.length > 0 ? parts.join("\n") : null;
  }
}
