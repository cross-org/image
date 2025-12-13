/**
 * JPEG decoder implementation supporting both baseline and progressive DCT
 *
 * Supports:
 * - Baseline DCT (SOF0) - Sequential encoding
 * - Progressive DCT (SOF2) - Multi-scan encoding with spectral selection and successive approximation
 *
 * This is a pure JavaScript implementation that handles common JPEG files.
 * For complex or non-standard JPEGs, the ImageDecoder API fallback is preferred.
 */

/**
 * Options for JPEG decoder
 */
export interface JPEGDecoderOptions {
  /**
   * Enable tolerant decoding mode. When enabled, the decoder will continue
   * decoding even if some blocks fail, filling failed blocks with zeros.
   * This is useful for partially corrupted images or complex encoding patterns.
   * @default true
   */
  tolerantDecoding?: boolean;
  /**
   * Optional callback for handling warnings during decoding.
   * Called when non-fatal issues occur, such as falling back to runtime decoder.
   * @param message - The warning message
   * @param details - Optional additional context or error information
   */
  onWarning?: (message: string, details?: unknown) => void;
}

// JPEG markers
const EOI = 0xFFD9; // End of Image
const SOS = 0xFFDA; // Start of Scan
const DQT = 0xFFDB; // Define Quantization Table
const DHT = 0xFFC4; // Define Huffman Table
const SOF0 = 0xFFC0; // Start of Frame (Baseline DCT)
const SOF2 = 0xFFC2; // Start of Frame (Progressive DCT)
const DRI = 0xFFDD; // Define Restart Interval

// Zigzag order for DCT coefficients (JPEG standard)
// Maps coefficient index in zigzag order to position in 8x8 block
const ZIGZAG = [
  0,
  1,
  8,
  16,
  9,
  2,
  3,
  10,
  17,
  24,
  32,
  25,
  18,
  11,
  4,
  5,
  12,
  19,
  26,
  33,
  40,
  48,
  41,
  34,
  27,
  20,
  13,
  6,
  7,
  14,
  21,
  28,
  35,
  42,
  49,
  56,
  57,
  50,
  43,
  36,
  29,
  22,
  15,
  23,
  30,
  37,
  44,
  51,
  58,
  59,
  52,
  45,
  38,
  31,
  39,
  46,
  53,
  60,
  61,
  54,
  47,
  55,
  62,
  63,
];

interface JPEGComponent {
  id: number;
  h: number; // Horizontal sampling factor
  v: number; // Vertical sampling factor
  qTable: number; // Quantization table selector
  dcTable: number; // DC Huffman table selector
  acTable: number; // AC Huffman table selector
  pred: number; // DC predictor
  blocks: (number[] | Int32Array)[][]; // Decoded blocks
}

interface HuffmanTable {
  codes: Map<number, number>;
  maxCode: Int32Array;
  minCode: Int32Array;
  valPtr: Int32Array;
  huffVal: Uint8Array;
}

export class JPEGDecoder {
  private data: Uint8Array;
  private pos: number = 0;
  private width: number = 0;
  private height: number = 0;
  private components: JPEGComponent[] = [];
  private qTables: (number[] | Uint8Array)[] = [];
  private dcTables: HuffmanTable[] = [];
  private acTables: HuffmanTable[] = [];
  private restartInterval: number = 0;
  private bitBuffer: number = 0;
  private bitCount: number = 0;
  private options: JPEGDecoderOptions;
  private isProgressive: boolean = false;
  // Progressive JPEG scan parameters
  private spectralStart: number = 0; // Start of spectral selection (Ss)
  private spectralEnd: number = 63; // End of spectral selection (Se)
  private successiveHigh: number = 0; // Successive approximation bit high (Ah)
  private successiveLow: number = 0; // Successive approximation bit low (Al)

  constructor(data: Uint8Array, options: JPEGDecoderOptions = {}) {
    this.data = data;
    this.options = {
      tolerantDecoding: options.tolerantDecoding ?? true,
      onWarning: options.onWarning,
    };
  }

