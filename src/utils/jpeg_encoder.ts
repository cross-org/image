/**
 * Basic baseline JPEG encoder implementation
 * Produces valid baseline DCT JPEG images
 *
 * This is a simplified implementation focusing on correctness over performance.
 * For production use with better quality/size, the OffscreenCanvas API is preferred.
 */

// Standard JPEG quantization tables
const STANDARD_LUMINANCE_QUANT_TABLE = [
  16,
  11,
  10,
  16,
  24,
  40,
  51,
  61,
  12,
  12,
  14,
  19,
  26,
  58,
  60,
  55,
  14,
  13,
  16,
  24,
  40,
  57,
  69,
  56,
  14,
  17,
  22,
  29,
  51,
  87,
  80,
  62,
  18,
  22,
  37,
  56,
  68,
  109,
  103,
  77,
  24,
  35,
  55,
  64,
  81,
  104,
  113,
  92,
  49,
  64,
  78,
  87,
  103,
  121,
  120,
  101,
  72,
  92,
  95,
  98,
  112,
  100,
  103,
  99,
];

const STANDARD_CHROMINANCE_QUANT_TABLE = [
  17,
  18,
  24,
  47,
  99,
  99,
  99,
  99,
  18,
  21,
  26,
  66,
  99,
  99,
  99,
  99,
  24,
  26,
  56,
  99,
  99,
  99,
  99,
  99,
  47,
  66,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
  99,
];

// Zigzag order for DCT coefficients
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

// Standard Huffman tables for DC coefficients (luminance)
const STD_DC_LUMINANCE_NRCODES = [
  0,
  0,
  1,
  5,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
];
const STD_DC_LUMINANCE_VALUES = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
];

// Standard Huffman tables for AC coefficients (luminance)
const STD_AC_LUMINANCE_NRCODES = [
  0,
  0,
  2,
  1,
  3,
  3,
  2,
  4,
  3,
  5,
  5,
  4,
  4,
  0,
  0,
  1,
  0x7d,
];
const STD_AC_LUMINANCE_VALUES = [
  0x01,
  0x02,
  0x03,
  0x00,
  0x04,
  0x11,
  0x05,
  0x12,
  0x21,
  0x31,
  0x41,
  0x06,
  0x13,
  0x51,
  0x61,
  0x07,
  0x22,
  0x71,
  0x14,
  0x32,
  0x81,
  0x91,
  0xa1,
  0x08,
  0x23,
  0x42,
  0xb1,
  0xc1,
  0x15,
  0x52,
  0xd1,
  0xf0,
  0x24,
  0x33,
  0x62,
  0x72,
  0x82,
  0x09,
  0x0a,
  0x16,
  0x17,
  0x18,
  0x19,
  0x1a,
  0x25,
  0x26,
  0x27,
  0x28,
  0x29,
  0x2a,
  0x34,
  0x35,
  0x36,
  0x37,
  0x38,
  0x39,
  0x3a,
  0x43,
  0x44,
  0x45,
  0x46,
  0x47,
  0x48,
  0x49,
  0x4a,
  0x53,
  0x54,
  0x55,
  0x56,
  0x57,
  0x58,
  0x59,
  0x5a,
  0x63,
  0x64,
  0x65,
  0x66,
  0x67,
  0x68,
  0x69,
  0x6a,
  0x73,
  0x74,
  0x75,
  0x76,
  0x77,
  0x78,
  0x79,
  0x7a,
  0x83,
  0x84,
  0x85,
  0x86,
  0x87,
  0x88,
  0x89,
  0x8a,
  0x92,
  0x93,
  0x94,
  0x95,
  0x96,
  0x97,
  0x98,
  0x99,
  0x9a,
  0xa2,
  0xa3,
  0xa4,
  0xa5,
  0xa6,
  0xa7,
  0xa8,
  0xa9,
  0xaa,
  0xb2,
  0xb3,
  0xb4,
  0xb5,
  0xb6,
  0xb7,
  0xb8,
  0xb9,
  0xba,
  0xc2,
  0xc3,
  0xc4,
  0xc5,
  0xc6,
  0xc7,
  0xc8,
  0xc9,
  0xca,
  0xd2,
  0xd3,
  0xd4,
  0xd5,
  0xd6,
  0xd7,
  0xd8,
  0xd9,
  0xda,
  0xe1,
  0xe2,
  0xe3,
  0xe4,
  0xe5,
  0xe6,
  0xe7,
  0xe8,
  0xe9,
  0xea,
  0xf1,
  0xf2,
  0xf3,
  0xf4,
  0xf5,
  0xf6,
  0xf7,
  0xf8,
  0xf9,
  0xfa,
];

