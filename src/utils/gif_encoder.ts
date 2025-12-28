/**
 * Pure JavaScript GIF encoder implementation
 * Supports GIF89a format with LZW compression
 */

import { LZWEncoder } from "./lzw.ts";

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface GIFFrameData {
  data: Uint8Array;
  delay: number;
  left: number;
  top: number;
  width: number;
  height: number;
  disposal: number;
}

export class GIFEncoder {
  private canvasWidth: number;
  private canvasHeight: number;
  private frames: GIFFrameData[] = [];

  constructor(width: number, height: number, data?: Uint8Array) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    if (data) {
      this.addFrame(data);
    }
  }

  /**
   * Add a frame with optional metadata for partial frame support
   */
  addFrame(
    data: Uint8Array,
    delay: number = 0,
    options?: {
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      disposal?: number;
    },
  ): void {
    const pixelCount = data.length / 4;
    const frameWidth = options?.width ?? this.canvasWidth;
    const frameHeight = options?.height ?? Math.ceil(pixelCount / frameWidth);

    this.frames.push({
      data,
      delay,
      left: options?.left ?? 0,
      top: options?.top ?? 0,
      width: frameWidth,
      height: frameHeight,
      disposal: options?.disposal ?? 0,
    });
  }

  private writeBytes(output: number[], bytes: Uint8Array | number[]): void {
    output.push(...bytes);
  }

  private writeUint16LE(output: number[], value: number): void {
    output.push(value & 0xff);
    output.push((value >> 8) & 0xff);
  }

  private writeString(output: number[], str: string): void {
    for (let i = 0; i < str.length; i++) {
      output.push(str.charCodeAt(i));
    }
  }

  /**
   * Quantize a color channel value to a specified number of levels
   * @param value - The input color channel value (0-255)
   * @param levels - Number of quantization levels minus 1 (e.g., 7 for 8 levels)
   * @param step - Step size for quantization (e.g., 255/7)
   * @returns Quantized integer value
   */
  private quantizeChannel(value: number, levels: number, step: number): number {
    // First round to get quantization level (0-levels)
    // Then multiply by step size and round to ensure integer result
    return Math.round(Math.round(value * levels / 255) * step);
  }

  /**
   * Quantize RGBA image to 256 colors with transparency support
   */
  private quantize(
    data: Uint8Array,
    frameWidth: number,
    frameHeight: number,
  ): {
    palette: Uint8Array;
    indexed: Uint8Array;
    hasTransparency: boolean;
    transparentIndex: number;
  } {
    // Check for transparent pixels (alpha < 128)
    let hasTransparency = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 128) {
        hasTransparency = true;
        break;
      }
    }

    const colorMap = new Map<string, number>();
    const colors: RGBColor[] = [];
    const transparentIndex = 0;

    // Reserve index 0 for transparency if needed
    if (hasTransparency) {
      colors.push({ r: 0, g: 0, b: 0 });
    }

    // Color quantization parameters
    const RG_LEVELS = 7;
    const B_LEVELS = 3;
    const rgStep = 255 / RG_LEVELS;
    const bStep = 255 / B_LEVELS;
    const maxColors = hasTransparency ? 255 : 256;

    // Collect unique colors from opaque pixels only
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // Skip transparent

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${r},${g},${b}`;

      if (!colorMap.has(key) && colors.length < maxColors) {
        colorMap.set(key, colors.length);
        colors.push({ r, g, b });
      }
    }

    let useColorReduction = false;

    // If too many colors, reduce color depth
    if (colors.length >= maxColors) {
      colorMap.clear();
      colors.length = hasTransparency ? 1 : 0;
      useColorReduction = true;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;

        const r = this.quantizeChannel(data[i], RG_LEVELS, rgStep);
        const g = this.quantizeChannel(data[i + 1], RG_LEVELS, rgStep);
        const b = this.quantizeChannel(data[i + 2], B_LEVELS, bStep);
        const key = `${r},${g},${b}`;

        if (!colorMap.has(key) && colors.length < maxColors) {
          colorMap.set(key, colors.length);
          colors.push({ r, g, b });
        }
      }
    }

    // Pad to power of 2
    const paletteSize = Math.max(2, this.nextPowerOf2(colors.length));
    while (colors.length < paletteSize) {
      colors.push({ r: 0, g: 0, b: 0 });
    }

    // Create palette
    const palette = new Uint8Array(colors.length * 3);
    for (let i = 0; i < colors.length; i++) {
      palette[i * 3] = colors[i].r;
      palette[i * 3 + 1] = colors[i].g;
      palette[i * 3 + 2] = colors[i].b;
    }

    // Create indexed data using frame dimensions
    const indexed = new Uint8Array(frameWidth * frameHeight);
    for (let i = 0, j = 0; i < data.length && j < indexed.length; i += 4, j++) {
      // Handle transparent pixels
      if (data[i + 3] < 128) {
        indexed[j] = transparentIndex;
        continue;
      }

      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (useColorReduction) {
        r = this.quantizeChannel(r, RG_LEVELS, rgStep);
        g = this.quantizeChannel(g, RG_LEVELS, rgStep);
        b = this.quantizeChannel(b, B_LEVELS, bStep);
      }

      const key = `${r},${g},${b}`;

      if (colorMap.has(key)) {
        indexed[j] = colorMap.get(key)!;
      } else {
        // Find closest color
        let minDist = Infinity;
        let bestIdx = hasTransparency ? 1 : 0;

        for (let k = hasTransparency ? 1 : 0; k < colors.length; k++) {
          const dr = r - colors[k].r;
          const dg = g - colors[k].g;
          const db = b - colors[k].b;
          const dist = dr * dr + dg * dg + db * db;

          if (dist < minDist) {
            minDist = dist;
            bestIdx = k;
          }
        }

        indexed[j] = bestIdx;
      }
    }

    return { palette, indexed, hasTransparency, transparentIndex };
  }

  private nextPowerOf2(n: number): number {
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    return power;
  }

  private getBitsPerColor(paletteSize: number): number {
    let bits = 1;
    while ((1 << bits) < paletteSize) {
      bits++;
    }
    return Math.max(2, bits);
  }

  encode(options?: { loop?: number }): Uint8Array {
    if (this.frames.length === 0) {
      throw new Error("No frames to encode");
    }

    const output: number[] = [];
    const loopCount = options?.loop ?? 0;

    // Quantize first frame for Global Color Table
    const firstFrame = this.frames[0];
    const firstResult = this.quantize(
      firstFrame.data,
      firstFrame.width,
      firstFrame.height,
    );
    const globalPalette = firstResult.palette;
    const paletteSize = globalPalette.length / 3;
    const bitsPerColor = this.getBitsPerColor(paletteSize);

    // Header
    this.writeString(output, "GIF89a");

    // Logical Screen Descriptor
    this.writeUint16LE(output, this.canvasWidth);
    this.writeUint16LE(output, this.canvasHeight);

    const packed = 0x80 | ((bitsPerColor - 1) << 4) | (bitsPerColor - 1);
    output.push(packed);
    output.push(0); // Background Color Index
    output.push(0); // Pixel Aspect Ratio

    // Global Color Table
    const gctSize = 1 << bitsPerColor;
    const paddedPalette = new Uint8Array(gctSize * 3);
    paddedPalette.set(globalPalette);
    this.writeBytes(output, paddedPalette);

    // Netscape Application Extension (Looping)
    if (this.frames.length > 1) {
      output.push(0x21, 0xff, 11);
      this.writeString(output, "NETSCAPE2.0");
      output.push(3, 1);
      this.writeUint16LE(output, loopCount);
      output.push(0);
    }

    // Encode frames
    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      let indexed: Uint8Array;
      let useLocalPalette = false;
      let localPalette: Uint8Array | null = null;
      let localBitsPerColor = bitsPerColor;
      let hasTransparency: boolean;
      let transparentIndex: number;

      if (i === 0) {
        indexed = firstResult.indexed;
        hasTransparency = firstResult.hasTransparency;
        transparentIndex = firstResult.transparentIndex;
      } else {
        const result = this.quantize(frame.data, frame.width, frame.height);
        indexed = result.indexed;
        localPalette = result.palette;
        useLocalPalette = true;
        hasTransparency = result.hasTransparency;
        transparentIndex = result.transparentIndex;
        localBitsPerColor = this.getBitsPerColor(localPalette.length / 3);
      }

      // Graphic Control Extension
      output.push(0x21, 0xf9, 4);

      // Packed: disposal method + transparency flag
      const disposal = frame.disposal & 0x07;
      const gcePacked = (disposal << 2) | (hasTransparency ? 1 : 0);
      output.push(gcePacked);

      // Delay time
      const delay = frame.delay > 0 ? Math.round(frame.delay / 10) : 10;
      this.writeUint16LE(output, delay);

      // Transparent color index
      output.push(hasTransparency ? transparentIndex : 0);
      output.push(0); // Block Terminator

      // Image Descriptor
      output.push(0x2c);
      this.writeUint16LE(output, frame.left);
      this.writeUint16LE(output, frame.top);
      this.writeUint16LE(output, frame.width);
      this.writeUint16LE(output, frame.height);

      if (useLocalPalette && localPalette) {
        const lctPacked = 0x80 | (localBitsPerColor - 1);
        output.push(lctPacked);

        const lctSize = 1 << localBitsPerColor;
        const paddedLct = new Uint8Array(lctSize * 3);
        paddedLct.set(localPalette);
        this.writeBytes(output, paddedLct);
      } else {
        output.push(0);
      }

      // LZW compression
      const minCodeSize = Math.max(
        2,
        useLocalPalette ? localBitsPerColor : bitsPerColor,
      );
      output.push(minCodeSize);

      const encoder = new LZWEncoder(minCodeSize);
      const compressed = encoder.compress(indexed);

      for (let k = 0; k < compressed.length; k += 255) {
        const blockSize = Math.min(255, compressed.length - k);
        output.push(blockSize);
        for (let j = 0; j < blockSize; j++) {
          output.push(compressed[k + j]);
        }
      }

      output.push(0); // Block Terminator
    }

    output.push(0x3b); // Trailer
    return new Uint8Array(output);
  }
}
