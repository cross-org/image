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
  private frames: { data: Uint8Array; delay: number }[] = [];

  constructor(width: number, height: number, data?: Uint8Array) {
    this.width = width;
    this.height = height;
    if (data) {
      this.addFrame(data);
    }
  }

  addFrame(data: Uint8Array, delay: number = 0): void {
    this.frames.push({ data, delay });
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
   * Quantize RGBA image to 256 colors using median cut algorithm
   */
  private quantize(
    data: Uint8Array,
  ): { palette: Uint8Array; indexed: Uint8Array } {
    // Simple quantization: collect unique colors and build palette
    const colorMap = new Map<string, number>();
    const colors: RGBColor[] = [];

    // Color quantization parameters for 8-bit palette (256 colors)
    // R/G: 8 levels (0-7) using 3 bits, B: 4 levels (0-3) using 2 bits (8*8*4=256)
    const RG_LEVELS = 7; // Max level for R/G (8 total levels: 0-7)
    const B_LEVELS = 3; // Max level for B (4 total levels: 0-3)
    const rgStep = 255 / RG_LEVELS; // Step size for R/G quantization
    const bStep = 255 / B_LEVELS; // Step size for B quantization

    // Collect unique colors
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
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

      for (let i = 0; i < data.length; i += 4) {
        // Reduce color depth: 3 bits for R/G channels, 2 bits for B channel
        // This gives us 8 bits total = 256 possible colors
        const r = this.quantizeChannel(data[i], RG_LEVELS, rgStep);
        const g = this.quantizeChannel(data[i + 1], RG_LEVELS, rgStep);
        const b = this.quantizeChannel(data[i + 2], B_LEVELS, bStep);
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
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Apply color reduction if it was used for building the palette
      if (useColorReduction) {
        r = this.quantizeChannel(r, RG_LEVELS, rgStep);
        g = this.quantizeChannel(g, RG_LEVELS, rgStep);
        b = this.quantizeChannel(b, B_LEVELS, bStep);
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

  encode(options?: { loop?: number }): Uint8Array {
    if (this.frames.length === 0) {
      throw new Error("No frames to encode");
    }

    const output: number[] = [];

    // Get loop count from options (default to 0 = infinite)
    const loopCount = options?.loop ?? 0;

    // Quantize first frame for Global Color Table
    const firstFrame = this.frames[0];
    const { palette: globalPalette, indexed: firstIndexed } = this.quantize(
      firstFrame.data,
    );
    const paletteSize = globalPalette.length / 3;
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
    paddedPalette.set(globalPalette);
    this.writeBytes(output, paddedPalette);

    // Netscape Application Extension (Looping)
    if (this.frames.length > 1) {
      output.push(0x21); // Extension Introducer
      output.push(0xff); // Application Extension Label
      output.push(11); // Block Size
      this.writeString(output, "NETSCAPE2.0");
      output.push(3); // Sub-block Size
      output.push(1); // Loop Indicator (1 = loop)
      this.writeUint16LE(output, loopCount); // Loop Count (0 = infinite, 1+ = specific count)
      output.push(0); // Block Terminator
    }

    // Encode frames
    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      let indexed: Uint8Array;
      let useLocalPalette = false;
      let localPalette: Uint8Array | null = null;
      let localBitsPerColor = bitsPerColor;

      if (i === 0) {
        indexed = firstIndexed;
      } else {
        // Quantize subsequent frames
        // For simplicity, we use a Local Color Table for each frame to ensure colors are correct
        const result = this.quantize(frame.data);
        indexed = result.indexed;
        localPalette = result.palette;
        useLocalPalette = true;

        const localPaletteSize = localPalette.length / 3;
        localBitsPerColor = this.getBitsPerColor(localPaletteSize);
      }

      // Graphic Control Extension
      output.push(0x21); // Extension Introducer
      output.push(0xf9); // Graphic Control Label
      output.push(4); // Byte Size

      // Packed Field
      // Reserved (3 bits)
      // Disposal Method (3 bits): 2 (Restore to background) - usually safe for animation
      // User Input Flag (1 bit): 0
      // Transparent Color Flag (1 bit): 0
      output.push(0x08); // Disposal method 2 (Restore to background)

      // Delay Time (1/100ths of a second)
      // Default to 10 (100ms) if not specified
      const delay = frame.delay > 0 ? Math.round(frame.delay / 10) : 10;
      this.writeUint16LE(output, delay);

      // Transparent Color Index
      output.push(0);

      output.push(0); // Block Terminator

      // Image Descriptor
      output.push(0x2c); // Image Separator
      this.writeUint16LE(output, 0); // Left
      this.writeUint16LE(output, 0); // Top
      this.writeUint16LE(output, this.width);
      this.writeUint16LE(output, this.height);

      // Packed Field
      if (useLocalPalette && localPalette) {
        // LCT Flag: 1
        // Interlace: 0
        // Sort: 0
        // Reserved: 0
        // Size of LCT: localBitsPerColor - 1
        const lctPacked = 0x80 | (localBitsPerColor - 1);
        output.push(lctPacked);

        // Write Local Color Table
        const lctSize = 1 << localBitsPerColor;
        const paddedLct = new Uint8Array(lctSize * 3);
        paddedLct.set(localPalette);
        this.writeBytes(output, paddedLct);
      } else {
        output.push(0); // No LCT
      }

      // LZW Minimum Code Size
      const minCodeSize = Math.max(
        2,
        useLocalPalette ? localBitsPerColor : bitsPerColor,
      );
      output.push(minCodeSize);

      // Compress image data with LZW
      const encoder = new LZWEncoder(minCodeSize);
      const compressed = encoder.compress(indexed);

      // Write compressed data in sub-blocks (max 255 bytes per block)
      for (let k = 0; k < compressed.length; k += 255) {
        const blockSize = Math.min(255, compressed.length - k);
        output.push(blockSize);
        for (let j = 0; j < blockSize; j++) {
          output.push(compressed[k + j]);
        }
      }

      output.push(0); // Block Terminator
    }

    // Trailer
    output.push(0x3b);

    return new Uint8Array(output);
  }
}
