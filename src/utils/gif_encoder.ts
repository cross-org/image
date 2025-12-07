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

export class GIFEncoder {
  private width: number;
  private height: number;
  private data: Uint8Array;

  constructor(width: number, height: number, data: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = data;
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
   * Quantize RGBA image to 256 colors using median cut algorithm
   */
  private quantize(): { palette: Uint8Array; indexed: Uint8Array } {
    // Simple quantization: collect unique colors and build palette
    const colorMap = new Map<string, number>();
    const colors: RGBColor[] = [];

    // Precompute quantization constants for color reduction
    const rgStep = 255 / 7; // For 3-bit channels (8 levels)
    const bStep = 255 / 3; // For 2-bit channel (4 levels)

    // Collect unique colors
    for (let i = 0; i < this.data.length; i += 4) {
      const r = this.data[i];
      const g = this.data[i + 1];
      const b = this.data[i + 2];
      const key = `${r},${g},${b}`;

      if (!colorMap.has(key) && colors.length < 256) {
        colorMap.set(key, colors.length);
        colors.push({ r, g, b });
      }
    }

    // Track if color reduction was applied
    let useColorReduction = false;

    // If we have too many colors, use simple color reduction
    if (colors.length >= 256) {
      // Downsample colors to 256 by reducing color depth
      colorMap.clear();
      colors.length = 0;
      useColorReduction = true;

      for (let i = 0; i < this.data.length; i += 4) {
        // Reduce color depth: 3 bits for R/G channels, 2 bits for B channel
        // This gives us 8 bits total = 256 possible colors
        // Quantize to levels, rounding to nearest
        // 3 bits = 8 levels (0-7), 2 bits = 4 levels (0-3)
        const r = Math.round(Math.round(this.data[i] * 7 / 255) * rgStep);
        const g = Math.round(Math.round(this.data[i + 1] * 7 / 255) * rgStep);
        const b = Math.round(Math.round(this.data[i + 2] * 3 / 255) * bStep);
        const key = `${r},${g},${b}`;

        if (!colorMap.has(key)) {
          if (colors.length < 256) {
            colorMap.set(key, colors.length);
            colors.push({ r, g, b });
          }
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

    // Create indexed data
    const indexed = new Uint8Array(this.width * this.height);
    for (let i = 0, j = 0; i < this.data.length; i += 4, j++) {
      let r = this.data[i];
      let g = this.data[i + 1];
      let b = this.data[i + 2];

      // Apply color reduction if it was used for building the palette
      if (useColorReduction) {
        r = Math.round(Math.round(r * 7 / 255) * rgStep);
        g = Math.round(Math.round(g * 7 / 255) * rgStep);
        b = Math.round(Math.round(b * 3 / 255) * bStep);
      }

      const key = `${r},${g},${b}`;

      // Try fast O(1) lookup first
      if (colorMap.has(key)) {
        indexed[j] = colorMap.get(key)!;
      } else {
        // Fallback: find closest color in palette (shouldn't happen often)
        let minDist = Infinity;
        let bestIdx = 0;

        for (let k = 0; k < colors.length; k++) {
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

    return { palette, indexed };
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

  encode(): Uint8Array {
    const output: number[] = [];

    // Quantize image
    const { palette, indexed } = this.quantize();
    const paletteSize = palette.length / 3;
    const bitsPerColor = this.getBitsPerColor(paletteSize);

    // Header
    this.writeString(output, "GIF89a");

    // Logical Screen Descriptor
    this.writeUint16LE(output, this.width);
    this.writeUint16LE(output, this.height);

    // Packed field:
    // - Global Color Table Flag (1 bit): 1
    // - Color Resolution (3 bits): bitsPerColor - 1
    // - Sort Flag (1 bit): 0
    // - Size of Global Color Table (3 bits): bitsPerColor - 1
    const packed = 0x80 | ((bitsPerColor - 1) << 4) | (bitsPerColor - 1);
    output.push(packed);

    // Background Color Index
    output.push(0);

    // Pixel Aspect Ratio
    output.push(0);

    // Global Color Table
    // The GCT size is 2^(n+1) where n is the value in the packed field
    // So we need to write that many colors, padding if necessary
    const gctSize = 1 << bitsPerColor;
    const paddedPalette = new Uint8Array(gctSize * 3);
    paddedPalette.set(palette);
    this.writeBytes(output, paddedPalette);

    // Image Descriptor
    output.push(0x2c); // Image Separator

    // Image position and dimensions
    this.writeUint16LE(output, 0); // Left
    this.writeUint16LE(output, 0); // Top
    this.writeUint16LE(output, this.width);
    this.writeUint16LE(output, this.height);

    // Packed field:
    // - Local Color Table Flag (1 bit): 0
    // - Interlace Flag (1 bit): 0
    // - Sort Flag (1 bit): 0
    // - Reserved (2 bits): 0
    // - Size of Local Color Table (3 bits): 0
    output.push(0);

    // LZW Minimum Code Size
    const minCodeSize = Math.max(2, bitsPerColor);
    output.push(minCodeSize);

    // Compress image data with LZW
    const encoder = new LZWEncoder(minCodeSize);
    const compressed = encoder.compress(indexed);

    // Write compressed data in sub-blocks (max 255 bytes per block)
    for (let i = 0; i < compressed.length; i += 255) {
      const blockSize = Math.min(255, compressed.length - i);
      output.push(blockSize);
      for (let j = 0; j < blockSize; j++) {
        output.push(compressed[i + j]);
      }
    }

    // Block Terminator
    output.push(0);

    // Trailer
    output.push(0x3b);

    return new Uint8Array(output);
  }
}
