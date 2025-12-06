import type { ImageData, ImageFormat } from "../types.ts";

/**
 * PNG format handler
 * Implements a pure JavaScript PNG decoder and encoder
 */
export class PNGFormat implements ImageFormat {
  readonly name = "png";
  readonly mimeType = "image/png";

  canDecode(data: Uint8Array): boolean {
    // PNG signature: 137 80 78 71 13 10 26 10
    return data.length >= 8 &&
      data[0] === 137 && data[1] === 80 &&
      data[2] === 78 && data[3] === 71 &&
      data[4] === 13 && data[5] === 10 &&
      data[6] === 26 && data[7] === 10;
  }

  async decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid PNG signature");
    }

    let pos = 8; // Skip PNG signature
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const chunks: { type: string; data: Uint8Array }[] = [];

    // Parse chunks
    while (pos < data.length) {
      const length = this.readUint32(data, pos);
      pos += 4;
      const type = String.fromCharCode(
        data[pos],
        data[pos + 1],
        data[pos + 2],
        data[pos + 3],
      );
      pos += 4;
      const chunkData = data.slice(pos, pos + length);
      pos += length;
      pos += 4; // Skip CRC

      if (type === "IHDR") {
        width = this.readUint32(chunkData, 0);
        height = this.readUint32(chunkData, 4);
        bitDepth = chunkData[8];
        colorType = chunkData[9];
      } else if (type === "IDAT") {
        chunks.push({ type, data: chunkData });
      } else if (type === "IEND") {
        break;
      }
    }

    if (width === 0 || height === 0) {
      throw new Error("Invalid PNG: missing IHDR chunk");
    }

    // Concatenate IDAT chunks
    const idatData = this.concatenateChunks(chunks);

    // Decompress data
    const decompressed = await this.inflate(idatData);

    // Unfilter and convert to RGBA
    const rgba = this.unfilterAndConvert(
      decompressed,
      width,
      height,
      bitDepth,
      colorType,
    );

    return { width, height, data: rgba };
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data } = imageData;

    // Prepare IHDR chunk
    const ihdr = new Uint8Array(13);
    this.writeUint32(ihdr, 0, width);
    this.writeUint32(ihdr, 4, height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    ihdr[10] = 0; // compression method
    ihdr[11] = 0; // filter method
    ihdr[12] = 0; // interlace method

    // Filter and compress image data
    const filtered = this.filterData(data, width, height);
    const compressed = await this.deflate(filtered);

    // Build PNG
    const chunks: Uint8Array[] = [];
    chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])); // PNG signature
    chunks.push(this.createChunk("IHDR", ihdr));
    chunks.push(this.createChunk("IDAT", compressed));
    chunks.push(this.createChunk("IEND", new Uint8Array(0)));

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  private readUint32(data: Uint8Array, offset: number): number {
    return (data[offset] << 24) | (data[offset + 1] << 16) |
      (data[offset + 2] << 8) | data[offset + 3];
  }

  private writeUint32(data: Uint8Array, offset: number, value: number): void {
    data[offset] = (value >>> 24) & 0xff;
    data[offset + 1] = (value >>> 16) & 0xff;
    data[offset + 2] = (value >>> 8) & 0xff;
    data[offset + 3] = value & 0xff;
  }

  private concatenateChunks(
    chunks: { type: string; data: Uint8Array }[],
  ): Uint8Array {
    const totalLength = chunks.reduce(
      (sum, chunk) => sum + chunk.data.length,
      0,
    );
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk.data, offset);
      offset += chunk.data.length;
    }
    return result;
  }

  private async inflate(data: Uint8Array): Promise<Uint8Array> {
    // Use DecompressionStream API (available in Deno, Node 17+, and browsers)
    const stream = new Response(data as unknown as BodyInit).body!
      .pipeThrough(new DecompressionStream("deflate"));
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  }

  private async deflate(data: Uint8Array): Promise<Uint8Array> {
    // Use CompressionStream API (available in Deno, Node 17+, and browsers)
    const stream = new Response(data as unknown as BodyInit).body!
      .pipeThrough(new CompressionStream("deflate"));
    const compressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(compressed);
  }

  private unfilterAndConvert(
    data: Uint8Array,
    width: number,
    height: number,
    bitDepth: number,
    colorType: number,
  ): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    const bytesPerPixel = this.getBytesPerPixel(colorType, bitDepth);
    const scanlineLength = width * bytesPerPixel;
    let dataPos = 0;
    const scanlines: Uint8Array[] = [];

    for (let y = 0; y < height; y++) {
      const filterType = data[dataPos++];
      const scanline = new Uint8Array(scanlineLength);

      for (let x = 0; x < scanlineLength; x++) {
        scanline[x] = data[dataPos++];
      }

      this.unfilterScanline(
        scanline,
        y > 0 ? scanlines[y - 1] : null,
        filterType,
        bytesPerPixel,
      );

      scanlines.push(scanline);

      // Convert to RGBA
      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;
        if (colorType === 6) { // RGBA
          rgba[outIdx] = scanline[x * 4];
          rgba[outIdx + 1] = scanline[x * 4 + 1];
          rgba[outIdx + 2] = scanline[x * 4 + 2];
          rgba[outIdx + 3] = scanline[x * 4 + 3];
        } else if (colorType === 2) { // RGB
          rgba[outIdx] = scanline[x * 3];
          rgba[outIdx + 1] = scanline[x * 3 + 1];
          rgba[outIdx + 2] = scanline[x * 3 + 2];
          rgba[outIdx + 3] = 255;
        } else if (colorType === 0) { // Grayscale
          const gray = scanline[x];
          rgba[outIdx] = gray;
          rgba[outIdx + 1] = gray;
          rgba[outIdx + 2] = gray;
          rgba[outIdx + 3] = 255;
        } else {
          throw new Error(`Unsupported PNG color type: ${colorType}`);
        }
      }
    }

    return rgba;
  }

  private unfilterScanline(
    scanline: Uint8Array,
    prevLine: Uint8Array | null,
    filterType: number,
    bytesPerPixel: number,
  ): void {
    for (let x = 0; x < scanline.length; x++) {
      const left = x >= bytesPerPixel ? scanline[x - bytesPerPixel] : 0;
      const above = prevLine ? prevLine[x] : 0;
      const upperLeft = (x >= bytesPerPixel && prevLine)
        ? prevLine[x - bytesPerPixel]
        : 0;

      switch (filterType) {
        case 0: // None
          break;
        case 1: // Sub
          scanline[x] = (scanline[x] + left) & 0xff;
          break;
        case 2: // Up
          scanline[x] = (scanline[x] + above) & 0xff;
          break;
        case 3: // Average
          scanline[x] = (scanline[x] + Math.floor((left + above) / 2)) & 0xff;
          break;
        case 4: // Paeth
          scanline[x] =
            (scanline[x] + this.paethPredictor(left, above, upperLeft)) & 0xff;
          break;
      }
    }
  }

  private paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);

    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  private filterData(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    // Use filter type 0 (None) for simplicity
    const filtered = new Uint8Array(height * (1 + width * 4));
    let pos = 0;

    for (let y = 0; y < height; y++) {
      filtered[pos++] = 0; // Filter type: None
      for (let x = 0; x < width * 4; x++) {
        filtered[pos++] = data[y * width * 4 + x];
      }
    }

    return filtered;
  }

  private getBytesPerPixel(colorType: number, bitDepth: number): number {
    const bitsPerPixel = this.getBitsPerPixel(colorType, bitDepth);
    return Math.ceil(bitsPerPixel / 8);
  }

  private getBitsPerPixel(colorType: number, bitDepth: number): number {
    switch (colorType) {
      case 0: // Grayscale
        return bitDepth;
      case 2: // RGB
        return bitDepth * 3;
      case 3: // Palette
        return bitDepth;
      case 4: // Grayscale + Alpha
        return bitDepth * 2;
      case 6: // RGBA
        return bitDepth * 4;
      default:
        throw new Error(`Unknown color type: ${colorType}`);
    }
  }

  private createChunk(type: string, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(12 + data.length);
    this.writeUint32(chunk, 0, data.length);
    chunk[4] = type.charCodeAt(0);
    chunk[5] = type.charCodeAt(1);
    chunk[6] = type.charCodeAt(2);
    chunk[7] = type.charCodeAt(3);
    chunk.set(data, 8);
    const crc = this.crc32(chunk.slice(4, 8 + data.length));
    this.writeUint32(chunk, 8 + data.length, crc);
    return chunk;
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}
