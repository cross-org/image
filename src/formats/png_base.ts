import type { ImageMetadata } from "../types.ts";

// Constants for unit conversions
const INCHES_PER_METER = 39.3701;

/**
 * Base class for PNG and APNG format handlers
 * Contains shared utility methods for PNG chunk manipulation and metadata parsing
 */
export abstract class PNGBase {
  /**
   * Read a 32-bit unsigned integer (big-endian)
   */
  protected readUint32(data: Uint8Array, offset: number): number {
    return (data[offset] << 24) | (data[offset + 1] << 16) |
      (data[offset + 2] << 8) | data[offset + 3];
  }

  /**
   * Read a 16-bit unsigned integer (big-endian)
   */
  protected readUint16(data: Uint8Array, offset: number): number {
    return (data[offset] << 8) | data[offset + 1];
  }

  /**
   * Write a 32-bit unsigned integer (big-endian)
   */
  protected writeUint32(
    data: Uint8Array,
    offset: number,
    value: number,
  ): void {
    data[offset] = (value >>> 24) & 0xff;
    data[offset + 1] = (value >>> 16) & 0xff;
    data[offset + 2] = (value >>> 8) & 0xff;
    data[offset + 3] = value & 0xff;
  }

  /**
   * Write a 16-bit unsigned integer (big-endian)
   */
  protected writeUint16(
    data: Uint8Array,
    offset: number,
    value: number,
  ): void {
    data[offset] = (value >>> 8) & 0xff;
    data[offset + 1] = value & 0xff;
  }

  /**
   * Decompress PNG data using deflate
   */
  protected async inflate(data: Uint8Array): Promise<Uint8Array> {
    const stream = new Response(data as unknown as BodyInit).body!
      .pipeThrough(new DecompressionStream("deflate"));
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  }

  /**
   * Compress PNG data using deflate
   */
  protected async deflate(data: Uint8Array): Promise<Uint8Array> {
    const stream = new Response(data as unknown as BodyInit).body!
      .pipeThrough(new CompressionStream("deflate"));
    const compressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(compressed);
  }

  /**
   * Unfilter PNG scanlines and convert to RGBA
   */
  protected unfilterAndConvert(
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

  /**
   * Unfilter a single PNG scanline
   */
  protected unfilterScanline(
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

  /**
   * Paeth predictor for PNG filtering
   */
  protected paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);

    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  /**
   * Filter PNG data for encoding (using filter type 0 - None)
   */
  protected filterData(
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

  /**
   * Get bytes per pixel for a given color type and bit depth
   */
  protected getBytesPerPixel(colorType: number, bitDepth: number): number {
    const bitsPerPixel = this.getBitsPerPixel(colorType, bitDepth);
    return Math.ceil(bitsPerPixel / 8);
  }

  /**
   * Get bits per pixel for a given color type and bit depth
   */
  protected getBitsPerPixel(colorType: number, bitDepth: number): number {
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

  /**
   * Create a PNG chunk with length, type, data, and CRC
   */
  protected createChunk(type: string, data: Uint8Array): Uint8Array {
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

  /**
   * Calculate CRC32 checksum
   */
  protected crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // Metadata parsing methods

  /**
   * Parse pHYs (physical pixel dimensions) chunk
   */
  protected parsePhysChunk(
    data: Uint8Array,
    metadata: ImageMetadata,
    width: number,
    height: number,
  ): void {
    if (data.length < 9) return;

    const pixelsPerUnitX = this.readUint32(data, 0);
    const pixelsPerUnitY = this.readUint32(data, 4);
    const unit = data[8];

    if (unit === 1 && pixelsPerUnitX > 0 && pixelsPerUnitY > 0) {
      metadata.dpiX = Math.round(pixelsPerUnitX / INCHES_PER_METER);
      metadata.dpiY = Math.round(pixelsPerUnitY / INCHES_PER_METER);
      metadata.physicalWidth = width / metadata.dpiX;
      metadata.physicalHeight = height / metadata.dpiY;
    }
  }

  /**
   * Parse tEXt (text) chunk
   */
  protected parseTextChunk(
    data: Uint8Array,
    metadata: ImageMetadata,
  ): void {
    const nullIndex = data.indexOf(0);
    if (nullIndex === -1) return;

    const keyword = new TextDecoder().decode(data.slice(0, nullIndex));
    const text = new TextDecoder().decode(data.slice(nullIndex + 1));

    switch (keyword.toLowerCase()) {
      case "title":
        metadata.title = text;
        break;
      case "author":
        metadata.author = text;
        break;
      case "description":
        metadata.description = text;
        break;
      case "copyright":
        metadata.copyright = text;
        break;
      default:
        if (!metadata.custom) metadata.custom = {};
        metadata.custom[keyword] = text;
    }
  }

  /**
   * Parse iTXt (international text) chunk
   */
  protected parseITxtChunk(
    data: Uint8Array,
    metadata: ImageMetadata,
  ): void {
    let pos = 0;
    const nullIndex = data.indexOf(0, pos);
    if (nullIndex === -1 || pos >= data.length) return;

    const keyword = new TextDecoder().decode(data.slice(pos, nullIndex));
    pos = nullIndex + 1;

    if (pos + 2 > data.length) return;
    pos += 2; // Skip compression flag and method

    const languageNullIndex = data.indexOf(0, pos);
    if (languageNullIndex === -1 || pos >= data.length) return;
    pos = languageNullIndex + 1;

    const translatedKeywordNullIndex = data.indexOf(0, pos);
    if (translatedKeywordNullIndex === -1 || pos >= data.length) return;
    pos = translatedKeywordNullIndex + 1;

    if (pos >= data.length) return;
    const text = new TextDecoder("utf-8").decode(data.slice(pos));

    switch (keyword.toLowerCase()) {
      case "title":
        metadata.title = text;
        break;
      case "author":
        metadata.author = text;
        break;
      case "description":
        metadata.description = text;
        break;
      case "copyright":
        metadata.copyright = text;
        break;
      default:
        if (!metadata.custom) metadata.custom = {};
        metadata.custom[keyword] = text;
    }
  }

  /**
   * Parse eXIf (EXIF) chunk
   */
  protected parseExifChunk(
    data: Uint8Array,
    metadata: ImageMetadata,
  ): void {
    if (data.length < 8) return;

    try {
      const byteOrder = String.fromCharCode(data[0], data[1]);
      const littleEndian = byteOrder === "II";

      const ifd0Offset = littleEndian
        ? data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)
        : (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];

      if (ifd0Offset + 2 > data.length) return;

      const numEntries = littleEndian
        ? data[ifd0Offset] | (data[ifd0Offset + 1] << 8)
        : (data[ifd0Offset] << 8) | data[ifd0Offset + 1];

      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        if (tag === 0x0132) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const nullIndex = data.indexOf(0, valueOffset);
            if (nullIndex > valueOffset) {
              const dateStr = new TextDecoder().decode(
                data.slice(valueOffset, nullIndex),
              );
              const match = dateStr.match(
                /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
              );
              if (match) {
                metadata.creationDate = new Date(
                  parseInt(match[1]),
                  parseInt(match[2]) - 1,
                  parseInt(match[3]),
                  parseInt(match[4]),
                  parseInt(match[5]),
                  parseInt(match[6]),
                );
              }
            }
          }
        }
      }
    } catch (_e) {
      // Ignore EXIF parsing errors
    }
  }