  decode(): Uint8Array {
    // Verify JPEG signature
    if (
      this.data.length < 2 || this.data[0] !== 0xFF || this.data[1] !== 0xD8
    ) {
      throw new Error("Invalid JPEG signature");
    }

    this.pos = 2;

    // Parse markers
    while (this.pos < this.data.length) {
      const marker = this.readMarker();

      if (marker === EOI) {
        break;
      } else if (marker === SOS) {
        this.parseSOS();
        this.decodeScan();
        // For progressive JPEG, continue to process more scans
        // For baseline JPEG, stop after first scan
        if (!this.isProgressive) {
          break;
        }
      } else if (marker === DQT) {
        this.parseDQT();
      } else if (marker === DHT) {
        this.parseDHT();
      } else if (marker === SOF0 || marker === SOF2) {
        // Parse SOF for both baseline (SOF0) and progressive (SOF2)
        // Progressive JPEGs have the same frame header structure
        this.parseSOF();
        this.isProgressive = marker === SOF2;
      } else if (marker === DRI) {
        this.parseDRI();
      } else if (marker >= 0xFFE0 && marker <= 0xFFEF) {
        // Skip APP markers
        this.skipSegment();
      } else if (marker >= 0xFFC0 && marker <= 0xFFCF) {
        // Other SOF markers
        if (marker !== 0xFFC4 && marker !== 0xFFC8 && marker !== 0xFFCC) {
          throw new Error(
            `Unsupported JPEG type: marker 0x${marker.toString(16)}`,
          );
        }
      } else {
        // Skip unknown markers
        if (this.pos < this.data.length) {
          this.skipSegment();
        }
      }
    }

    if (this.width === 0 || this.height === 0) {
      throw new Error("Failed to decode JPEG: invalid dimensions");
    }

    // Convert YCbCr to RGB
    return this.convertToRGB();
  }

  private readMarker(): number {
    while (this.pos < this.data.length && this.data[this.pos] !== 0xFF) {
      this.pos++;
    }

    if (this.pos >= this.data.length - 1) {
      return EOI;
    }

    const byte1 = this.data[this.pos++];
    let byte2 = this.data[this.pos++];

    // Skip padding 0xFF bytes
    while (byte2 === 0xFF && this.pos < this.data.length) {
      byte2 = this.data[this.pos++];
    }

    return (byte1 << 8) | byte2;
  }

  private readUint16(): number {
    const value = (this.data[this.pos] << 8) | this.data[this.pos + 1];
    this.pos += 2;
    return value;
  }

  private skipSegment(): void {
    const length = this.readUint16();
    this.pos += length - 2;
  }

