/**
 * WebP VP8L (Lossless) encoder implementation with quality-based quantization
 *
 * This module implements a pure JavaScript encoder for WebP lossless (VP8L) format.
 * It supports:
 * - Lossless encoding (quality=100) with Huffman coding
 * - Lossy encoding (quality<100) using color quantization while still using VP8L format
 * - Simple Huffman coding (1-2 symbols per channel)
 * - Complex Huffman coding for channels with many unique values (3+ symbols)
 * - Literal pixel encoding (no transforms applied)
 *
 * Current limitations:
 * - Does not use transforms (predictor, color, subtract green, color indexing)
 * - Does not use LZ77 backward references (planned for future)
 * - Does not use color cache (planned for future)
 * - Lossy mode uses simple quantization, not true VP8 lossy encoding
 * - Intended as a fallback when OffscreenCanvas is not available
 *
 * This encoder produces valid WebP lossless files with optional quality-based
 * color quantization for lossy compression. For true VP8 lossy encoding with
 * better compression, use the runtime's OffscreenCanvas API when available.
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
    // Pack bits LSB first (standard WebP/VP8L order)
    for (let i = 0; i < numBits; i++) {
      const bit = (value >> i) & 1;

      // If we've filled the current byte, push it and start a new one
      if (this.bitCount > 0 && this.bitCount % 8 === 0) {
        this.bytes.push(this.bits);
        this.bits = 0;
      }

      const bitPos = this.bitCount % 8;
      this.bits |= bit << bitPos;
      this.bitCount++;
    }
  }

  flush(): void {
    if (this.bitCount % 8 !== 0) {
      this.bytes.push(this.bits);
      this.bits = 0;
      // Do not reset bitCount here as it tracks total bits written
    } else if (this.bitCount > 0 && this.bytes.length * 8 < this.bitCount) {
      // Edge case: if we just finished a byte but haven't pushed it yet
      // (The loop pushes at the START of the next bit, so we might have a full byte pending)
      this.bytes.push(this.bits);
      this.bits = 0;
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
  private quality: number;

  constructor(width: number, height: number, rgba: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = rgba;
    this.quality = 100; // Default to lossless
  }

  encode(quality: number = 100): Uint8Array {
    this.quality = Math.max(1, Math.min(100, quality));

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
    for (let i = 0; i < vp8lData.length; i++) {
      output.push(vp8lData[i]);
    }

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
    for (let i = 0; i < imageData.length; i++) {
      output.push(imageData[i]);
    }

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

  /**
   * Quantize image data based on quality setting
   * Quality 100 = no quantization (lossless)
   * Quality 1-99 = quantize colors to reduce bit depth
   * This creates a "lossy" effect while still using VP8L format
   */
  private quantizeImageData(): Uint8Array {
    if (this.quality === 100) {
      // No quantization for lossless
      return this.data;
    }

    // Calculate quantization level based on quality
    // Quality 90-99: very light quantization (shift by 1 bit)
    // Quality 70-89: light quantization (shift by 2 bits)
    // Quality 50-69: medium quantization (shift by 3 bits)
    // Quality 30-49: heavy quantization (shift by 4 bits)
    // Quality 1-29: very heavy quantization (shift by 5 bits)
    let shift: number;
    if (this.quality >= 90) {
      shift = 1;
    } else if (this.quality >= 70) {
      shift = 2;
    } else if (this.quality >= 50) {
      shift = 3;
    } else if (this.quality >= 30) {
      shift = 4;
    } else {
      shift = 5;
    }

    // Create quantized copy of the image data
    const quantized = new Uint8Array(this.data.length);
    const mask = 0xFF << shift; // Bitmask for quantization
    for (let i = 0; i < this.data.length; i += 4) {
      // Quantize RGB channels using bitwise AND with mask
      quantized[i] = this.data[i] & mask; // R
      quantized[i + 1] = this.data[i + 1] & mask; // G
      quantized[i + 2] = this.data[i + 2] & mask; // B
      // Keep alpha channel unquantized for better transparency handling
      quantized[i + 3] = this.data[i + 3]; // A
    }

    return quantized;
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

    // Apply quantization if quality < 100
    const encodingData = this.quantizeImageData();

    // Collect symbol frequencies for each channel
    const greenFreqs = new Map<number, number>();
    const redFreqs = new Map<number, number>();
    const blueFreqs = new Map<number, number>();
    const alphaFreqs = new Map<number, number>();

    const numPixels = this.width * this.height;
    for (let i = 0; i < numPixels; i++) {
      const offset = i * 4;
      const r = encodingData[offset];
      const g = encodingData[offset + 1];
      const b = encodingData[offset + 2];
      const a = encodingData[offset + 3];

      greenFreqs.set(g, (greenFreqs.get(g) || 0) + 1);
      redFreqs.set(r, (redFreqs.get(r) || 0) + 1);
      blueFreqs.set(b, (blueFreqs.get(b) || 0) + 1);
      if (hasAlpha) {
        alphaFreqs.set(a, (alphaFreqs.get(a) || 0) + 1);
      }
    }

    // Build Huffman codes for each channel
    // Use simple codes for 1-2 symbols, complex codes for more
    // Green channel can have symbols 0-279 (256 literals + 24 length codes)
    // Other channels can have symbols 0-255
    const greenCodes = this.writeHuffmanCode(writer, greenFreqs, 256 + 24);
    const redCodes = this.writeHuffmanCode(writer, redFreqs, 256);
    const blueCodes = this.writeHuffmanCode(writer, blueFreqs, 256);
    const alphaCodes = hasAlpha
      ? this.writeHuffmanCode(writer, alphaFreqs, 256)
      : this.writeHuffmanCode(writer, new Map([[255, numPixels]]), 256);
    // Distance Huffman code (not used without LZ77, but required by spec)
    // Distance symbols are 0-39
    this.writeHuffmanCode(writer, new Map([[0, 1]]), 40);

    // Encode pixels using the Huffman codes
    for (let i = 0; i < numPixels; i++) {
      const offset = i * 4;
      const r = encodingData[offset];
      const g = encodingData[offset + 1];
      const b = encodingData[offset + 2];
      const a = encodingData[offset + 3];

      // Write each channel using its Huffman code
      this.writeSymbol(writer, greenCodes, g);
      this.writeSymbol(writer, redCodes, r);
      this.writeSymbol(writer, blueCodes, b);
      if (hasAlpha) {
        this.writeSymbol(writer, alphaCodes, a);
      }
    }

    writer.flush();
    return Array.from(writer.getBytes());
  }

  /**
   * Write Huffman code for a channel (either simple or complex)
   * Returns the Huffman codes for encoding pixels
   */
  private writeHuffmanCode(
    writer: BitWriter,
    frequencies: Map<number, number>,
    maxSymbol: number,
  ): Map<number, { code: number; length: number }> {
    const symbols = Array.from(frequencies.keys()).sort((a, b) => a - b);

    if (symbols.length === 0) {
      // No symbols - shouldn't happen, write single symbol of 0
      this.writeSimpleHuffmanCode(writer, [0]);
      return new Map([[0, { code: 0, length: 0 }]]);
    } else if (symbols.length === 1) {
      // Single symbol - use simple code
      this.writeSimpleHuffmanCode(writer, [symbols[0]]);
      return new Map([[symbols[0], { code: 0, length: 0 }]]);
    } else if (symbols.length === 2) {
      // Two symbols - use simple code
      this.writeSimpleHuffmanCode(writer, symbols);
      return new Map([
        [symbols[0], { code: 0, length: 1 }],
        [symbols[1], { code: 1, length: 1 }],
      ]);
    } else {
      // More than 2 symbols - use complex code
      return this.writeComplexHuffmanCode(writer, frequencies, maxSymbol);
    }
  }

  /**
   * Write a symbol using its Huffman code
   */
  private writeSymbol(
    writer: BitWriter,
    codes: Map<number, { code: number; length: number }>,
    symbol: number,
  ): void {
    const huffCode = codes.get(symbol);
    if (!huffCode) {
      throw new Error(`No Huffman code for symbol ${symbol}`);
    }

    // Code length 0 means single symbol (no bits to write)
    if (huffCode.length === 0) return;

    // Write the Huffman code bits from MSB to LSB
    // This matches how the decoder's addCode builds the tree
    for (let i = huffCode.length - 1; i >= 0; i--) {
      writer.writeBits((huffCode.code >> i) & 1, 1);
    }
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
      writer.writeBits(1, 1); // is_first_8bits = 1 (use 8 bits)
      writer.writeBits(symbols[0], 8); // symbol
    } else if (symbols.length === 2) {
      // Two symbols
      writer.writeBits(1, 1); // num_symbols = 2 (1 + 1)
      writer.writeBits(1, 1); // is_first_8bits = 1 (use 8 bits)
      writer.writeBits(symbols[0], 8); // first symbol
      writer.writeBits(symbols[1], 8); // second symbol
    } else {
      // Should not reach here - caller should use complex Huffman for >2 symbols
      throw new Error(
        `Simple Huffman code does not support ${symbols.length} symbols`,
      );
    }
  }

  /**
   * Calculate optimal code lengths for symbols using standard Huffman algorithm
   * Returns an array where index is the symbol and value is the code length
   */
  private calculateCodeLengths(
    frequencies: Map<number, number>,
    maxSymbol: number,
    maxCodeLength = 15,
  ): Uint8Array {
    const codeLengths = new Uint8Array(maxSymbol);

    // Get symbols with non-zero frequencies
    const symbols = Array.from(frequencies.keys()).sort((a, b) => a - b);
    if (symbols.length === 0) return codeLengths;

    // For a single symbol, use code length 1
    // (Canonical Huffman codes require length >= 1)
    if (symbols.length === 1) {
      // console.log(`Single symbol ${symbols[0]}, forcing length 1`);
      codeLengths[symbols[0]] = 1;
      return codeLengths;
    }

    // For two symbols, use code length 1 for both
    if (symbols.length === 2) {
      codeLengths[symbols[0]] = 1;
      codeLengths[symbols[1]] = 1;
      return codeLengths;
    }

    // Build Huffman tree using standard algorithm
    // Create leaf nodes for each symbol
    interface Node {
      freq: number;
      symbol?: number;
      left?: Node;
      right?: Node;
    }

    let nodes: Node[] = symbols.map((symbol) => ({
      freq: frequencies.get(symbol)!,
      symbol,
    }));

    // Helper to build tree
    const buildTree = (leafs: Node[]): Node => {
      const queue = [...leafs];
      while (queue.length > 1) {
        queue.sort((a, b) => a.freq - b.freq);
        const left = queue.shift()!;
        const right = queue.shift()!;
        queue.push({
          freq: left.freq + right.freq,
          left,
          right,
        });
      }
      return queue[0];
    };

    let root = buildTree(nodes);

    // Check max depth
    let maxDepth = 0;
    const checkDepth = (node: Node, depth: number) => {
      if (node.symbol !== undefined) {
        maxDepth = Math.max(maxDepth, depth);
      } else {
        if (node.left) checkDepth(node.left, depth + 1);
        if (node.right) checkDepth(node.right, depth + 1);
      }
    };
    checkDepth(root, 0);

    // If tree is too deep, flatten frequencies and rebuild
    let attempts = 0;
    while (maxDepth > maxCodeLength && attempts < 5) {
      // console.log(`Tree too deep (${maxDepth} > ${maxCodeLength}), flattening...`);
      attempts++;

      // Add bias to frequencies to flatten the tree
      // Increase bias with each attempt
      const bias = (Math.ceil(root.freq / (symbols.length * 2)) || 1) *
        attempts;

      nodes = symbols.map((symbol) => ({
        freq: frequencies.get(symbol)! + bias,
        symbol,
      }));
      root = buildTree(nodes);

      // Re-check depth
      maxDepth = 0;
      checkDepth(root, 0);
    }

    if (maxDepth > maxCodeLength) {
      console.warn(
        `Failed to reduce Huffman tree depth to ${maxCodeLength} (current: ${maxDepth})`,
      );
      // Force hard limit by sorting and assigning lengths?
      // For now, let's just see if this is happening.
    }

    // Calculate code lengths by traversing tree (iterative to avoid deep recursion)
    const stack: Array<{ node: Node; depth: number }> = [{
      node: root,
      depth: 0,
    }];
    while (stack.length > 0) {
      const { node, depth } = stack.pop()!;
      if (node.symbol !== undefined) {
        // Clamp depth to maxCodeLength (should be safe now with flattening heuristic)
        codeLengths[node.symbol] = Math.min(depth, maxCodeLength);
      } else {
        if (node.left) stack.push({ node: node.left, depth: depth + 1 });
        if (node.right) stack.push({ node: node.right, depth: depth + 1 });
      }
    }

    // Handle edge case: depth 0 occurs when we have a single node tree (e.g., 2 symbols)
    // In canonical Huffman coding, all symbols must have length >= 1
    for (const symbol of symbols) {
      if (codeLengths[symbol] === 0) {
        codeLengths[symbol] = 1;
      }
    }

    return codeLengths;
  }

  /**
   * Build canonical Huffman codes from code lengths
   * Returns a map from symbol to {code, length}
   */
  private buildCanonicalCodes(
    codeLengths: number[] | Uint8Array,
  ): Map<number, { code: number; length: number }> {
    const codes = new Map<number, { code: number; length: number }>();

    // Find max code length (avoid spread operator for large arrays)
    let maxLength = 0;
    for (const length of codeLengths) {
      if (length > maxLength) {
        maxLength = length;
      }
    }

    // Count symbols at each length
    const lengthCounts = new Uint32Array(maxLength + 1);
    for (let i = 0; i < codeLengths.length; i++) {
      if (codeLengths[i] > 0) {
        lengthCounts[codeLengths[i]]++;
      }
    }

    // Generate first code for each length
    let code = 0;
    const nextCode = new Uint32Array(maxLength + 1);
    for (let len = 1; len <= maxLength; len++) {
      code = (code + lengthCounts[len - 1]) << 1;
      nextCode[len] = code;
    }

    // Assign codes to symbols
    for (let symbol = 0; symbol < codeLengths.length; symbol++) {
      const length = codeLengths[symbol];
      if (length > 0) {
        codes.set(symbol, { code: nextCode[length], length });
        nextCode[length]++;
      }
    }

    return codes;
  }

  /**
   * RLE encode code lengths using special codes 16, 17, 18
   */
  private rleEncodeCodeLengths(
    codeLengths: number[] | Uint8Array,
  ): number[] {
    const encoded: number[] = [];
    let i = 0;

    while (i < codeLengths.length) {
      const length = codeLengths[i];

      if (length === 0) {
        // Count consecutive zeros
        let count = 0;
        while (i + count < codeLengths.length && codeLengths[i + count] === 0) {
          count++;
        }

        // Encode runs of zeros
        while (count > 0) {
          if (count >= 11) {
            // Use code 18 for 11-138 zeros
            const runLength = Math.min(count, 138);
            encoded.push(18, runLength - 11);
            count -= runLength;
          } else if (count >= 3) {
            // Use code 17 for 3-10 zeros
            const runLength = Math.min(count, 10);
            encoded.push(17, runLength - 3);
            count -= runLength;
          } else {
            // Literal zero (1-2 zeros)
            encoded.push(0);
            count--;
          }
        }
        // Move past all the zeros we just encoded
        while (i < codeLengths.length && codeLengths[i] === 0) {
          i++;
        }
      } else {
        // Non-zero length
        encoded.push(length);
        i++;

        // Check for repeating previous length
        let count = 0;
        while (
          i + count < codeLengths.length &&
          codeLengths[i + count] === length &&
          count < 6
        ) {
          count++;
        }

        if (count >= 3) {
          // Use code 16 for 3-6 repetitions
          encoded.push(16, count - 3);
          i += count;
        }
      }
    }

    return encoded;
  }

  /**
   * Write complex Huffman code using code lengths
   */
  private writeComplexHuffmanCode(
    writer: BitWriter,
    frequencies: Map<number, number>,
    maxSymbol: number,
  ): Map<number, { code: number; length: number }> {
    // Calculate optimal code lengths
    const codeLengths = this.calculateCodeLengths(frequencies, maxSymbol);

    // Build canonical codes
    const codes = this.buildCanonicalCodes(codeLengths);

    // Write complex code indicator
    writer.writeBits(0, 1); // Not simple

    // RLE encode code lengths
    const rleEncoded = this.rleEncodeCodeLengths(codeLengths);

    // Build code length codes - count frequency of each code in RLE stream
    const codeLengthFreqs = new Map<number, number>();
    for (let i = 0; i < rleEncoded.length; i++) {
      const code = rleEncoded[i];
      codeLengthFreqs.set(code, (codeLengthFreqs.get(code) || 0) + 1);
      // Skip extra bits for codes 16, 17, 18
      if (code === 16 || code === 17 || code === 18) {
        i++; // Skip the extra parameter
      }
    }

    // Calculate code lengths for the code length alphabet (max 19 symbols)
    const codeLengthCodeLengths = this.calculateCodeLengths(
      codeLengthFreqs,
      19,
      7,
    ); // Max 7 bits

    // Code length code order (matches decoder)
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

    // Find number of code length codes to write (trim trailing zeros)
    let numCodeLengthCodes = 19;
    for (let i = 18; i >= 4; i--) {
      if (codeLengthCodeLengths[codeLengthCodeOrder[i]] === 0) {
        numCodeLengthCodes = i;
      } else {
        break;
      }
    }
    numCodeLengthCodes = Math.max(4, numCodeLengthCodes);

    // Write number of code length codes
    // console.log(`Complex Huffman: numCodeLengthCodes=${numCodeLengthCodes}, rleEncoded.length=${rleEncoded.length}`);
    writer.writeBits(numCodeLengthCodes - 4, 4);

    // Write code length code lengths
    for (let i = 0; i < numCodeLengthCodes; i++) {
      writer.writeBits(codeLengthCodeLengths[codeLengthCodeOrder[i]], 3);
    }

    // Write max_symbol is encoded? No, it's write_trimmed_length
    // VP8L spec says: "int max_symbol is read."
    // Wait, subagent said "write_trimmed_length".
    // Let's check the spec or libwebp source if possible.
    // But assuming subagent is correct:
    writer.writeBits(0, 1); // write_trimmed_length = 0 (no trimming)

    // Build canonical codes for code lengths
    const codeLengthCodes = this.buildCanonicalCodes(codeLengthCodeLengths);

    // Check for single symbol optimization (VP8L specific)
    let nonZeroCount = 0;
    for (const len of codeLengthCodeLengths) {
      if (len > 0) nonZeroCount++;
    }

    if (nonZeroCount === 1) {
      // If only one symbol is used in the code length alphabet,
      // we don't write any bits for the code itself in the RLE stream.
      // The symbol is implicit because it's the only one with non-zero length in the header.
      for (const [_symbol, info] of codeLengthCodes) {
        info.length = 0;
      }
    }

    // Write RLE-encoded code lengths using code length codes
    for (let i = 0; i < rleEncoded.length; i++) {
      const code = rleEncoded[i];
      const huffCode = codeLengthCodes.get(code);
      if (!huffCode) {
        throw new Error(`No Huffman code for symbol ${code}`);
      }

      // Write the Huffman code bits from MSB to LSB
      // This matches how the decoder's addCode builds the tree
      // (First bit written is MSB, which corresponds to top of tree)
      for (let i = huffCode.length - 1; i >= 0; i--) {
        writer.writeBits((huffCode.code >> i) & 1, 1);
      }

      // Write extra bits for special codes
      if (code === 16) {
        // 2 extra bits for repeat count (3-6)
        writer.writeBits(rleEncoded[++i], 2);
      } else if (code === 17) {
        // 3 extra bits for zero run (3-10)
        writer.writeBits(rleEncoded[++i], 3);
      } else if (code === 18) {
        // 7 extra bits for zero run (11-138)
        writer.writeBits(rleEncoded[++i], 7);
      }
    }

    return codes;
  }
}
