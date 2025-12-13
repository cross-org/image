/**
 * PackBits compression/decompression for TIFF
 * PackBits is a simple run-length encoding (RLE) scheme used in TIFF images
 * Compression code: 32773
 *
 * Format:
 * - Header byte n:
 *   - If n >= 0 and n <= 127: Copy the next n+1 bytes literally
 *   - If n >= -127 and n <= -1: Repeat the next byte -n+1 times
 *   - If n = -128: No operation (skip)
 */

/**
 * Compress data using PackBits RLE
 * @param data Uncompressed data
 * @returns Compressed data
 */
export function packBitsCompress(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;

  while (i < data.length) {
    // Look for runs (repeated bytes)
    let runLength = 1;
    while (
      i + runLength < data.length &&
      data[i + runLength] === data[i] &&
      runLength < 128
    ) {
      runLength++;
    }

    // If we have a run of 2 or more, encode it as a run
    if (runLength >= 2) {
      result.push(-(runLength - 1) & 0xff); // Two's complement representation
      result.push(data[i]);
      i += runLength;
    } else {
      // Look for literals (non-repeating bytes)
      const literalStart = i;
      let literalLength = 1;

      while (
        i + literalLength < data.length &&
        literalLength < 128
      ) {
        // Check if we're starting a run
        if (
          i + literalLength + 1 < data.length &&
          data[i + literalLength] === data[i + literalLength + 1]
        ) {
          // We found a run, stop the literal sequence here
          break;
        }
        literalLength++;
      }

      result.push(literalLength - 1);
      for (let j = 0; j < literalLength; j++) {
        result.push(data[literalStart + j]);
      }
      i += literalLength;
    }
  }

  return new Uint8Array(result);
}

/**
 * Decompress PackBits RLE data
 * @param data Compressed data
 * @returns Decompressed data
 */
export function packBitsDecompress(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;

  while (i < data.length) {
    const header = data[i++];

    if (header === 128) {
      // No operation, skip
      continue;
    } else if (header < 128) {
      // Literal run: copy next (header + 1) bytes
      const count = header + 1;
      for (let j = 0; j < count && i < data.length; j++) {
        result.push(data[i++]);
      }
    } else {
      // Repeated run: repeat next byte (257 - header) times
      const count = 257 - header;
      if (i < data.length) {
        const value = data[i++];
        for (let j = 0; j < count; j++) {
          result.push(value);
        }
      }
    }
  }

  return new Uint8Array(result);
}