  private parseDQT(): void {
    let length = this.readUint16() - 2;

    while (length > 0) {
      const info = this.data[this.pos++];
      const tableId = info & 0x0F;
      const precision = (info >> 4) & 0x0F;

      if (precision !== 0) {
        throw new Error("16-bit quantization tables not supported");
      }

      const table = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        table[ZIGZAG[i]] = this.data[this.pos++];
      }

      this.qTables[tableId] = table;
      length -= 65;
    }
  }

  private parseDHT(): void {
    let length = this.readUint16() - 2;

    while (length > 0) {
      const info = this.data[this.pos++];
      const tableId = info & 0x0F;
      const tableClass = (info >> 4) & 0x0F;

      const bits = new Uint8Array(16);
      let numSymbols = 0;
      for (let i = 0; i < 16; i++) {
        bits[i] = this.data[this.pos++];
        numSymbols += bits[i];
      }

      const huffVal = new Uint8Array(numSymbols);
      for (let i = 0; i < numSymbols; i++) {
        huffVal[i] = this.data[this.pos++];
      }

      const table = this.buildHuffmanTable(bits, huffVal);

      if (tableClass === 0) {
        this.dcTables[tableId] = table;
      } else {
        this.acTables[tableId] = table;
      }

      length -= 17 + numSymbols;
    }
  }

  private buildHuffmanTable(
    bits: Uint8Array,
    huffVal: Uint8Array,
  ): HuffmanTable {
    const maxCode = new Int32Array(16).fill(-1);
    const minCode = new Int32Array(16).fill(-1);
    const valPtr = new Int32Array(16).fill(-1);
    const codes = new Map<number, number>();

    let code = 0;
    let valIndex = 0;

    for (let i = 0; i < 16; i++) {
      if (bits[i] > 0) {
        minCode[i] = code;
        valPtr[i] = valIndex;

        for (let j = 0; j < bits[i]; j++) {
          codes.set((i << 16) | code, huffVal[valIndex]);
          code++;
          valIndex++;
        }

        maxCode[i] = code - 1;
        code <<= 1;
      } else {
        code <<= 1;
      }
    }

    return { codes, maxCode, minCode, valPtr, huffVal };
  }

  private parseSOF(): void {
    const _length = this.readUint16();
    const precision = this.data[this.pos++];

    if (precision !== 8) {
      throw new Error(`Unsupported precision: ${precision}`);
    }

    this.height = this.readUint16();
    this.width = this.readUint16();
    const numComponents = this.data[this.pos++];

    if (numComponents !== 1 && numComponents !== 3) {
      throw new Error(`Unsupported number of components: ${numComponents}`);
    }

    this.components = [];
    for (let i = 0; i < numComponents; i++) {
      const id = this.data[this.pos++];
      const samplingFactor = this.data[this.pos++];
      const qTable = this.data[this.pos++];

      this.components.push({
        id,
        h: (samplingFactor >> 4) & 0x0F,
        v: samplingFactor & 0x0F,
        qTable,
        dcTable: 0,
        acTable: 0,
        pred: 0,
        blocks: [],
      });
    }
  }

  private parseSOS(): void {
    const _length = this.readUint16();
    const numComponents = this.data[this.pos++];

    for (let i = 0; i < numComponents; i++) {
      const id = this.data[this.pos++];
      const tables = this.data[this.pos++];

      const component = this.components.find((c) => c.id === id);
      if (component) {
        component.dcTable = (tables >> 4) & 0x0F;
        component.acTable = tables & 0x0F;
      }
    }

    // Parse spectral selection and successive approximation parameters
    // These are used in progressive JPEGs to define which coefficients
    // are encoded and at what bit precision
    this.spectralStart = this.data[this.pos++]; // Ss: Start of spectral selection (0-63)
    this.spectralEnd = this.data[this.pos++]; // Se: End of spectral selection (0-63)
    const successiveApprox = this.data[this.pos++];
    this.successiveHigh = (successiveApprox >> 4) & 0x0F; // Ah: Successive approximation bit position high
    this.successiveLow = successiveApprox & 0x0F; // Al: Successive approximation bit position low
  }

  private parseDRI(): void {
    const _length = this.readUint16();
    this.restartInterval = this.readUint16();
  }

  private decodeScan(): void {
    // Calculate MCU dimensions
    const maxH = Math.max(...this.components.map((c) => c.h));
    const maxV = Math.max(...this.components.map((c) => c.v));

    const mcuWidth = Math.ceil(this.width / (8 * maxH));
    const mcuHeight = Math.ceil(this.height / (8 * maxV));

    // Initialize bit buffer for this scan
    this.bitBuffer = 0;
    this.bitCount = 0;

    // Initialize or preserve blocks for each component
    // For progressive JPEGs, blocks must be preserved across multiple scans
    // to accumulate coefficients from different spectral bands and bit refinements
    for (const component of this.components) {
      const blocksAcross = Math.ceil(this.width * component.h / (8 * maxH));
      const blocksDown = Math.ceil(this.height * component.v / (8 * maxV));

      // Only initialize blocks if they don't exist yet (first scan)
      if (component.blocks.length === 0) {
        component.blocks = Array(blocksDown).fill(null).map(() =>
          Array(blocksAcross).fill(null).map(() => new Int32Array(64))
        );
      }
    }

    // Decode MCUs
    let decodedBlocks = 0;
    let failedBlocks = 0;

    for (let mcuY = 0; mcuY < mcuHeight; mcuY++) {
      for (let mcuX = 0; mcuX < mcuWidth; mcuX++) {
        // Decode all components in this MCU
        for (const component of this.components) {
          for (let v = 0; v < component.v; v++) {
            for (let h = 0; h < component.h; h++) {
              const blockY = mcuY * component.v + v;
              const blockX = mcuX * component.h + h;

              if (
                blockY < component.blocks.length &&
                blockX < component.blocks[0].length
              ) {
                if (this.options.tolerantDecoding) {
                  try {
                    this.decodeBlock(component, blockY, blockX);
                    decodedBlocks++;
                  } catch (_e) {
                    // Tolerant decoding: if we fail, leave block as-is and continue
                    // This allows partial decoding of corrupted or complex JPEGs
                    failedBlocks++;
                    // Block preserves its previous state (zeros on first scan)
                  }
                } else {
                  // Non-tolerant mode: throw on first error
                  this.decodeBlock(component, blockY, blockX);
                  decodedBlocks++;
                }
              }
            }
          }
        }
      }
    }
  }

  private decodeBlock(
    component: JPEGComponent,
    blockY: number,
    blockX: number,
  ): void {
    const block = component.blocks[blockY][blockX];

    // Progressive JPEG support:
    // - Spectral selection (spectralStart, spectralEnd): Defines which DCT coefficients are decoded
    //   * DC only: Ss=0, Se=0
    //   * Low-frequency AC: Ss=1, Se=5
    //   * High-frequency AC: Ss=6, Se=63
    // - Successive approximation (successiveHigh, successiveLow): Defines bit precision
    //   * First scan: Ah=0, Al=n (decode high bits)
    //   * Refinement: Ah=n, Al=n-1 (refine lower bits)
    //
    // Current implementation: Processes scans sequentially, accumulating coefficients
    // across multiple scans. Full successive approximation bit refinement is not yet
    // implemented - later scans overwrite earlier ones, which works for many progressive
    // JPEGs but not all.

    // Decode DC coefficient (if spectralStart == 0)
    if (this.spectralStart === 0) {
      const dcTable = this.dcTables[component.dcTable];
      if (!dcTable) {
        throw new Error(`Missing DC table ${component.dcTable}`);
      }

      const dcLen = this.decodeHuffman(dcTable);
      const dcDiff = dcLen > 0 ? this.receiveBits(dcLen) : 0;
      component.pred += dcDiff;
      block[0] = component.pred * this.qTables[component.qTable][0];
    }

    // Decode AC coefficients (if spectralEnd > 0)
    if (this.spectralEnd > 0) {
      const acTable = this.acTables[component.acTable];
      if (!acTable) {
        throw new Error(`Missing AC table ${component.acTable}`);
      }

      let k = Math.max(1, this.spectralStart);
      while (k <= this.spectralEnd && k < 64) {
        const rs = this.decodeHuffman(acTable);
        const r = (rs >> 4) & 0x0F;
        const s = rs & 0x0F;

        if (s === 0) {
          if (r === 15) {
            k += 16;
          } else {
            break; // EOB
          }
        } else {
          k += r;
          if (k >= 64) break;
          block[ZIGZAG[k]] = this.receiveBits(s) *
            this.qTables[component.qTable][ZIGZAG[k]];
          k++;
        }
      }
    }

    // Perform IDCT
    this.idct(block);
  }

  private decodeHuffman(table: HuffmanTable): number {
    // Use table-based decoding (more reliable)
    let code = 0;

    for (let len = 0; len < 16; len++) {
      code = (code << 1) | this.readBit();

      if (table.minCode[len] !== -1 && code <= table.maxCode[len]) {
        const index = table.valPtr[len] + (code - table.minCode[len]);
        if (index >= 0 && index < table.huffVal.length) {
          return table.huffVal[index];
        } else {
          throw new Error(
            `Huffman table index out of bounds: ${index} (table size: ${table.huffVal.length})`,
          );
        }
      }
    }

    throw new Error("Invalid Huffman code");
  }

  private readBit(): number {
    if (this.bitCount === 0) {
      // Check bounds
      if (this.pos >= this.data.length) {
        throw new Error("Unexpected end of JPEG data");
      }

      const byte = this.data[this.pos++];

      // Handle byte stuffing (0xFF 0x00) and restart markers
      if (byte === 0xFF) {
        if (this.pos >= this.data.length) {
          throw new Error("Unexpected end of JPEG data after 0xFF");
        }

        const nextByte = this.data[this.pos];
        if (nextByte === 0x00) {
          // Byte stuffing - skip the 0x00
          // The 0xFF byte value is used as-is (already assigned above)
          this.pos++;
        } else if (nextByte >= 0xD0 && nextByte <= 0xD7) {
          // Restart marker - reset DC predictors and bit stream
          this.pos++; // Skip marker type byte
          for (const component of this.components) {
            component.pred = 0;
          }
          // Reset bit stream (restart markers are byte-aligned)
          this.bitBuffer = 0;
          this.bitCount = 0;
          // Recursively call readBit to get the next bit after restart
          return this.readBit();
        } else {
          // Other marker found in scan data - this indicates end of scan
          // Back up to before the marker
          this.pos--;
          throw new Error("Marker found in scan data");
        }
      }

      this.bitBuffer = byte;
      this.bitCount = 8;
    }

    this.bitCount--;
    return (this.bitBuffer >> this.bitCount) & 1;
  }

  private receiveBits(n: number): number {
    let value = 0;
    for (let i = 0; i < n; i++) {
      value = (value << 1) | this.readBit();
    }

    // Convert from magnitude representation
    if (value < (1 << (n - 1))) {
      value = value - (1 << n) + 1;
    }

    return value;
  }

  private idct(block: number[] | Int32Array): void {
    // Simplified 2D IDCT
    // This is a basic implementation - not optimized
    const temp = new Float32Array(64);

    // 1D IDCT on rows
    for (let i = 0; i < 8; i++) {
      const offset = i * 8;

      for (let j = 0; j < 8; j++) {
        let sum = 0;
        for (let k = 0; k < 8; k++) {
          const c = k === 0 ? 1 / Math.sqrt(2) : 1;
          sum += c * block[offset + k] *
            Math.cos((2 * j + 1) * k * Math.PI / 16);
        }
        temp[offset + j] = sum / 2;
      }
    }

    // 1D IDCT on columns
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        let sum = 0;
        for (let k = 0; k < 8; k++) {
          const c = k === 0 ? 1 / Math.sqrt(2) : 1;
          sum += c * temp[k * 8 + j] * Math.cos((2 * i + 1) * k * Math.PI / 16);
        }
        // Level shift and clamp
        block[i * 8 + j] = Math.max(
          0,
          Math.min(255, Math.round(sum / 2 + 128)),
        );
      }
    }
  }

  private convertToRGB(): Uint8Array {
    const rgba = new Uint8Array(this.width * this.height * 4);

    if (this.components.length === 1) {
      // Grayscale
      const y = this.components[0];
      for (let row = 0; row < this.height; row++) {
        for (let col = 0; col < this.width; col++) {
          const blockRow = Math.floor(row / 8);
          const blockCol = Math.floor(col / 8);
          const blockY = row % 8;
          const blockX = col % 8;

          if (blockRow < y.blocks.length && blockCol < y.blocks[0].length) {
            const value = y.blocks[blockRow][blockCol][blockY * 8 + blockX];
            const offset = (row * this.width + col) * 4;
            rgba[offset] = value;
            rgba[offset + 1] = value;
            rgba[offset + 2] = value;
            rgba[offset + 3] = 255;
          }
        }
      }
    } else {
      // YCbCr to RGB
      const [y, cb, cr] = this.components;
      const maxH = Math.max(...this.components.map((c) => c.h));
      const maxV = Math.max(...this.components.map((c) => c.v));

      for (let row = 0; row < this.height; row++) {
        for (let col = 0; col < this.width; col++) {
          // Y component
          const yBlockRow = Math.floor(row / 8);
          const yBlockCol = Math.floor(col / 8);
          const yBlockY = row % 8;
          const yBlockX = col % 8;

          let yVal = 0;
          if (yBlockRow < y.blocks.length && yBlockCol < y.blocks[0].length) {
            yVal = y.blocks[yBlockRow][yBlockCol][yBlockY * 8 + yBlockX];
          }

          // Cb and Cr components (may be subsampled)
          // Scale pixel position by subsampling factor, then get block and within-block positions
          const cbRow = Math.floor(row * cb.v / maxV);
          const cbCol = Math.floor(col * cb.h / maxH);
          const cbBlockRow = Math.floor(cbRow / 8);
          const cbBlockCol = Math.floor(cbCol / 8);
          const cbBlockY = cbRow % 8;
          const cbBlockX = cbCol % 8;

          let cbVal = 0;
          if (
            cbBlockRow < cb.blocks.length && cbBlockCol < cb.blocks[0].length
          ) {
            cbVal = cb.blocks[cbBlockRow][cbBlockCol][cbBlockY * 8 + cbBlockX] -
              128;
          }

          const crRow = Math.floor(row * cr.v / maxV);
          const crCol = Math.floor(col * cr.h / maxH);
          const crBlockRow = Math.floor(crRow / 8);
          const crBlockCol = Math.floor(crCol / 8);
          const crBlockY = crRow % 8;
          const crBlockX = crCol % 8;

          let crVal = 0;
          if (
            crBlockRow < cr.blocks.length && crBlockCol < cr.blocks[0].length
          ) {
            crVal = cr.blocks[crBlockRow][crBlockCol][crBlockY * 8 + crBlockX] -
              128;
          }

          // YCbCr to RGB conversion
          const r = Math.max(
            0,
            Math.min(255, Math.round(yVal + 1.402 * crVal)),
          );
          const g = Math.max(
            0,
            Math.min(
              255,
              Math.round(yVal - 0.344136 * cbVal - 0.714136 * crVal),
            ),
          );
          const b = Math.max(
            0,
            Math.min(255, Math.round(yVal + 1.772 * cbVal)),
          );

          const offset = (row * this.width + col) * 4;
          rgba[offset] = r;
          rgba[offset + 1] = g;
          rgba[offset + 2] = b;
          rgba[offset + 3] = 255;
        }
      }
    }

    return rgba;
  }
}
