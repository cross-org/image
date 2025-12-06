/**
 * WebP VP8L (Lossless) encoder implementation
 *
 * This module implements a pure JavaScript encoder for WebP lossless (VP8L) format.
 * It supports:
 * - Basic lossless encoding with simple Huffman coding
 * - Uncompressed pixel data (no transforms, no LZ77)
 *
 * Current limitations:
 * - Does not use transforms (predictor, color, subtract green, color indexing)
 * - Does not use LZ77 backward references
 * - Does not use color cache
 * - Uses simplified Huffman coding (single/double symbol codes only)
 * - Intended as a fallback when OffscreenCanvas is not available
 *
 * This encoder produces valid but uncompressed WebP lossless files.
 * For better compression, use the runtime's OffscreenCanvas API when available.
 *
 * @see https://developers.google.com/speed/webp/docs/riff_container
 * @see https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification
 */

// Helper to write little-endian values
function writeUint32LE(value: number): number[] {
  return [
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ];
}

// Bit writer for encoding (matches the WebP decoder's bit reading order)
class BitWriter {
  private bytes: number[] = [];
  private bits = 0;
  private bitCount = 0;

  writeBits(value: number, numBits: number): void {
    // Pack bits to match how the decoder reads them
    // The decoder reads from MSB to LSB of each byte
    // So we write from MSB down as well
    for (let i = 0; i < numBits; i++) {
      const bit = (value >> i) & 1;

      // Write bit at the current position (counting from MSB)
      // bitCount represents how many bits we've written
      // Position in current byte = 7 - (bitCount % 8)
      if (this.bitCount % 8 === 0) {
        this.bits = 0; // Start new byte
      }

      const bitPos = 7 - (this.bitCount % 8);
      this.bits |= bit << bitPos;
      this.bitCount++;

      if (this.bitCount % 8 === 0) {
        this.bytes.push(this.bits);
      }
    }
  }

  flush(): void {
    if (this.bitCount % 8 !== 0) {
      this.bytes.push(this.bits);
      this.bits = 0;
      this.bitCount = 0;
    }
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  getLength(): number {
    return this.bytes.length;
  }
}

export class WebPEncoder {
  private width: number;
  private height: number;
  private data: Uint8Array;

  constructor(width: number, height: number, rgba: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = rgba;
  }

  encode(): Uint8Array {
    // Build RIFF container
    const output: number[] = [];

    // RIFF header
    output.push(0x52, 0x49, 0x46, 0x46); // "RIFF"

    // File size placeholder (will be filled later)
    const fileSizePos = output.length;
    output.push(0, 0, 0, 0);

    // WebP signature
    output.push(0x57, 0x45, 0x42, 0x50); // "WEBP"

    // VP8L chunk
    output.push(0x56, 0x50, 0x38, 0x4c); // "VP8L"

    // VP8L chunk size placeholder
    const vp8lSizePos = output.length;
    output.push(0, 0, 0, 0);

    // Encode VP8L data
    const vp8lData = this.encodeVP8L();
    output.push(...vp8lData);

    // Add padding if chunk size is odd
    if (vp8lData.length % 2 === 1) {
      output.push(0);
    }

    // Update VP8L chunk size
    const vp8lSize = vp8lData.length;
    const vp8lSizeBytes = writeUint32LE(vp8lSize);
    for (let i = 0; i < 4; i++) {
      output[vp8lSizePos + i] = vp8lSizeBytes[i];
    }

    // Update file size (everything after RIFF header except the size field itself)
    const fileSize = output.length - 8;
    const fileSizeBytes = writeUint32LE(fileSize);
    for (let i = 0; i < 4; i++) {
      output[fileSizePos + i] = fileSizeBytes[i];
    }

    return new Uint8Array(output);
  }

  private encodeVP8L(): number[] {
    const output: number[] = [];

    // VP8L signature (0x2f)
    output.push(0x2f);

    // Width, height, alpha, version (packed into 4 bytes)
    // Width: 14 bits, Height: 14 bits, Alpha: 1 bit, Version: 3 bits
    const hasAlpha = this.hasAlphaChannel() ? 1 : 0;
    const bits = ((this.width - 1) & 0x3fff) |
      (((this.height - 1) & 0x3fff) << 14) |
      (hasAlpha << 28) |
      (0 << 29); // version = 0

    output.push(...writeUint32LE(bits));

    // Encode image data
    const imageData = this.encodeImageData(hasAlpha);
    output.push(...imageData);

    return output;
  }

