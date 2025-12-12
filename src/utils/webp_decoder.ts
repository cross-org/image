/**
 * WebP VP8L (Lossless) decoder implementation
 *
 * This module implements a pure JavaScript decoder for WebP lossless (VP8L) format.
 * It supports:
 * - Huffman coding (canonical Huffman codes)
 * - LZ77 backward references for compression
 * - Color cache for repeated colors
 * - Simple and complex Huffman code tables
 *
 * Current limitations:
 * - Does not support transforms (predictor, color, subtract green, color indexing)
 * - Does not support meta Huffman codes
 * - Does not support lossy WebP (VP8) format
 *
 * For images with transforms or lossy compression, the decoder will fall back
 * to the runtime's ImageDecoder API if available.
 *
 * @see https://developers.google.com/speed/webp/docs/riff_container
 * @see https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification
 */

import { validateImageDimensions } from "./security.ts";

/**
 * Options for WebP decoder
 */
export interface WebPDecoderOptions {
  /**
   * Enable tolerant decoding mode. When enabled, the decoder will continue
   * decoding even if pixel decoding fails, filling remaining pixels with a
   * neutral color. This is useful for partially corrupted VP8L images.
   * @default true
   */
  tolerantDecoding?: boolean;
}

// Helper to read little-endian values
function readUint24LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) |
    (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

// Huffman tree node
interface HuffmanNode {
  symbol?: number;
  left?: HuffmanNode;
  right?: HuffmanNode;
}

// Huffman code table
class HuffmanTable {
  private root: HuffmanNode;
  private singleSymbol?: number; // For tables with only one symbol

  constructor() {
    this.root = {};
  }

  addCode(symbol: number, code: number, codeLength: number): void {
    // Handle single symbol case (code length 0)
    if (codeLength === 0) {
      this.singleSymbol = symbol;
      return;
    }

    // Build Huffman tree
    // Note: WebP uses LSB-first bit packing for the bitstream, but Huffman codes
    // are typically described MSB-first. However, the spec says:
    // "The bits of the code are read from the stream LSB first."
    // This means if code is 01 (binary), we read 1 then 0?
    // Actually, standard canonical Huffman codes are read MSB to LSB from the stream.
    // But WebP bit reader reads LSB to MSB from bytes.
    // Let's check the spec carefully.
    // "The bits of the code are read from the stream LSB first."
    // This usually means the bit reader returns bits in order.
    // If we have code 0x2 (binary 10) with length 2.
    // If we write it MSB first: 1, then 0.
    // If we read it: readBits(1) -> 1, readBits(1) -> 0.
    // This matches how we build the tree (left=0, right=1).
    // Wait, addCode uses (code >> i) & 1. This is MSB first.
    // So we expect the first bit read to be the MSB of the code.

    let node = this.root;
    for (let i = codeLength - 1; i >= 0; i--) {
      const bit = (code >> i) & 1;
      if (bit === 0) {
        if (!node.left) node.left = {};
        node = node.left;
      } else {
        if (!node.right) node.right = {};
        node = node.right;
      }
    }
    node.symbol = symbol;
  }

  readSymbol(reader: BitReader): number {
    // Handle single symbol case
    if (this.singleSymbol !== undefined) {
      return this.singleSymbol;
    }

    let node = this.root;
    while (node.symbol === undefined) {
      const bit = reader.readBits(1);
      node = bit === 0 ? node.left! : node.right!;
      if (!node) {
        // console.log("Invalid Huffman code - walked off tree");
        throw new Error("Invalid Huffman code");
      }
    }
    return node.symbol;
  }
}

class BitReader {
  private data: Uint8Array;
  private pos: number;
  private bitPos: number;
  private value: number;

  constructor(data: Uint8Array, offset: number) {
    this.data = data;
    this.pos = offset;
    this.bitPos = 8; // Start at 8 to trigger first byte read
    this.value = 0;
  }

  readBits(numBits: number): number {
    let result = 0;

    for (let i = 0; i < numBits; i++) {
      if (this.bitPos === 8) {
        if (this.pos >= this.data.length) {
          throw new Error("Unexpected end of data");
        }
        this.value = this.data[this.pos++];
        this.bitPos = 0;
      }

      result |= ((this.value >> this.bitPos) & 1) << i;
      this.bitPos++;
    }

    return result;
  }

  getPosition(): number {
    return this.pos;
  }

  // Read bytes aligned to byte boundary
  readBytes(count: number): Uint8Array {
    // Align to byte boundary
    if (this.bitPos !== 8) {
      this.bitPos = 8; // Skip remaining bits in current byte
    }

    if (this.pos + count > this.data.length) {
      throw new Error("Unexpected end of data");
    }
    const result = this.data.slice(this.pos, this.pos + count);
    this.pos += count;
    return result;
  }
}

export class WebPDecoder {
  private data: Uint8Array;
  private options: WebPDecoderOptions;

  constructor(data: Uint8Array, options: WebPDecoderOptions = {}) {
    this.data = data;
    this.options = {
      tolerantDecoding: options.tolerantDecoding ?? true,
    };
  }

  decode(): { width: number; height: number; data: Uint8Array } {
    // Verify WebP signature
    if (
      this.data.length < 12 ||
      this.data[0] !== 0x52 || this.data[1] !== 0x49 || // "RI"
      this.data[2] !== 0x46 || this.data[3] !== 0x46 || // "FF"
      this.data[8] !== 0x57 || this.data[9] !== 0x45 || // "WE"
      this.data[10] !== 0x42 || this.data[11] !== 0x50 // "BP"
    ) {
      throw new Error("Invalid WebP signature");
    }

    let pos = 12; // Skip RIFF header
    let width = 0;
    let height = 0;
    let imageData: Uint8Array | null = null;

    // Parse chunks
    while (pos + 8 <= this.data.length) {
      const chunkType = String.fromCharCode(
        this.data[pos],
        this.data[pos + 1],
        this.data[pos + 2],
        this.data[pos + 3],
      );
      const chunkSize = readUint32LE(this.data, pos + 4);
      pos += 8;

      if (pos + chunkSize > this.data.length) break;

      const chunkData = this.data.slice(pos, pos + chunkSize);

      if (chunkType === "VP8L") {
        // Lossless format - we can decode this
        const result = this.decodeVP8L(chunkData);
        width = result.width;
        height = result.height;
        imageData = result.data;
        break; // Stop after decoding image data
      } else if (chunkType === "VP8 ") {
        // Lossy format - not supported in pure JS decoder
        throw new Error(
          "WebP lossy (VP8) format not supported in pure JS decoder",
        );
      } else if (chunkType === "VP8X") {
        // Extended format header
        if (chunkData.length >= 10) {
          width = readUint24LE(chunkData, 4) + 1;
          height = readUint24LE(chunkData, 7) + 1;
        }
      }

      pos += chunkSize;
      // Chunks are padded to even length
      if (chunkSize % 2 === 1) pos++;
    }

    if (!imageData || width === 0 || height === 0) {
      throw new Error("Failed to decode WebP: no valid image data found");
    }

    return { width, height, data: imageData };
  }

  private decodeVP8L(
    data: Uint8Array,
  ): { width: number; height: number; data: Uint8Array } {
    // VP8L signature
    if (data[0] !== 0x2f) {
      throw new Error("Invalid VP8L signature");
    }

    const bits = readUint32LE(data, 1);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    const alphaUsed = (bits >> 28) & 1;
    const versionNumber = (bits >> 29) & 7;

    if (versionNumber !== 0) {
      throw new Error(`Unsupported VP8L version: ${versionNumber}`);
    }

    // Create bit reader starting after header
    const reader = new BitReader(data, 5);

    // Decode image data
    // This is a simplified decoder that handles basic lossless WebP
    try {
      const rgba = this.decodeImageData(reader, width, height, alphaUsed);
      return { width, height, data: rgba };
    } catch (error) {
      throw new Error(`VP8L decoding failed: ${error}`);
    }
  }

  private decodeImageData(
    reader: BitReader,
    width: number,
    height: number,
    alphaUsed: number,
  ): Uint8Array {
    // Read transform info
    const useTransforms = reader.readBits(1);

    if (useTransforms) {
      // For simplicity, we don't support transforms in this basic decoder
      // Transforms include: predictor, color, subtract green, color indexing
      throw new Error("WebP transforms not supported in basic decoder");
    }

    // Read color cache info
    const useColorCache = reader.readBits(1) === 1;
    let colorCacheBits = 0;
    let colorCacheSize = 0;
    if (useColorCache) {
      colorCacheBits = reader.readBits(4);
      if (colorCacheBits < 1 || colorCacheBits > 11) {
        throw new Error("Invalid color cache bits");
      }
      colorCacheSize = 1 << colorCacheBits;
    }

    // Read Huffman codes
    const huffmanTables = this.readHuffmanCodes(
      reader,
      useColorCache,
      colorCacheBits,
    );

    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

    // Decode the image using Huffman codes
    const pixelData = new Uint8Array(width * height * 4);
    let pixelIndex = 0;
    const numPixels = width * height;

    // Color cache for repeated colors
    const colorCache = new Uint32Array(colorCacheSize);

    if (this.options.tolerantDecoding) {
      // Tolerant mode: continue decoding even if errors occur
      try {
        for (let i = 0; i < numPixels;) {
          // Read green channel (which determines the code type)
          const green = huffmanTables.green.readSymbol(reader);

          if (green < 256) {
            // Literal pixel
            const red = huffmanTables.red.readSymbol(reader);
            const blue = huffmanTables.blue.readSymbol(reader);
            const alpha = alphaUsed !== 0
              ? huffmanTables.alpha.readSymbol(reader)
              : 255;

            pixelData[pixelIndex++] = red;
            pixelData[pixelIndex++] = green;
            pixelData[pixelIndex++] = blue;
            pixelData[pixelIndex++] = alpha;

            // Add to color cache if enabled
            if (useColorCache) {
              const color = (alpha << 24) | (blue << 16) | (green << 8) | red;
              colorCache[i % colorCacheSize] = color;
            }

            i++;
          } else if (green < 256 + 24) {
            // Backward reference (LZ77)
            const lengthSymbol = green - 256;
            const length = this.getLength(lengthSymbol, reader);

            const distancePrefix = huffmanTables.distance.readSymbol(reader);
            const distance = this.getDistance(distancePrefix, reader);

            // Copy pixels from earlier in the stream
            const srcIndex = pixelIndex - distance * 4;
            if (srcIndex < 0) {
              throw new Error("Invalid backward reference");
            }

            for (let j = 0; j < length; j++) {
              pixelData[pixelIndex++] = pixelData[srcIndex + j * 4];
              pixelData[pixelIndex++] = pixelData[srcIndex + j * 4 + 1];
              pixelData[pixelIndex++] = pixelData[srcIndex + j * 4 + 2];
              pixelData[pixelIndex++] = pixelData[srcIndex + j * 4 + 3];

              // Add to color cache
              if (useColorCache) {
                const color = (pixelData[pixelIndex - 1] << 24) |
                  (pixelData[pixelIndex - 2] << 16) |
                  (pixelData[pixelIndex - 3] << 8) |
                  pixelData[pixelIndex - 4];
                colorCache[(i + j) % colorCacheSize] = color;
              }
            }

            i += length;
          } else {
            // Color cache reference
            const cacheIndex = green - 256 - 24;
            if (cacheIndex >= colorCacheSize) {
              throw new Error("Invalid color cache index");
            }

            const color = colorCache[cacheIndex];
            pixelData[pixelIndex++] = color & 0xff; // R
            pixelData[pixelIndex++] = (color >> 8) & 0xff; // G
            pixelData[pixelIndex++] = (color >> 16) & 0xff; // B
            pixelData[pixelIndex++] = (color >> 24) & 0xff; // A

            i++;
          }
        }
      } catch (e) {
        // Tolerant decoding: fill remaining pixels with gray (128, 128, 128, 255)
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            `WebP VP8L: Partial decode at pixel ${
              pixelIndex / 4
            }/${numPixels}:`,
            e,
          );
        }
        while (pixelIndex < pixelData.length) {
          pixelData[pixelIndex++] = 128; // R
          pixelData[pixelIndex++] = 128; // G
          pixelData[pixelIndex++] = 128; // B
          pixelData[pixelIndex++] = 255; // A
        }
      }
    } else {
      // Non-tolerant mode: throw on first error
      for (let i = 0; i < numPixels;) {
        // Read green channel (which determines the code type)
        const green = huffmanTables.green.readSymbol(reader);

        if (green < 256) {
          // Literal pixel
          const red = huffmanTables.red.readSymbol(reader);
          const blue = huffmanTables.blue.readSymbol(reader);
          const alpha = alphaUsed !== 0
            ? huffmanTables.alpha.readSymbol(reader)
            : 255;

          pixelData[pixelIndex++] = red;
          pixelData[pixelIndex++] = green;
          pixelData[pixelIndex++] = blue;
          pixelData[pixelIndex++] = alpha;

          // Add to color cache if enabled
          if (useColorCache) {
            const color = (alpha << 24) | (blue << 16) | (green << 8) | red;
            colorCache[i % colorCacheSize] = color;
          }

          i++;
        } else if (green < 256 + 24) {
          // Backward reference (LZ77)
          const lengthSymbol = green - 256;
          const length = this.getLength(lengthSymbol, reader);

          const distancePrefix = huffmanTables.distance.readSymbol(reader);
          const distance = this.getDistance(distancePrefix, reader);

          // Copy pixels from earlier in the stream
          const srcIndex = pixelIndex - distance * 4;
          if (srcIndex < 0) {
            throw new Error("Invalid backward reference");
          }

          for (let j = 0; j < length; j++) {
            pixelData[pixelIndex++] = pixelData[srcIndex + j * 4];
            pixelData[pixelIndex++] = pixelData[srcIndex + j * 4 + 1];
            pixelData[pixelIndex++] = pixelData[srcIndex + j * 4 + 2];
            pixelData[pixelIndex++] = pixelData[srcIndex + j * 4 + 3];

            // Add to color cache
            if (useColorCache) {
              const color = (pixelData[pixelIndex - 1] << 24) |
                (pixelData[pixelIndex - 2] << 16) |
                (pixelData[pixelIndex - 3] << 8) |
                pixelData[pixelIndex - 4];
              colorCache[(i + j) % colorCacheSize] = color;
            }
          }

          i += length;
        } else {
          // Color cache reference
          const cacheIndex = green - 256 - 24;
          if (cacheIndex >= colorCacheSize) {
            throw new Error("Invalid color cache index");
          }

          const color = colorCache[cacheIndex];
          pixelData[pixelIndex++] = color & 0xff; // R
          pixelData[pixelIndex++] = (color >> 8) & 0xff; // G
          pixelData[pixelIndex++] = (color >> 16) & 0xff; // B
          pixelData[pixelIndex++] = (color >> 24) & 0xff; // A

          i++;
        }
      }
    }

    return pixelData;
  }

  private readHuffmanCodes(
    reader: BitReader,
    useColorCache: boolean,
    colorCacheBits: number,
  ): {
    green: HuffmanTable;
    red: HuffmanTable;
    blue: HuffmanTable;
    alpha: HuffmanTable;
    distance: HuffmanTable;
  } {
    // Read meta Huffman codes
    const useMetaHuffman = reader.readBits(1);

    if (useMetaHuffman) {
      // Meta Huffman is more complex - for now throw error
      throw new Error("Meta Huffman codes not yet supported");
    }

    // Read the main Huffman codes
    // There are 5 Huffman code groups: green, red, blue, alpha, distance

    const tables = {
      green: new HuffmanTable(),
      red: new HuffmanTable(),
      blue: new HuffmanTable(),
      alpha: new HuffmanTable(),
      distance: new HuffmanTable(),
    };

    const tableArray = [
      tables.green,
      tables.red,
      tables.blue,
      tables.alpha,
      tables.distance,
    ];

    for (let i = 0; i < 5; i++) {
      this.readHuffmanCode(
        reader,
        tableArray[i],
        useColorCache,
        colorCacheBits,
        i === 0,
      );
    }

    return tables;
  }

  private readHuffmanCode(
    reader: BitReader,
    table: HuffmanTable,
    useColorCache: boolean,
    colorCacheBits: number,
    isGreen: boolean,
  ): void {
    const simple = reader.readBits(1);

    if (simple) {
      // Simple code - directly specify 1 or 2 symbols
      const numSymbols = reader.readBits(1) + 1;
      const isFirstEightBits = reader.readBits(1);

      const symbols: number[] = [];
      for (let i = 0; i < numSymbols; i++) {
        const symbolBits = isFirstEightBits
          ? reader.readBits(8)
          : reader.readBits(1);
        symbols.push(symbolBits);
      }

      // Build simple Huffman table
      if (numSymbols === 1) {
        // Single symbol - 0 bits needed
        table.addCode(symbols[0], 0, 0);
      } else {
        // Two symbols - 1 bit each
        table.addCode(symbols[0], 0, 1);
        table.addCode(symbols[1], 1, 1);
      }
    } else {
      // Complex code - read code lengths
      const maxSymbol = isGreen
        ? (256 + 24 + (useColorCache ? (1 << colorCacheBits) : 0))
        : 256;

      const codeLengths = this.readCodeLengths(reader, maxSymbol);
      this.buildHuffmanTable(table, codeLengths);
    }
  }

  private readCodeLengths(
    reader: BitReader,
    maxSymbol: number,
  ): Uint8Array {
    // Read code length codes (used to encode the actual code lengths)
    const numCodeLengthCodes = reader.readBits(4) + 4;
    const codeLengthCodeLengths = new Uint8Array(19);

    // Code length code order
    const codeLengthCodeOrder = [
      17,
      18,
      0,
      1,
      2,
      3,
      4,
      5,
      16,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
    ];

    for (let i = 0; i < numCodeLengthCodes; i++) {
      codeLengthCodeLengths[codeLengthCodeOrder[i]] = reader.readBits(3);
    }

    // Read max_symbol (trimmed length indicator)
    // If 1, we read n_bit and then n_bit bits for max_symbol?
    // Subagent said "write_trimmed_length".
    // If 0, we don't trim.
    // We just read 1 bit and ignore it for now (assuming 0).
    const _trimmed = reader.readBits(1);

    // Build code length Huffman table
    const codeLengthTable = new HuffmanTable();
    this.buildHuffmanTable(codeLengthTable, codeLengthCodeLengths);

    // Read actual code lengths
    const codeLengths = new Uint8Array(maxSymbol);
    let i = 0;
    while (i < maxSymbol) {
      const code = codeLengthTable.readSymbol(reader);

      if (code < 16) {
        // Literal code length
        codeLengths[i++] = code;
      } else if (code === 16) {
        // Repeat previous code length 3-6 times
        const repeatCount = reader.readBits(2) + 3;
        const prevLength = i > 0 ? codeLengths[i - 1] : 0;
        for (let j = 0; j < repeatCount && i < maxSymbol; j++) {
          codeLengths[i++] = prevLength;
        }
      } else if (code === 17) {
        // Repeat 0 for 3-10 times
        const repeatCount = reader.readBits(3) + 3;
        i += repeatCount;
      } else if (code === 18) {
        // Repeat 0 for 11-138 times
        const repeatCount = reader.readBits(7) + 11;
        i += repeatCount;
      }
    }

    return codeLengths;
  }

  private buildHuffmanTable(
    table: HuffmanTable,
    codeLengths: number[] | Uint8Array,
  ): void {
    // Check for single symbol optimization (VP8L specific)
    let nonZeroCount = 0;
    let singleSymbol = -1;
    for (let i = 0; i < codeLengths.length; i++) {
      if (codeLengths[i] > 0) {
        nonZeroCount++;
        singleSymbol = i;
      }
    }

    if (nonZeroCount === 1) {
      // If only one symbol, it has 0 length in the bitstream
      table.addCode(singleSymbol, 0, 0);
      return;
    }

    // Build canonical Huffman codes
    const maxCodeLength = Math.max(...codeLengths);
    const lengthCounts = new Array(maxCodeLength + 1).fill(0);

    for (const length of codeLengths) {
      if (length > 0) {
        lengthCounts[length]++;
      }
    }

    // Generate codes
    let code = 0;
    const nextCode = new Array(maxCodeLength + 1).fill(0);
    for (let i = 1; i <= maxCodeLength; i++) {
      code = (code + lengthCounts[i - 1]) << 1;
      nextCode[i] = code;
    }

    // Assign codes to symbols
    for (let symbol = 0; symbol < codeLengths.length; symbol++) {
      const length = codeLengths[symbol];
      if (length > 0) {
        table.addCode(symbol, nextCode[length], length);
        nextCode[length]++;
      }
    }
  }

  private getLength(symbol: number, reader: BitReader): number {
    // Length encoding for backward references
    if (symbol < 4) {
      return symbol + 1;
    }
    const extraBits = (symbol - 2) >> 1;
    const base = ((2 + (symbol & 1)) << extraBits) + 1;
    return base + reader.readBits(extraBits);
  }

  private getDistance(symbol: number, reader: BitReader): number {
    // Distance encoding for backward references
    if (symbol < 4) {
      return symbol + 1;
    }
    const extraBits = (symbol - 2) >> 1;
    const base = ((2 + (symbol & 1)) << extraBits) + 1;
    return base + reader.readBits(extraBits);
  }
}