// Standard Huffman tables for DC coefficients (chrominance)
const STD_DC_CHROMINANCE_NRCODES = [
  0,
  0,
  3,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  0,
  0,
  0,
  0,
];
const STD_DC_CHROMINANCE_VALUES = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
];

// Standard Huffman tables for AC coefficients (chrominance)
const STD_AC_CHROMINANCE_NRCODES = [
  0,
  0,
  2,
  1,
  2,
  4,
  4,
  3,
  4,
  7,
  5,
  4,
  4,
  0,
  1,
  2,
  0x77,
];
const STD_AC_CHROMINANCE_VALUES = [
  0x00,
  0x01,
  0x02,
  0x03,
  0x11,
  0x04,
  0x05,
  0x21,
  0x31,
  0x06,
  0x12,
  0x41,
  0x51,
  0x07,
  0x61,
  0x71,
  0x13,
  0x22,
  0x32,
  0x81,
  0x08,
  0x14,
  0x42,
  0x91,
  0xa1,
  0xb1,
  0xc1,
  0x09,
  0x23,
  0x33,
  0x52,
  0xf0,
  0x15,
  0x62,
  0x72,
  0xd1,
  0x0a,
  0x16,
  0x24,
  0x34,
  0xe1,
  0x25,
  0xf1,
  0x17,
  0x18,
  0x19,
  0x1a,
  0x26,
  0x27,
  0x28,
  0x29,
  0x2a,
  0x35,
  0x36,
  0x37,
  0x38,
  0x39,
  0x3a,
  0x43,
  0x44,
  0x45,
  0x46,
  0x47,
  0x48,
  0x49,
  0x4a,
  0x53,
  0x54,
  0x55,
  0x56,
  0x57,
  0x58,
  0x59,
  0x5a,
  0x63,
  0x64,
  0x65,
  0x66,
  0x67,
  0x68,
  0x69,
  0x6a,
  0x73,
  0x74,
  0x75,
  0x76,
  0x77,
  0x78,
  0x79,
  0x7a,
  0x82,
  0x83,
  0x84,
  0x85,
  0x86,
  0x87,
  0x88,
  0x89,
  0x8a,
  0x92,
  0x93,
  0x94,
  0x95,
  0x96,
  0x97,
  0x98,
  0x99,
  0x9a,
  0xa2,
  0xa3,
  0xa4,
  0xa5,
  0xa6,
  0xa7,
  0xa8,
  0xa9,
  0xaa,
  0xb2,
  0xb3,
  0xb4,
  0xb5,
  0xb6,
  0xb7,
  0xb8,
  0xb9,
  0xba,
  0xc2,
  0xc3,
  0xc4,
  0xc5,
  0xc6,
  0xc7,
  0xc8,
  0xc9,
  0xca,
  0xd2,
  0xd3,
  0xd4,
  0xd5,
  0xd6,
  0xd7,
  0xd8,
  0xd9,
  0xda,
  0xe2,
  0xe3,
  0xe4,
  0xe5,
  0xe6,
  0xe7,
  0xe8,
  0xe9,
  0xea,
  0xf2,
  0xf3,
  0xf4,
  0xf5,
  0xf6,
  0xf7,
  0xf8,
  0xf9,
  0xfa,
];

interface HuffmanTable {
  codes: number[];
  sizes: number[];
}

class BitWriter {
  private buffer: number[] = [];
  private bitBuffer = 0;
  private bitCount = 0;

  writeBits(value: number, length: number): void {
    this.bitBuffer = (this.bitBuffer << length) | value;
    this.bitCount += length;

    while (this.bitCount >= 8) {
      this.bitCount -= 8;
      const byte = (this.bitBuffer >> this.bitCount) & 0xff;
      this.buffer.push(byte);

      // Byte stuffing: insert 0x00 after 0xFF
      if (byte === 0xff) {
        this.buffer.push(0x00);
      }
    }
  }