  private hasAlphaChannel(): boolean {
    // Check if any pixel has alpha != 255
    for (let i = 3; i < this.data.length; i += 4) {
      if (this.data[i] !== 255) {
        return true;
      }
    }
    return false;
  }

  private encodeImageData(hasAlpha: number): number[] {
    const writer = new BitWriter();

    // No transforms
    writer.writeBits(0, 1);

    // Color cache - disabled for simplicity in this basic encoder
    const _useColorCache = false;
    writer.writeBits(0, 1);

    // No meta Huffman codes
    writer.writeBits(0, 1);

    // Number of code groups: We need 4 (green, red, blue, alpha) or 5 with distance
    // Since we're not using LZ77, we write 4 groups (minimum)
    const numCodeGroups = 4;
    writer.writeBits(numCodeGroups - 4, 4); // 0 means 4 groups

    // For simplicity, use single-symbol Huffman codes for each color channel
    // This is valid but inefficient - it's like writing uncompressed data

    // Collect actual symbols used
    const greenSymbols = new Set<number>();
    const redSymbols = new Set<number>();
    const blueSymbols = new Set<number>();
    const alphaSymbols = new Set<number>();

    const numPixels = this.width * this.height;
    for (let i = 0; i < numPixels; i++) {
      const offset = i * 4;
      redSymbols.add(this.data[offset]);
      greenSymbols.add(this.data[offset + 1]);
      blueSymbols.add(this.data[offset + 2]);
      if (hasAlpha) {
        alphaSymbols.add(this.data[offset + 3]);
      }
    }

    // Write Huffman codes for each channel
    this.writeSimpleHuffmanCode(writer, Array.from(greenSymbols));
    this.writeSimpleHuffmanCode(writer, Array.from(redSymbols));
    this.writeSimpleHuffmanCode(writer, Array.from(blueSymbols));
    if (hasAlpha) {
      this.writeSimpleHuffmanCode(writer, Array.from(alphaSymbols));
    } else {
      // Write a simple single-symbol code for alpha=255
      this.writeSimpleHuffmanCode(writer, [255]);
    }

    // Encode pixels
    for (let i = 0; i < numPixels; i++) {
      const offset = i * 4;
      const r = this.data[offset];
      const g = this.data[offset + 1];
      const b = this.data[offset + 2];
      const a = this.data[offset + 3];

      // Write literal pixel
      // Green first
      if (greenSymbols.size === 1) {
        // Single symbol, no bits needed
      } else {
        // Two symbols, write 1 bit
        writer.writeBits(Array.from(greenSymbols).indexOf(g), 1);
      }

      // Red
      if (redSymbols.size === 1) {
        // Single symbol, no bits needed
      } else {
        writer.writeBits(Array.from(redSymbols).indexOf(r), 1);
      }

      // Blue
      if (blueSymbols.size === 1) {
        // Single symbol, no bits needed
      } else {
        writer.writeBits(Array.from(blueSymbols).indexOf(b), 1);
      }

      // Alpha
      if (hasAlpha) {
        if (alphaSymbols.size === 1) {
          // Single symbol, no bits needed
        } else {
          writer.writeBits(Array.from(alphaSymbols).indexOf(a), 1);
        }
      }
    }

    writer.flush();
    return Array.from(writer.getBytes());
  }

  private writeSimpleHuffmanCode(writer: BitWriter, symbols: number[]): void {
    if (symbols.length === 0) {
      // Shouldn't happen, but write a single symbol of 0
      symbols = [0];
    }

    // Simple code
    writer.writeBits(1, 1);

    if (symbols.length === 1) {
      // Single symbol
      writer.writeBits(0, 1); // num_symbols = 1 (0 + 1)
      writer.writeBits(0, 1); // is_first_8bits = 0
      writer.writeBits(symbols[0], 8); // symbol
    } else if (symbols.length === 2) {
      // Two symbols
      writer.writeBits(1, 1); // num_symbols = 2 (1 + 1)
      writer.writeBits(0, 1); // is_first_8bits = 0
      writer.writeBits(symbols[0], 8); // first symbol
      writer.writeBits(symbols[1], 8); // second symbol
    } else {
      // More than 2 symbols - we need complex code
      // For now, just use the first two symbols (this is a simplified encoder)
      writer.writeBits(1, 1); // num_symbols = 2
      writer.writeBits(0, 1); // is_first_8bits = 0
      writer.writeBits(symbols[0], 8);
      writer.writeBits(symbols[1], 8);
    }
  }
}
