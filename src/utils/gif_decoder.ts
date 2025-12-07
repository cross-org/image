/**
 * Pure JavaScript GIF decoder implementation
 * Supports GIF87a and GIF89a formats with LZW decompression
 */

import { LZWDecoder } from "./lzw.ts";

interface GIFImage {
  width: number;
  height: number;
  data: Uint8Array; // RGBA data
}

interface GIFFrame {
  width: number;
  height: number;
  left: number;
  top: number;
  data: Uint8Array; // RGBA data
  delay: number; // in centiseconds (1/100 of a second)
  disposal: number; // disposal method
}

export class GIFDecoder {
  private data: Uint8Array;
  private pos: number;

  constructor(data: Uint8Array) {
    this.data = data;
    this.pos = 0;
  }

  private readByte(): number {
    if (this.pos >= this.data.length) {
      throw new Error("Unexpected end of GIF data");
    }
    return this.data[this.pos++];
  }

  private readUint16LE(): number {
    const low = this.readByte();
    const high = this.readByte();
    return low | (high << 8);
  }

  private readBytes(count: number): Uint8Array {
    if (this.pos + count > this.data.length) {
      throw new Error("Unexpected end of GIF data");
    }
    const result = this.data.slice(this.pos, this.pos + count);
    this.pos += count;
    return result;
  }

  private readColorTable(size: number): Uint8Array {
    // Each color is 3 bytes (RGB)
    return this.readBytes(size * 3);
  }

  private readDataSubBlocks(): Uint8Array {
    const blocks: number[] = [];
    while (true) {
      const blockSize = this.readByte();
      if (blockSize === 0) break;
      const blockData = this.readBytes(blockSize);
      blocks.push(...blockData);
    }
    return new Uint8Array(blocks);
  }

  decode(): GIFImage {
    // Verify GIF signature
    const signature = this.readBytes(3);
    const version = this.readBytes(3);

    if (
      signature[0] !== 0x47 || signature[1] !== 0x49 || signature[2] !== 0x46 ||
      (version[0] !== 0x38) ||
      (version[1] !== 0x37 && version[1] !== 0x39) ||
      (version[2] !== 0x61)
    ) {
      throw new Error("Invalid GIF signature");
    }

    // Read Logical Screen Descriptor
    const width = this.readUint16LE();
    const height = this.readUint16LE();
    const packed = this.readByte();
    const backgroundColorIndex = this.readByte();
    const _aspectRatio = this.readByte();

    const hasGlobalColorTable = (packed & 0x80) !== 0;
    const _colorResolution = ((packed & 0x70) >> 4) + 1;
    const _sortFlag = (packed & 0x08) !== 0;
    const globalColorTableSize = 2 << (packed & 0x07);

    let globalColorTable: Uint8Array | null = null;
    if (hasGlobalColorTable) {
      globalColorTable = this.readColorTable(globalColorTableSize);
    }

    // Parse data stream
    let imageWidth = 0;
    let imageHeight = 0;
    let imageLeft = 0;
    let imageTop = 0;
    let localColorTable: Uint8Array | null = null;
    let transparentColorIndex: number | null = null;
    let interlaced = false;

    while (this.pos < this.data.length) {
      const separator = this.readByte();

      if (separator === 0x21) {
        // Extension
        const label = this.readByte();

        if (label === 0xf9) {
          // Graphic Control Extension
          const _blockSize = this.readByte();
          const packed = this.readByte();
          const hasTransparent = (packed & 0x01) !== 0;
          const _delayTime = this.readUint16LE();
          const transparentIndex = this.readByte();
          const _terminator = this.readByte();

          if (hasTransparent) {
            transparentColorIndex = transparentIndex;
          }
        } else {
          // Skip other extensions
          this.readDataSubBlocks();
        }
      } else if (separator === 0x2c) {
        // Image Descriptor
        imageLeft = this.readUint16LE();
        imageTop = this.readUint16LE();
        imageWidth = this.readUint16LE();
        imageHeight = this.readUint16LE();
        const packed = this.readByte();

        const hasLocalColorTable = (packed & 0x80) !== 0;
        interlaced = (packed & 0x40) !== 0;
        const localColorTableSize = 2 << (packed & 0x07);

        if (hasLocalColorTable) {
          localColorTable = this.readColorTable(localColorTableSize);
        }

        // Read image data
        const minCodeSize = this.readByte();
        const compressedData = this.readDataSubBlocks();

        // Decompress using LZW
        const decoder = new LZWDecoder(minCodeSize, compressedData);
        const indexedData = decoder.decompress();

        // Convert indexed to RGBA
        const colorTable = localColorTable || globalColorTable;
        if (!colorTable) {
          throw new Error("No color table available");
        }

        return this.indexedToRGBA(
          indexedData,
          imageWidth,
          imageHeight,
          colorTable,
          transparentColorIndex,
          interlaced,
          width,
          height,
          imageLeft,
          imageTop,
          backgroundColorIndex,
        );
      } else if (separator === 0x3b) {
        // Trailer - end of GIF
        break;
      } else if (separator === 0x00) {
        // Skip null bytes
        continue;
      } else {
        throw new Error(`Unknown separator: 0x${separator.toString(16)}`);
      }
    }

    throw new Error("No image data found in GIF");
  }