  flush(): void {
    if (this.bitCount > 0) {
      const byte = (this.bitBuffer << (8 - this.bitCount)) & 0xff;
      this.buffer.push(byte);
      if (byte === 0xff) {
        this.buffer.push(0x00);
      }
    }
    this.bitBuffer = 0;
    this.bitCount = 0;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export class JPEGEncoder {
  private quality: number;
  private luminanceQuantTable: number[] = [];
  private chrominanceQuantTable: number[] = [];
  private dcLuminanceHuffman!: HuffmanTable;
  private acLuminanceHuffman!: HuffmanTable;
  private dcChrominanceHuffman!: HuffmanTable;
  private acChrominanceHuffman!: HuffmanTable;

  constructor(quality: number = 85) {
    this.quality = Math.max(1, Math.min(100, quality));
    this.initQuantizationTables();
    this.initHuffmanTables();
  }

  private initQuantizationTables(): void {
    const scaleFactor = this.quality < 50
      ? 5000 / this.quality
      : 200 - this.quality * 2;

    for (let i = 0; i < 64; i++) {
      let lumVal = Math.floor(
        (STANDARD_LUMINANCE_QUANT_TABLE[i] * scaleFactor + 50) / 100,
      );
      let chromVal = Math.floor(
        (STANDARD_CHROMINANCE_QUANT_TABLE[i] * scaleFactor + 50) / 100,
      );

      lumVal = Math.max(1, Math.min(255, lumVal));
      chromVal = Math.max(1, Math.min(255, chromVal));

      this.luminanceQuantTable[i] = lumVal;
      this.chrominanceQuantTable[i] = chromVal;
    }
  }

  private initHuffmanTables(): void {
    this.dcLuminanceHuffman = this.buildHuffmanTable(
      STD_DC_LUMINANCE_NRCODES,
      STD_DC_LUMINANCE_VALUES,
    );
    this.acLuminanceHuffman = this.buildHuffmanTable(
      STD_AC_LUMINANCE_NRCODES,
      STD_AC_LUMINANCE_VALUES,
    );
    this.dcChrominanceHuffman = this.buildHuffmanTable(
      STD_DC_CHROMINANCE_NRCODES,
      STD_DC_CHROMINANCE_VALUES,
    );
    this.acChrominanceHuffman = this.buildHuffmanTable(
      STD_AC_CHROMINANCE_NRCODES,
      STD_AC_CHROMINANCE_VALUES,
    );
  }

  private buildHuffmanTable(nrcodes: number[], values: number[]): HuffmanTable {
    const codes: number[] = new Array(256).fill(0);
    const sizes: number[] = new Array(256).fill(0);

    let code = 0;
    let valueIndex = 0;

    for (let length = 1; length <= 16; length++) {
      for (let i = 0; i < nrcodes[length]; i++) {
        const value = values[valueIndex];
        codes[value] = code;
        sizes[value] = length;
        code++;
        valueIndex++;
      }
      code <<= 1;
    }

    return { codes, sizes };
  }

  encode(
    width: number,
    height: number,
    rgba: Uint8Array,
    dpiX = 72,
    dpiY = 72,
  ): Uint8Array {
    const output: number[] = [];

    // SOI (Start of Image)
    output.push(0xff, 0xd8);

    // APP0 (JFIF marker)
    this.writeAPP0(output, dpiX, dpiY);

    // DQT (Define Quantization Tables)
    this.writeDQT(output);

    // SOF0 (Start of Frame - Baseline DCT)
    this.writeSOF0(output, width, height);

    // DHT (Define Huffman Tables)
    this.writeDHT(output);

    // SOS (Start of Scan)
    this.writeSOS(output);

    // Encode scan data
    const scanData = this.encodeScan(width, height, rgba);
    output.push(...scanData);

    // EOI (End of Image)
    output.push(0xff, 0xd9);

    return new Uint8Array(output);
  }

  private writeAPP0(output: number[], dpiX: number, dpiY: number): void {
    output.push(0xff, 0xe0); // APP0 marker
    output.push(0x00, 0x10); // Length (16 bytes)
    output.push(0x4a, 0x46, 0x49, 0x46, 0x00); // "JFIF\0"
    output.push(0x01, 0x01); // Version 1.1
    output.push(0x01); // Density units (1 = dots per inch)
    output.push((dpiX >> 8) & 0xff, dpiX & 0xff); // X density
    output.push((dpiY >> 8) & 0xff, dpiY & 0xff); // Y density
    output.push(0x00, 0x00); // Thumbnail dimensions (none)
  }

  private writeDQT(output: number[]): void {
    // Luminance table
    output.push(0xff, 0xdb); // DQT marker
    output.push(0x00, 0x43); // Length (67 bytes)
    output.push(0x00); // Table 0, 8-bit precision
    for (let i = 0; i < 64; i++) {
      output.push(this.luminanceQuantTable[ZIGZAG[i]]);
    }

    // Chrominance table
    output.push(0xff, 0xdb); // DQT marker
    output.push(0x00, 0x43); // Length (67 bytes)
    output.push(0x01); // Table 1, 8-bit precision
    for (let i = 0; i < 64; i++) {
      output.push(this.chrominanceQuantTable[ZIGZAG[i]]);
    }
  }

  private writeSOF0(output: number[], width: number, height: number): void {
    output.push(0xff, 0xc0); // SOF0 marker
    output.push(0x00, 0x11); // Length (17 bytes)
    output.push(0x08); // Precision (8 bits)
    output.push((height >> 8) & 0xff, height & 0xff); // Height
    output.push((width >> 8) & 0xff, width & 0xff); // Width
    output.push(0x03); // Number of components (3 = YCbCr)

    // Y component
    output.push(0x01); // Component ID
    output.push(0x11); // Sampling factors (1x1)
    output.push(0x00); // Quantization table 0

    // Cb component
    output.push(0x02); // Component ID
    output.push(0x11); // Sampling factors (1x1)
    output.push(0x01); // Quantization table 1

    // Cr component
    output.push(0x03); // Component ID
    output.push(0x11); // Sampling factors (1x1)
    output.push(0x01); // Quantization table 1
  }

  private writeDHT(output: number[]): void {
    // DC Luminance
    this.writeHuffmanTable(
      output,
      0x00,
      STD_DC_LUMINANCE_NRCODES,
      STD_DC_LUMINANCE_VALUES,
    );

    // AC Luminance
    this.writeHuffmanTable(
      output,
      0x10,
      STD_AC_LUMINANCE_NRCODES,
      STD_AC_LUMINANCE_VALUES,
    );

    // DC Chrominance
    this.writeHuffmanTable(
      output,
      0x01,
      STD_DC_CHROMINANCE_NRCODES,
      STD_DC_CHROMINANCE_VALUES,
    );

    // AC Chrominance
    this.writeHuffmanTable(
      output,
      0x11,
      STD_AC_CHROMINANCE_NRCODES,
      STD_AC_CHROMINANCE_VALUES,
    );
  }

  private writeHuffmanTable(
    output: number[],
    classId: number,
    nrcodes: number[],
    values: number[],
  ): void {
    output.push(0xff, 0xc4); // DHT marker

    let length = 19;
    for (let i = 1; i <= 16; i++) {
      length += nrcodes[i];
    }

    output.push((length >> 8) & 0xff, length & 0xff); // Length
    output.push(classId); // Class and ID

    // Number of codes for each length
    for (let i = 1; i <= 16; i++) {
      output.push(nrcodes[i]);
    }

    // Values
    let valueIndex = 0;
    for (let i = 1; i <= 16; i++) {
      for (let j = 0; j < nrcodes[i]; j++) {
        output.push(values[valueIndex++]);
      }
    }
  }

  private writeSOS(output: number[]): void {
    output.push(0xff, 0xda); // SOS marker
    output.push(0x00, 0x0c); // Length (12 bytes)
    output.push(0x03); // Number of components

    // Y component
    output.push(0x01); // Component ID
    output.push(0x00); // DC table 0, AC table 0

    // Cb component
    output.push(0x02); // Component ID
    output.push(0x11); // DC table 1, AC table 1

    // Cr component
    output.push(0x03); // Component ID
    output.push(0x11); // DC table 1, AC table 1

    output.push(0x00); // Start of spectral selection
    output.push(0x3f); // End of spectral selection
    output.push(0x00); // Successive approximation
  }

  private encodeScan(
    width: number,
    height: number,
    rgba: Uint8Array,
  ): number[] {
    const bitWriter = new BitWriter();

    // Convert RGBA to YCbCr and encode MCUs
    let dcY = 0, dcCb = 0, dcCr = 0;

    const mcuWidth = Math.ceil(width / 8);
    const mcuHeight = Math.ceil(height / 8);

    for (let mcuY = 0; mcuY < mcuHeight; mcuY++) {
      for (let mcuX = 0; mcuX < mcuWidth; mcuX++) {
        const yBlock = new Array(64).fill(0);
        const cbBlock = new Array(64).fill(0);
        const crBlock = new Array(64).fill(0);

        // Extract 8x8 block and convert RGB to YCbCr
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const px = mcuX * 8 + x;
            const py = mcuY * 8 + y;

            if (px < width && py < height) {
              const offset = (py * width + px) * 4;
              const r = rgba[offset];
              const g = rgba[offset + 1];
              const b = rgba[offset + 2];

              // RGB to YCbCr conversion
              const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
              const cbVal = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
              const crVal = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

              yBlock[y * 8 + x] = yVal - 128; // Level shift
              cbBlock[y * 8 + x] = cbVal - 128;
              crBlock[y * 8 + x] = crVal - 128;
            }
          }
        }

        // Process Y, Cb, Cr blocks
        dcY = this.encodeBlock(
          yBlock,
          this.luminanceQuantTable,
          dcY,
          this.dcLuminanceHuffman,
          this.acLuminanceHuffman,
          bitWriter,
        );
        dcCb = this.encodeBlock(
          cbBlock,
          this.chrominanceQuantTable,
          dcCb,
          this.dcChrominanceHuffman,
          this.acChrominanceHuffman,
          bitWriter,
        );
        dcCr = this.encodeBlock(
          crBlock,
          this.chrominanceQuantTable,
          dcCr,
          this.dcChrominanceHuffman,
          this.acChrominanceHuffman,
          bitWriter,
        );
      }
    }

    bitWriter.flush();
    return Array.from(bitWriter.getBytes());
  }

