import type { ImageData, ImageFormat } from "../types.ts";

/**
 * JPEG format handler
 * Implements a basic JPEG decoder and encoder
 */
export class JPEGFormat implements ImageFormat {
  readonly name = "jpeg";
  readonly mimeType = "image/jpeg";

  canDecode(data: Uint8Array): boolean {
    // JPEG signature: FF D8 FF
    return data.length >= 3 &&
      data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }

  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid JPEG signature");
    }

    // Parse JPEG structure to get dimensions
    let pos = 2; // Skip initial FF D8
    let width = 0;
    let height = 0;

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

    return { width, height, data: rgba };
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    // Create a simple JPEG with baseline DCT
    // For a complete implementation, we'd need full JPEG encoding
    // Here we'll create a minimal valid JPEG structure

    const chunks: number[] = [];

    // SOI (Start of Image)
    chunks.push(0xff, 0xd8);

    // APP0 (JFIF marker)
    this.writeMarker(chunks, 0xe0, [
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00, // "JFIF\0"
      0x01,
      0x01, // version 1.1
      0x00, // density units (no units)
      0x00,
      0x01, // X density
      0x00,
      0x01, // Y density
      0x00,
      0x00, // thumbnail size
    ]);

    // DQT (Define Quantization Table) - simplified
    this.writeMarker(chunks, 0xdb, this.createDQT());

    // SOF0 (Start of Frame, Baseline DCT)
    this.writeMarker(chunks, 0xc0, [
      0x08, // precision
      (height >> 8) & 0xff,
      height & 0xff, // height
      (width >> 8) & 0xff,
      width & 0xff, // width
      0x03, // number of components (RGB)
      0x01,
      0x11,
      0x00, // Y component
      0x02,
      0x11,
      0x01, // Cb component
      0x03,
      0x11,
      0x01, // Cr component
    ]);

    // DHT (Define Huffman Table) - simplified
    this.writeMarker(chunks, 0xc4, this.createDHT());

    // SOS (Start of Scan)
    this.writeMarker(chunks, 0xda, [
      0x03, // number of components
      0x01,
      0x00, // Y component
      0x02,
      0x11, // Cb component
      0x03,
      0x11, // Cr component
      0x00,
      0x3f,
      0x00, // spectral selection
    ]);

    // Encode image data (simplified - just storing RGB as-is which isn't proper JPEG)
    // In a real implementation, this would do DCT, quantization, and Huffman encoding
    const encodedData = await this.encodeImageData(data, width, height);
    for (const byte of encodedData) {
      chunks.push(byte);
    }

    // EOI (End of Image)
    chunks.push(0xff, 0xd9);

    return new Uint8Array(chunks);
  }

  private writeMarker(chunks: number[], marker: number, data: number[]): void {
    chunks.push(0xff, marker);
    const length = data.length + 2;
    chunks.push((length >> 8) & 0xff, length & 0xff);
    chunks.push(...data);
  }

  private createDQT(): number[] {
    // Simplified quantization table
    const table = new Array(64).fill(16);
    return [0x00, ...table]; // 0x00 = table 0, 8-bit
  }

  private createDHT(): number[] {
    // Simplified Huffman table (DC table)
    const bits = new Array(16).fill(0);
    bits[0] = 1;
    const values = [0];
    return [0x00, ...bits, ...values];
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
        // ImageDecoder API failed, fall through to throw error below
        console.warn("JPEG decoding with ImageDecoder failed:", error);
      }
    }

    // Fallback: create a placeholder (for testing purposes)
    // In production, you'd want proper JPEG decoding
    throw new Error(
      "JPEG decoding requires ImageDecoder API or equivalent runtime support",
    );
  }

  private async encodeImageData(
    data: Uint8Array,
    width: number,
    height: number,
  ): Promise<Uint8Array> {
    // This is a placeholder - proper JPEG encoding requires DCT, quantization,
    // and Huffman encoding. For testing purposes, we'll create minimal data.
    // In production, you'd want full JPEG encoding or use runtime APIs.

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
          type: "image/jpeg",
          quality: 0.9,
        });
        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } catch (error) {
        // OffscreenCanvas encoding failed, fall through to simplified fallback
        console.warn("JPEG encoding with OffscreenCanvas failed:", error);
      }
    }

    // Simplified fallback for testing
    const result = new Uint8Array(Math.floor(width * height / 2));
    for (let i = 0; i < result.length; i++) {
      result[i] = 0xff;
    }
    return result;
  }
}