  /**
   * Decode all frames from an animated GIF
   * @returns Object with canvas dimensions and array of frames
   */
  decodeAllFrames(): {
    width: number;
    height: number;
    frames: GIFFrame[];
  } {
    // Reset position
    this.pos = 0;

    // Verify GIF signature
    const signature = this.readBytes(3);
    const version = this.readBytes(3);

    if (
      signature[0] !== 0x47 || signature[1] !== 0x49 || signature[2] !== 0x46 ||
      (version[0] !== 0x38) ||
      (version[1] !== 0x37 && version[1] !== 0x39) ||
      (version[2] !== 0x61)
    ) {
      throw new Error("Invalid GIF signature");
    }

    // Read Logical Screen Descriptor
    const width = this.readUint16LE();
    const height = this.readUint16LE();
    const packed = this.readByte();
    const _backgroundColorIndex = this.readByte();
    const _aspectRatio = this.readByte();

    const hasGlobalColorTable = (packed & 0x80) !== 0;
    // Color table size: 2^(n+1) where n is the 3 least significant bits
    const globalColorTableSize = 2 << (packed & 0x07);

    let globalColorTable: Uint8Array | null = null;
    if (hasGlobalColorTable) {
      globalColorTable = this.readColorTable(globalColorTableSize);
    }

    const frames: GIFFrame[] = [];

    // Parse data stream for all frames
    let transparentColorIndex: number | null = null;
    let delayTime = 0;
    let disposalMethod = 0;

    while (this.pos < this.data.length) {
      const separator = this.readByte();

      if (separator === 0x21) {
        // Extension
        const label = this.readByte();

        if (label === 0xf9) {
          // Graphic Control Extension
          const _blockSize = this.readByte();
          const packed = this.readByte();
          disposalMethod = (packed >> 2) & 0x07;
          const hasTransparent = (packed & 0x01) !== 0;
          delayTime = this.readUint16LE();
          const transparentIndex = this.readByte();
          const _terminator = this.readByte();

          if (hasTransparent) {
            transparentColorIndex = transparentIndex;
          }
        } else {
          // Skip other extensions
          this.readDataSubBlocks();
        }
      } else if (separator === 0x2c) {
        // Image Descriptor
        const imageLeft = this.readUint16LE();
        const imageTop = this.readUint16LE();
        const imageWidth = this.readUint16LE();
        const imageHeight = this.readUint16LE();
        const packed = this.readByte();

        const hasLocalColorTable = (packed & 0x80) !== 0;
        const interlaced = (packed & 0x40) !== 0;
        // Color table size: 2^(n+1) where n is the 3 least significant bits
        const localColorTableSize = 2 << (packed & 0x07);

        let localColorTable: Uint8Array | null = null;
        if (hasLocalColorTable) {
          localColorTable = this.readColorTable(localColorTableSize);
        }

        // Read image data
        const minCodeSize = this.readByte();
        const compressedData = this.readDataSubBlocks();

        // Decompress using LZW
        const decoder = new LZWDecoder(minCodeSize, compressedData);
        const indexedData = decoder.decompress();

        // Convert indexed to RGBA
        const colorTable = localColorTable || globalColorTable;
        if (!colorTable) {
          throw new Error("No color table available");
        }

        // Deinterlace if necessary
        const deinterlaced = interlaced
          ? this.deinterlace(indexedData, imageWidth, imageHeight)
          : indexedData;

        // Create frame with just the image data (not full canvas)
        const frameData = new Uint8Array(imageWidth * imageHeight * 4);

        for (let y = 0; y < imageHeight; y++) {
          for (let x = 0; x < imageWidth; x++) {
            const srcIdx = y * imageWidth + x;
            if (srcIdx >= deinterlaced.length) continue;

            const colorIndex = deinterlaced[srcIdx];
            const dstIdx = (y * imageWidth + x) * 4;

            if (
              transparentColorIndex !== null &&
              colorIndex === transparentColorIndex
            ) {
              // Transparent pixel
              frameData[dstIdx] = 0;
              frameData[dstIdx + 1] = 0;
              frameData[dstIdx + 2] = 0;
              frameData[dstIdx + 3] = 0;
            } else {
              // Copy color from color table
              const colorOffset = colorIndex * 3;
              if (colorOffset + 2 < colorTable.length) {
                frameData[dstIdx] = colorTable[colorOffset];
                frameData[dstIdx + 1] = colorTable[colorOffset + 1];
                frameData[dstIdx + 2] = colorTable[colorOffset + 2];
                frameData[dstIdx + 3] = 255;
              }
            }
          }
        }

        frames.push({
          width: imageWidth,
          height: imageHeight,
          left: imageLeft,
          top: imageTop,
          data: frameData,
          delay: delayTime,
          disposal: disposalMethod,
        });

        // Reset graphic control extension state
        transparentColorIndex = null;
        delayTime = 0;
        disposalMethod = 0;
      } else if (separator === 0x3b) {
        // Trailer - end of GIF
        break;
      } else if (separator === 0x00) {
        // Skip null bytes
        continue;
      } else {
        throw new Error(`Unknown separator: 0x${separator.toString(16)}`);
      }
    }

    if (frames.length === 0) {
      throw new Error("No image data found in GIF");
    }

    return {
      width,
      height,
      frames,
    };
  }

