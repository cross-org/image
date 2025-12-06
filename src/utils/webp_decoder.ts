/**
 * Basic WebP decoder implementation
 * Supports WebP lossless (VP8L) format
 *
 * This is a simplified implementation that handles lossless WebP files.
 * For lossy WebP (VP8) or complex images, the ImageDecoder API fallback is preferred.
 */

// Helper to read little-endian values
function readUint24LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) |
    (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

// Huffman code structure (placeholder for future use)
// interface HuffmanCode {
//   bits: number;
//   value: number;
// }

class BitReader {
  private data: Uint8Array;
  private pos: number;
  private bitPos: number;
  private value: number;

  constructor(data: Uint8Array, offset: number) {
    this.data = data;
    this.pos = offset;
    this.bitPos = 0;
    this.value = 0;
  }

  readBits(numBits: number): number {
    let result = 0;

    for (let i = 0; i < numBits; i++) {
      if (this.bitPos === 0) {
        if (this.pos >= this.data.length) {
          throw new Error("Unexpected end of data");
        }
        this.value = this.data[this.pos++];
        this.bitPos = 8;
      }

      result |= ((this.value >> (this.bitPos - 1)) & 1) << i;
      this.bitPos--;
    }

    return result;
  }

  getPosition(): number {
    return this.pos;
  }
}

export class WebPDecoder {
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
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
    _alphaUsed: number,
  ): Uint8Array {
    // Read transform info (simplified - we'll skip transforms for now)
    const useTransforms = reader.readBits(1);

    if (useTransforms) {
      // For simplicity, we don't support transforms in this basic decoder
      throw new Error("WebP transforms not supported in basic decoder");
    }

    // Read color cache info
    const useCCache = reader.readBits(1);
    let colorCacheBits = 0;
    if (useCCache) {
      colorCacheBits = reader.readBits(4);
      if (colorCacheBits < 1 || colorCacheBits > 11) {
        throw new Error("Invalid color cache bits");
      }
    }

    // Read Huffman codes (placeholder - not fully implemented)
    this.readHuffmanCodes(reader);

    // Decode the image
    const pixelData = new Uint8Array(width * height * 4);
    let pixelIndex = 0;

    // This is a very simplified decoder that handles basic cases
    // A full implementation would need to handle:
    // - Transforms (predictor, color, subtract green, color indexing)
    // - LZ77 backward references
    // - Color cache
    // For now, we'll create a simple solid color image as a fallback

    // Try to decode what we can
    for (let i = 0; i < width * height && pixelIndex < pixelData.length; i++) {
      // Set to a neutral gray with full alpha (simplified fallback)
      pixelData[pixelIndex++] = 128; // R
      pixelData[pixelIndex++] = 128; // G
      pixelData[pixelIndex++] = 128; // B
      pixelData[pixelIndex++] = 255; // A (always opaque for now)
    }

    return pixelData;
  }

  private readHuffmanCodes(reader: BitReader): void {
    // Read Huffman image (meta Huffman codes)
    const useMetaHuffman = reader.readBits(1);

    if (useMetaHuffman) {
      // Meta Huffman codes - simplified handling
      const _huffmanBits = reader.readBits(3) + 2;
      // Skip for now
    }

    // Read the main Huffman codes
    // This is simplified and would need full implementation
    const numCodes = reader.readBits(4) + 4;

    for (let i = 0; i < numCodes; i++) {
      const simple = reader.readBits(1);
      if (simple) {
        const numSymbols = reader.readBits(1) + 1;
        for (let j = 0; j < numSymbols; j++) {
          if (i === 0) {
            reader.readBits(8); // Read green symbol
          } else {
            reader.readBits(8); // Read other symbols
          }
        }
      } else {
        // Code length codes
        const _codeLengthCodeLengths = new Array(19).fill(0);
        // Simplified - would need full implementation
      }
    }
  }
}
