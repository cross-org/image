import type { ImageData, ImageFormat } from "../types.ts";

/**
 * GIF format handler
 * Implements a basic GIF decoder and encoder
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

    // Use runtime decoder for full GIF support
    const rgba = await this.decodeUsingRuntime(data, width, height);

    return { width, height, data: rgba };
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    // GIF encoding is complex due to LZW compression and color quantization
    // We'll use runtime encoding if available
    const { width, height, data } = imageData;

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
        return new Uint8Array(arrayBuffer);
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
}