  private encodeBlock(
    block: number[],
    quantTable: number[],
    prevDC: number,
    dcTable: HuffmanTable,
    acTable: HuffmanTable,
    bitWriter: BitWriter,
  ): number {
    // Apply DCT
    this.forwardDCT(block);

    // Quantize and reorder to zigzag
    const quantized = new Array(64);
    for (let i = 0; i < 64; i++) {
      const zigzagIndex = ZIGZAG[i];
      quantized[i] = Math.round(block[zigzagIndex] / quantTable[zigzagIndex]);
    }

    // Encode DC coefficient
    const dcDiff = quantized[0] - prevDC;
    this.encodeDC(dcDiff, dcTable, bitWriter);

    // Encode AC coefficients
    this.encodeAC(quantized, acTable, bitWriter);

    return quantized[0];
  }

  private forwardDCT(block: number[]): void {
    // Simplified 2D DCT
    const temp = new Array(64);

    // 1D DCT on rows
    for (let i = 0; i < 8; i++) {
      const offset = i * 8;
      for (let u = 0; u < 8; u++) {
        let sum = 0;
        for (let x = 0; x < 8; x++) {
          sum += block[offset + x] * Math.cos(((2 * x + 1) * u * Math.PI) / 16);
        }
        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        temp[offset + u] = 0.5 * cu * sum;
      }
    }

    // 1D DCT on columns
    for (let j = 0; j < 8; j++) {
      for (let v = 0; v < 8; v++) {
        let sum = 0;
        for (let y = 0; y < 8; y++) {
          sum += temp[y * 8 + j] * Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
        block[v * 8 + j] = 0.5 * cv * sum;
      }
    }
  }

  private encodeDC(
    value: number,
    huffTable: HuffmanTable,
    bitWriter: BitWriter,
  ): void {
    const absValue = Math.abs(value);
    let size = 0;

    if (absValue > 0) {
      size = Math.floor(Math.log2(absValue)) + 1;
    }

    // Write Huffman code for size
    bitWriter.writeBits(huffTable.codes[size], huffTable.sizes[size]);

    // Write magnitude
    if (size > 0) {
      const magnitude = value < 0 ? value + (1 << size) - 1 : value;
      bitWriter.writeBits(magnitude, size);
    }
  }

  private encodeAC(
    block: number[],
    huffTable: HuffmanTable,
    bitWriter: BitWriter,
  ): void {
    let zeroCount = 0;

    for (let i = 1; i < 64; i++) {
      const coef = block[i];

      if (coef === 0) {
        zeroCount++;
      } else {
        // Write any pending zero runs
        while (zeroCount >= 16) {
          bitWriter.writeBits(huffTable.codes[0xf0], huffTable.sizes[0xf0]);
          zeroCount -= 16;
        }

        const absCoef = Math.abs(coef);
        const size = Math.floor(Math.log2(absCoef)) + 1;
        const symbol = (zeroCount << 4) | size;

        bitWriter.writeBits(huffTable.codes[symbol], huffTable.sizes[symbol]);

        const magnitude = coef < 0 ? coef + (1 << size) - 1 : coef;
        bitWriter.writeBits(magnitude, size);

        zeroCount = 0;
      }
    }

    // Write EOB if there are trailing zeros
    if (zeroCount > 0) {
      bitWriter.writeBits(huffTable.codes[0x00], huffTable.sizes[0x00]);
    }
  }
}
