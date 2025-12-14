import type {
  ImageData,
  ImageDecoderOptions,
  ImageFormat,
  ImageMetadata,
  MultiFrameImageData,
} from "../types.ts";
import { GIFDecoder } from "../utils/gif_decoder.ts";
import { GIFEncoder } from "../utils/gif_encoder.ts";
import { validateImageDimensions } from "../utils/security.ts";
import { readUint16LE } from "../utils/byte_utils.ts";

/**
 * GIF format handler
 * Now includes pure-JS implementation with custom LZW compression/decompression
 *
 * Features:
 * - LZW compression/decompression
 * - Color quantization and palette generation for encoding
 * - Interlacing support
 * - Transparency support
 * - Multi-frame animation support (decoding and encoding)
 * - Falls back to runtime APIs when pure-JS fails
 */
export class GIFFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "gif";
  /** MIME type for GIF images */
  readonly mimeType = "image/gif";

  /**
   * Check if this format supports multiple frames (animations)
   * @returns true for GIF format
   */
  supportsMultipleFrames(): boolean {
    return true;
  }

  /**
   * Check if the given data is a GIF image
   * @param data Raw image data to check
   * @returns true if data has GIF signature
   */
  canDecode(data: Uint8Array): boolean {
    // GIF signature: "GIF87a" or "GIF89a"
    return data.length >= 6 &&
      data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && // "GIF"
      data[3] === 0x38 && // "8"
      (data[4] === 0x37 || data[4] === 0x39) && // "7" or "9"
      data[5] === 0x61; // "a"
  }

  /**
   * Decode GIF image data to RGBA (first frame only)
   * @param data Raw GIF image data
   * @returns Decoded image data with RGBA pixels of first frame
   */
  async decode(
    data: Uint8Array,
    settings?: ImageDecoderOptions,
  ): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid GIF signature");
    }

    // Try pure-JS decoder first with tolerant decoding enabled by default
    try {
      const decoder = new GIFDecoder(data, {
        tolerantDecoding: settings?.tolerantDecoding ?? true,
        onWarning: settings?.onWarning,
      });
      const result = decoder.decode();

      // Validate dimensions for security (prevent integer overflow and heap exhaustion)
      validateImageDimensions(result.width, result.height);

      // Extract metadata from comment extensions
      const metadata = this.extractGIFMetadata(data);

      return {
        width: result.width,
        height: result.height,
        data: result.data,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } catch (_error) {
      // Fall back to runtime decoder if pure-JS fails

      let pos = 6; // Skip "GIF89a" or "GIF87a"
      const width = readUint16LE(data, pos);
      pos += 2;
      const height = readUint16LE(data, pos);

      // Validate dimensions for security (prevent integer overflow and heap exhaustion)
      validateImageDimensions(width, height);

      const rgba = await this.decodeUsingRuntime(data, width, height);
      const metadata = this.extractGIFMetadata(data);

      return {
        width,
        height,
        data: rgba,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    }
  }

  private extractGIFMetadata(data: Uint8Array): ImageMetadata {
    const metadata: ImageMetadata = {};
    let pos = 6; // Skip "GIF89a" or "GIF87a"

    // Read logical screen descriptor
    pos += 4; // Skip width and height
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
            this.parseComment(comment.text, metadata);
          }
          pos = comment.endPos;
        } else if (label === 0xff) { // Application Extension
          const appData = this.readDataSubBlocks(data, pos);
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

    return metadata;
  }

  /**
   * Encode RGBA image data to GIF format (single frame)
   * @param imageData Image data to encode
   * @returns Encoded GIF image bytes
   */
  async encode(
    imageData: ImageData,
    _options?: unknown,
  ): Promise<Uint8Array> {
    const { width, height, data, metadata } = imageData;

    // Try pure-JS encoder first
    try {
      const encoder = new GIFEncoder(width, height, data);
      const encoded = encoder.encode();

      // Inject metadata if present
      if (metadata && Object.keys(metadata).length > 0) {
        const injected = this.injectMetadata(encoded, metadata);
        return injected;
      }

      return encoded;
    } catch (_error) {
      // Fall back to runtime encoding if pure-JS fails

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
        } catch (runtimeError) {
          throw new Error(`GIF encoding failed: ${runtimeError}`);
        }
      }

      throw new Error(
        "GIF encoding requires pure-JS support or OffscreenCanvas API",
      );
    }
  }

  /**
   * Decode all frames from an animated GIF
   */
  decodeFrames(
    data: Uint8Array,
    settings?: ImageDecoderOptions,
  ): Promise<MultiFrameImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid GIF signature");
    }

    try {
      const decoder = new GIFDecoder(data, {
        tolerantDecoding: settings?.tolerantDecoding ?? true,
        onWarning: settings?.onWarning,
      });
      const result = decoder.decodeAllFrames();

      // Extract metadata from comment extensions
      const metadata = this.extractGIFMetadata(data);

      return Promise.resolve({
        width: result.width,
        height: result.height,
        frames: result.frames.map((frame) => ({
          width: frame.width,
          height: frame.height,
          data: frame.data,
          frameMetadata: {
            left: frame.left,
            top: frame.top,
            // Convert GIF delay from centiseconds (1/100s) to milliseconds
            delay: frame.delay * 10,
            disposal: this.mapDisposalMethod(frame.disposal),
          },
        })),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    } catch (error) {
      throw new Error(`GIF multi-frame decoding failed: ${error}`);
    }
  }

  /**
   * Encode multi-frame image data to animated GIF
   */
  encodeFrames(
    imageData: MultiFrameImageData,
    _options?: unknown,
  ): Promise<Uint8Array> {
    if (imageData.frames.length === 0) {
      throw new Error("No frames to encode");
    }

    const encoder = new GIFEncoder(imageData.width, imageData.height);

    for (const frame of imageData.frames) {
      // Get delay from metadata (default to 100ms if not set)
      const delay = frame.frameMetadata?.delay ?? 100;
      encoder.addFrame(frame.data, delay);
    }

    return Promise.resolve(encoder.encode());
  }

  private mapDisposalMethod(
    disposal: number,
  ): "none" | "background" | "previous" {
    switch (disposal) {
      case 0:
      case 1:
        return "none";
      case 2:
        return "background";
      case 3:
        return "previous";
      default:
        return "none";
    }
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

  /**
   * Get the list of metadata fields supported by GIF format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "title", // Comment extension
      "description", // Comment extension
      "author", // Comment extension
      "copyright", // Comment extension
      "frameCount", // Animation frames
    ];
  }

  /**
   * Extract metadata from GIF data without fully decoding the pixel data
   * This quickly parses GIF structure to extract metadata including frame count
   * @param data Raw GIF data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) {
      return Promise.resolve(undefined);
    }

    const metadata: ImageMetadata = {
      format: "gif",
      compression: "lzw",
      frameCount: 0,
      bitDepth: 8,
      colorType: "indexed",
    };

    let pos = 6; // Skip "GIF89a" or "GIF87a"

    // Read Logical Screen Descriptor
    const _width = readUint16LE(data, pos);
    pos += 2;
    const _height = readUint16LE(data, pos);
    pos += 2;
    const packed = data[pos++];
    const _backgroundColorIndex = data[pos++];
    const _aspectRatio = data[pos++];

    // Parse packed fields
    const hasGlobalColorTable = (packed & 0x80) !== 0;
    const globalColorTableSize = 2 << (packed & 0x07);

    // Skip global color table if present
    if (hasGlobalColorTable) {
      pos += globalColorTableSize * 3;
    }

    // Parse data stream to count frames and extract metadata
    while (pos < data.length) {
      const separator = data[pos++];

      if (separator === 0x21) {
        // Extension
        const label = data[pos++];

        if (label === 0xf9) {
          // Graphics Control Extension - indicates a frame
          metadata.frameCount!++;
          // Skip block
          const blockSize = data[pos++];
          pos += blockSize;
          pos++; // Block terminator
        } else if (label === 0xfe) {
          // Comment Extension
          const commentResult = this.readDataSubBlocks(data, pos);
          pos = commentResult.endPos;
          this.parseGIFCommentMetadata(commentResult.text, metadata);
        } else if (label === 0xff) {
          // Application Extension
          const blockSize = data[pos++];
          pos += blockSize;
          // Skip sub-blocks
          pos += this.getSubBlocksSize(data, pos);
        } else {
          // Other extension - skip sub-blocks
          pos += this.getSubBlocksSize(data, pos);
        }
      } else if (separator === 0x2c) {
        // Image Descriptor - frame data
        if (metadata.frameCount === 0) {
          metadata.frameCount = 1;
        }
        pos += 8; // Skip left, top, width, height
        const localPacked = data[pos++];
        const hasLocalColorTable = (localPacked & 0x80) !== 0;
        if (hasLocalColorTable) {
          const localColorTableSize = 2 << (localPacked & 0x07);
          pos += localColorTableSize * 3;
        }
        // Skip LZW minimum code size
        pos++;
        // Skip image data sub-blocks
        pos += this.getSubBlocksSize(data, pos);
      } else if (separator === 0x3b) {
        // Trailer - end of GIF
        break;
      } else if (separator === 0x00) {
        // Padding - skip
        continue;
      } else {
        // Unknown - try to continue
        break;
      }
    }

    // If no frames were counted, assume at least 1
    if (metadata.frameCount === 0) {
      metadata.frameCount = 1;
    }

    return Promise.resolve(
      Object.keys(metadata).length > 0 ? metadata : undefined,
    );
  }

  private getSubBlocksSize(data: Uint8Array, pos: number): number {
    let size = 0;
    while (pos + size < data.length) {
      const blockSize = data[pos + size];
      size++; // For block size byte
      if (blockSize === 0) break;
      size += blockSize;
    }
    return size;
  }

  private parseGIFCommentMetadata(
    commentText: string,
    metadata: ImageMetadata,
  ): void {
    const lines = commentText.split("\n");
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key === "Title") metadata.title = value;
        else if (key === "Description") metadata.description = value;
        else if (key === "Author") metadata.author = value;
        else if (key === "Copyright") metadata.copyright = value;
      }
    }
  }
}
