/**
 * LZW (Lempel-Ziv-Welch) compression and decompression
 * Used for GIF image encoding and decoding
 */

/**
 * LZW Decompressor for GIF images
 */
export class LZWDecoder {
  private minCodeSize: number;
  private clearCode: number;
  private endCode: number;
  private data: Uint8Array;
  private pos: number;
  private bitPos: number;
  private codeSize: number;
  private maxCode: number;
  private dict: Uint8Array[];
  private prevCode: number | null;
  private nextCode: number;

  constructor(minCodeSize: number, data: Uint8Array) {
    this.minCodeSize = minCodeSize;
    this.clearCode = 1 << minCodeSize;
    this.endCode = this.clearCode + 1;
    this.data = data;
    this.pos = 0;
    this.bitPos = 0;
    this.codeSize = minCodeSize + 1;
    this.maxCode = (1 << this.codeSize) - 1;
    this.dict = [];
    this.prevCode = null;
    this.nextCode = this.endCode + 1;
    this.initDictionary();
  }

  private initDictionary(): void {
    this.dict = [];
    // Initialize dictionary with single-byte entries
    for (let i = 0; i < this.clearCode; i++) {
      this.dict[i] = new Uint8Array([i]);
    }
    // Reserve clear code and end code positions
    this.dict[this.clearCode] = new Uint8Array(0);
    this.dict[this.endCode] = new Uint8Array(0);
    this.codeSize = this.minCodeSize + 1;
    this.maxCode = (1 << this.codeSize) - 1;
    this.prevCode = null;
    this.nextCode = this.endCode + 1;
  }

  private readCode(): number | null {
    let code = 0;
    for (let i = 0; i < this.codeSize; i++) {
      if (this.bitPos === 0) {
        // Need to read a new byte
        if (this.pos >= this.data.length) {
          return null;
        }
      }
      const byte = this.data[this.pos];
      const bit = (byte >> this.bitPos) & 1;
      code |= bit << i;
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bitPos = 0;
        this.pos++;
      }
    }
    return code;
  }

  decompress(): Uint8Array {
    const output: number[] = [];

    while (true) {
      // Check if we need to increase code size for this read
      // This happens when we're about to add an entry at nextCode and it exceeds maxCode
      if (
        this.prevCode !== null && this.nextCode > this.maxCode &&
        this.codeSize < 12
      ) {
        this.maxCode = this.maxCode * 2 + 1;
        this.codeSize++;
      }

      const code = this.readCode();

      if (code === null || code === this.endCode) {
        break;
      }

      if (code === this.clearCode) {
        this.initDictionary();
        continue;
      }

      if (code < this.dict.length && this.dict[code]) {
        const entry = this.dict[code];
        output.push(...entry);

        if (this.prevCode !== null && this.prevCode < this.dict.length) {
          const prevEntry = this.dict[this.prevCode];
          if (prevEntry && this.nextCode < 4096) {
            const newEntry = new Uint8Array(prevEntry.length + 1);
            newEntry.set(prevEntry);
            newEntry[prevEntry.length] = entry[0];
            this.dict[this.nextCode] = newEntry;
            this.nextCode++;
          }
        }
      } else if (this.prevCode !== null && this.prevCode < this.dict.length) {
        // Special case: code not in dictionary yet
        const prevEntry = this.dict[this.prevCode];
        if (prevEntry && this.nextCode < 4096) {
          const newEntry = new Uint8Array(prevEntry.length + 1);
          newEntry.set(prevEntry);
          newEntry[prevEntry.length] = prevEntry[0];
          this.dict[this.nextCode] = newEntry;
          this.nextCode++;

          output.push(...newEntry);
        }
      }

      this.prevCode = code;
    }

    return new Uint8Array(output);
  }
}

/**
 * LZW Encoder for GIF images
 */
export class LZWEncoder {
  private minCodeSize: number;
  private clearCode: number;
  private endCode: number;
  private codeSize: number;
  private maxCode: number;
  private dict: Map<string, number>;
  private output: number[];
  private bitBuffer: number;
  private bitCount: number;

  constructor(minCodeSize: number) {
    this.minCodeSize = minCodeSize;
    this.clearCode = 1 << minCodeSize;
    this.endCode = this.clearCode + 1;
    this.codeSize = minCodeSize + 1;
    this.maxCode = (1 << this.codeSize) - 1;
    this.dict = new Map();
    this.output = [];
    this.bitBuffer = 0;
    this.bitCount = 0;
    this.initDictionary();
  }

  private initDictionary(): void {
    this.dict.clear();
    // Initialize dictionary with single-byte entries
    for (let i = 0; i < this.clearCode; i++) {
      this.dict.set(String.fromCharCode(i), i);
    }
    this.codeSize = this.minCodeSize + 1;
    this.maxCode = (1 << this.codeSize) - 1;
  }

  private writeCode(code: number): void {
    this.bitBuffer |= code << this.bitCount;
    this.bitCount += this.codeSize;

    while (this.bitCount >= 8) {
      this.output.push(this.bitBuffer & 0xff);
      this.bitBuffer >>= 8;
      this.bitCount -= 8;
    }
  }

  compress(data: Uint8Array): Uint8Array {
    this.initDictionary();
    this.output = [];
    this.bitBuffer = 0;
    this.bitCount = 0;

    // Write clear code
    this.writeCode(this.clearCode);

    let buffer = "";
    let nextCode = this.endCode + 1;

    for (let i = 0; i < data.length; i++) {
      const k = String.fromCharCode(data[i]);
      const bufferK = buffer + k;

      if (this.dict.has(bufferK)) {
        buffer = bufferK;
      } else {
        // Output code for buffer
        const code = this.dict.get(buffer);
        if (code !== undefined) {
          this.writeCode(code);
        }

        // Add new entry to dictionary
        if (nextCode < 4096) {
          this.dict.set(bufferK, nextCode);

          // Increase code size when needed (check BEFORE incrementing nextCode)
          if (nextCode > this.maxCode && this.codeSize < 12) {
            this.maxCode = this.maxCode * 2 + 1;
            this.codeSize++;
          }

          nextCode++;
        }

        buffer = k;
      }
    }

    // Output final code
    if (buffer.length > 0) {
      const code = this.dict.get(buffer);
      if (code !== undefined) {
        this.writeCode(code);
      }
    }

    // Write end code
    this.writeCode(this.endCode);

    // Flush remaining bits
    if (this.bitCount > 0) {
      this.output.push(this.bitBuffer & 0xff);
    }

    return new Uint8Array(this.output);
  }
}