  /**
   * Create pHYs (physical pixel dimensions) chunk
   */
  protected createPhysChunk(metadata: ImageMetadata): Uint8Array {
    const chunk = new Uint8Array(9);

    const dpiX = metadata.dpiX ?? 72;
    const dpiY = metadata.dpiY ?? 72;

    const pixelsPerMeterX = Math.round(dpiX * INCHES_PER_METER);
    const pixelsPerMeterY = Math.round(dpiY * INCHES_PER_METER);

    this.writeUint32(chunk, 0, pixelsPerMeterX);
    this.writeUint32(chunk, 4, pixelsPerMeterY);
    chunk[8] = 1;

    return chunk;
  }

  /**
   * Create tEXt (text) chunk
   */
  protected createTextChunk(keyword: string, text: string): Uint8Array {
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const chunk = new Uint8Array(keywordBytes.length + 1 + textBytes.length);

    chunk.set(keywordBytes, 0);
    chunk[keywordBytes.length] = 0;
    chunk.set(textBytes, keywordBytes.length + 1);

    return chunk;
  }

  /**
   * Create eXIf (EXIF) chunk
   */
  protected createExifChunk(metadata: ImageMetadata): Uint8Array | null {
    const entries: { tag: number; type: number; value: Uint8Array }[] = [];

    if (metadata.creationDate) {
      const date = metadata.creationDate;
      const dateStr = `${date.getFullYear()}:${
        String(date.getMonth() + 1).padStart(2, "0")
      }:${String(date.getDate()).padStart(2, "0")} ${
        String(date.getHours()).padStart(2, "0")
      }:${String(date.getMinutes()).padStart(2, "0")}:${
        String(date.getSeconds()).padStart(2, "0")
      }\0`;
      entries.push({
        tag: 0x0132,
        type: 2,
        value: new TextEncoder().encode(dateStr),
      });
    }

    if (entries.length === 0) return null;

    const exif: number[] = [];

    exif.push(0x49, 0x49); // "II"
    exif.push(0x2a, 0x00); // 42

    exif.push(0x08, 0x00, 0x00, 0x00);

    exif.push(entries.length & 0xff, (entries.length >> 8) & 0xff);

    let dataOffset = 8 + 2 + entries.length * 12 + 4;

    for (const entry of entries) {
      exif.push(entry.tag & 0xff, (entry.tag >> 8) & 0xff);
      exif.push(entry.type & 0xff, (entry.type >> 8) & 0xff);
      const count = entry.value.length;
      exif.push(
        count & 0xff,
        (count >> 8) & 0xff,
        (count >> 16) & 0xff,
        (count >> 24) & 0xff,
      );
      if (entry.value.length <= 4) {
        for (let i = 0; i < 4; i++) {
          exif.push(i < entry.value.length ? entry.value[i] : 0);
        }
      } else {
        exif.push(
          dataOffset & 0xff,
          (dataOffset >> 8) & 0xff,
          (dataOffset >> 16) & 0xff,
          (dataOffset >> 24) & 0xff,
        );
        dataOffset += entry.value.length;
      }
    }

    exif.push(0x00, 0x00, 0x00, 0x00);

    for (const entry of entries) {
      if (entry.value.length > 4) {
        for (const byte of entry.value) {
          exif.push(byte);
        }
      }
    }

    return new Uint8Array(exif);
  }
}