  private indexedToRGBA(
    indexedData: Uint8Array,
    imageWidth: number,
    imageHeight: number,
    colorTable: Uint8Array,
    transparentColorIndex: number | null,
    interlaced: boolean,
    canvasWidth: number,
    canvasHeight: number,
    imageLeft: number,
    imageTop: number,
    backgroundColorIndex: number,
  ): GIFImage {
    // Create RGBA buffer for full canvas
    const rgba = new Uint8Array(canvasWidth * canvasHeight * 4);

    // Fill with background color
    const bgR = colorTable[backgroundColorIndex * 3] || 0;
    const bgG = colorTable[backgroundColorIndex * 3 + 1] || 0;
    const bgB = colorTable[backgroundColorIndex * 3 + 2] || 0;

    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = bgR;
      rgba[i + 1] = bgG;
      rgba[i + 2] = bgB;
      rgba[i + 3] = 255;
    }

    // Deinterlace if necessary
    const deinterlaced = interlaced
      ? this.deinterlace(indexedData, imageWidth, imageHeight)
      : indexedData;

    // Copy image data to canvas
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const srcIdx = y * imageWidth + x;
        if (srcIdx >= deinterlaced.length) continue;

        const colorIndex = deinterlaced[srcIdx];
        const canvasX = imageLeft + x;
        const canvasY = imageTop + y;

        if (canvasX >= canvasWidth || canvasY >= canvasHeight) continue;

        const dstIdx = (canvasY * canvasWidth + canvasX) * 4;

        if (
          transparentColorIndex !== null && colorIndex === transparentColorIndex
        ) {
          // Transparent pixel
          rgba[dstIdx + 3] = 0;
        } else {
          // Copy color from color table
          const colorOffset = colorIndex * 3;
          if (colorOffset + 2 < colorTable.length) {
            rgba[dstIdx] = colorTable[colorOffset];
            rgba[dstIdx + 1] = colorTable[colorOffset + 1];
            rgba[dstIdx + 2] = colorTable[colorOffset + 2];
            rgba[dstIdx + 3] = 255;
          }
        }
      }
    }

    return {
      width: canvasWidth,
      height: canvasHeight,
      data: rgba,
    };
  }

  private deinterlace(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const deinterlaced = new Uint8Array(data.length);
    const passes = [
      { start: 0, step: 8 }, // Pass 1: every 8th row, starting with row 0
      { start: 4, step: 8 }, // Pass 2: every 8th row, starting with row 4
      { start: 2, step: 4 }, // Pass 3: every 4th row, starting with row 2
      { start: 1, step: 2 }, // Pass 4: every 2nd row, starting with row 1
    ];

    let srcIdx = 0;
    for (const pass of passes) {
      for (let y = pass.start; y < height; y += pass.step) {
        for (let x = 0; x < width; x++) {
          if (srcIdx >= data.length) break;
          const dstIdx = y * width + x;
          deinterlaced[dstIdx] = data[srcIdx++];
        }
      }
    }

    return deinterlaced;
  }
}
