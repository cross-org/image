import type { ImageData, ImageFormat } from "../types.ts";

/**
 * WebP format handler
 * Implements a basic WebP decoder and encoder
 */
export class WebPFormat implements ImageFormat {
  readonly name = "webp";
  readonly mimeType = "image/webp";

  canDecode(data: Uint8Array): boolean {
    // WebP signature: "RIFF" + size + "WEBP"
    return data.length >= 12 &&
      data[0] === 0x52 && data[1] === 0x49 && // "RI"
      data[2] === 0x46 && data[3] === 0x46 && // "FF"
      data[8] === 0x57 && data[9] === 0x45 && // "WE"
      data[10] === 0x42 && data[11] === 0x50; // "BP"
  }

  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid WebP signature");
    }

    // Parse WebP structure
    let pos = 12; // Skip RIFF header
    let width = 0;
    let height = 0;

    // Read first chunk to determine format
    if (pos + 4 < data.length) {
      const chunkType = String.fromCharCode(
        data[pos],
        data[pos + 1],
        data[pos + 2],
        data[pos + 3],
      );

      if (chunkType === "VP8 ") {
        // Lossy format
        const _chunkSize = this.readUint32LE(data, pos + 4);
        pos += 8;

        // Read VP8 bitstream header
        if (pos + 10 <= data.length) {
          // Frame tag
          const frameTag = data[pos] | (data[pos + 1] << 8) |
            (data[pos + 2] << 16);
          const keyFrame = (frameTag & 1) === 0;

          if (keyFrame) {
            // Start code
            if (
              data[pos + 3] === 0x9d && data[pos + 4] === 0x01 &&
              data[pos + 5] === 0x2a
            ) {
              width = data[pos + 6] | ((data[pos + 7] & 0x3f) << 8);
              height = data[pos + 8] | ((data[pos + 9] & 0x3f) << 8);
            }
          }
        }
      } else if (chunkType === "VP8L") {
        // Lossless format
        pos += 8;

        // Read VP8L signature and dimensions
        if (pos + 5 <= data.length && data[pos] === 0x2f) {
          const bits = this.readUint32LE(data, pos + 1);
          width = (bits & 0x3fff) + 1;
          height = ((bits >> 14) & 0x3fff) + 1;
        }
      } else if (chunkType === "VP8X") {
        // Extended format
        pos += 8;
        if (pos + 10 <= data.length) {
          width = this.readUint24LE(data, pos + 4) + 1;
          height = this.readUint24LE(data, pos + 7) + 1;
        }
      }
    }

    if (width === 0 || height === 0) {
      throw new Error("Could not determine WebP dimensions");
    }

    // For a pure JS implementation, we'd need to implement full WebP decoding
    // which is very complex. Instead, we'll use the browser/runtime's decoder.
    const rgba = await this.decodeUsingRuntime(data, width, height);

    return { width, height, data: rgba };
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    // Try to use runtime encoding if available
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
          type: "image/webp",
          quality: 0.9,
        });
        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } catch (error) {
        throw new Error(`WebP encoding failed: ${error}`);
      }
    }

    throw new Error(
      "WebP encoding requires OffscreenCanvas API or equivalent runtime support",
    );
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
        throw new Error(`WebP decoding failed: ${error}`);
      }
    }

    throw new Error(
      "WebP decoding requires ImageDecoder API or equivalent runtime support",
    );
  }
}
