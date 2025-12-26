import { CurrentRuntime, Runtime } from "@cross/runtime";
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
   * Falls back to Bun's native zlib or Node.js zlib when DecompressionStream is unavailable
   */
  protected async inflate(data: Uint8Array): Promise<Uint8Array> {
    // Prefer Web DecompressionStream API (works in Deno, browsers, Node.js 18+)
    if (typeof DecompressionStream !== "undefined") {
      const stream = new Response(data as unknown as BodyInit).body!
        .pipeThrough(new DecompressionStream("deflate"));
      const decompressed = await new Response(stream).arrayBuffer();
      return new Uint8Array(decompressed);
    }

    // Fall back to Bun's native decompression if available
    if (CurrentRuntime === Runtime.Bun) {
      const bun = (globalThis as { Bun?: { inflateSync?: (data: Uint8Array) => Uint8Array } }).Bun;
      if (bun?.inflateSync) {
        return bun.inflateSync(data);
      }
    }

    // Fall back to Node.js zlib (for older Node.js versions)
    if (CurrentRuntime === Runtime.Node) {
      const { inflateSync } = await import("node:zlib");
      const result = inflateSync(data);
      return result instanceof Uint8Array ? result : new Uint8Array(result);
    }

    throw new Error(
      "Decompression not available. Requires DecompressionStream API, Bun.inflateSync, or Node.js zlib",
    );
  }

  /**
   * Compress PNG data using deflate
   * Falls back to Bun's native zlib or Node.js zlib when CompressionStream is unavailable
   */
  protected async deflate(data: Uint8Array): Promise<Uint8Array> {
    // Prefer Web CompressionStream API (works in Deno, browsers, Node.js 18+)
    if (typeof CompressionStream !== "undefined") {
      const stream = new Response(data as unknown as BodyInit).body!
        .pipeThrough(new CompressionStream("deflate"));
      const compressed = await new Response(stream).arrayBuffer();
      return new Uint8Array(compressed);
    }

    // Fall back to Bun's native compression if available
    if (CurrentRuntime === Runtime.Bun) {
      const bun = (globalThis as { Bun?: { deflateSync?: (data: Uint8Array) => Uint8Array } }).Bun;
      if (bun?.deflateSync) {
        return bun.deflateSync(data);
      }
    }

    // Fall back to Node.js zlib (for older Node.js versions)
    if (CurrentRuntime === Runtime.Node) {
      const { deflateSync } = await import("node:zlib");
      const result = deflateSync(data);
      return result instanceof Uint8Array ? result : new Uint8Array(result);
    }

    throw new Error(
      "Compression not available. Requires CompressionStream API, Bun.deflateSync, or Node.js zlib",
    );
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
      const upperLeft = (x >= bytesPerPixel && prevLine) ? prevLine[x - bytesPerPixel] : 0;

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
          scanline[x] = (scanline[x] + this.paethPredictor(left, above, upperLeft)) & 0xff;
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
  /**
   * Apply PNG filter to image data based on compression level
   * @param data Raw RGBA pixel data
   * @param width Image width
   * @param height Image height
   * @param compressionLevel Compression level (0-9, default 6)
   * @returns Filtered data with filter type byte per scanline
   */
  protected filterData(
    data: Uint8Array,
    width: number,
    height: number,
    compressionLevel = 6,
  ): Uint8Array {
    // Choose filtering strategy based on compression level
    if (compressionLevel <= 2) {
      // Fast: No filtering
      return this.applyNoFilter(data, width, height);
    } else if (compressionLevel <= 6) {
      // Balanced: Sub filter
      return this.applySubFilter(data, width, height);
    } else {
      // Best: Adaptive filtering (choose best filter per scanline)
      return this.applyAdaptiveFilter(data, width, height);
    }
  }

  /**
   * Apply filter type 0 (None) - no filtering
   */
  private applyNoFilter(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const bytesPerScanline = width * 4;
    const filtered = new Uint8Array(height * (1 + bytesPerScanline));
    let pos = 0;

    for (let y = 0; y < height; y++) {
      filtered[pos++] = 0; // Filter type: None
      const scanlineStart = y * bytesPerScanline;
      for (let x = 0; x < bytesPerScanline; x++) {
        filtered[pos++] = data[scanlineStart + x];
      }
    }

    return filtered;
  }

  /**
   * Apply filter type 1 (Sub) - subtract left pixel
   */
  private applySubFilter(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const bytesPerScanline = width * 4;
    const filtered = new Uint8Array(height * (1 + bytesPerScanline));
    let pos = 0;

    for (let y = 0; y < height; y++) {
      filtered[pos++] = 1; // Filter type: Sub
      const scanlineStart = y * bytesPerScanline;

      for (let x = 0; x < bytesPerScanline; x++) {
        const current = data[scanlineStart + x];
        const left = x >= 4 ? data[scanlineStart + x - 4] : 0;
        filtered[pos++] = (current - left) & 0xff;
      }
    }

    return filtered;
  }

  /**
   * Apply filter type 2 (Up) - subtract above pixel
   */
  private applyUpFilter(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const bytesPerScanline = width * 4;
    const filtered = new Uint8Array(height * (1 + bytesPerScanline));
    let pos = 0;

    for (let y = 0; y < height; y++) {
      filtered[pos++] = 2; // Filter type: Up
      const scanlineStart = y * bytesPerScanline;
      const prevScanlineStart = (y - 1) * bytesPerScanline;

      for (let x = 0; x < bytesPerScanline; x++) {
        const current = data[scanlineStart + x];
        const up = y > 0 ? data[prevScanlineStart + x] : 0;
        filtered[pos++] = (current - up) & 0xff;
      }
    }

    return filtered;
  }

  /**
   * Apply filter type 3 (Average) - subtract average of left and above
   */
  private applyAverageFilter(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const bytesPerScanline = width * 4;
    const filtered = new Uint8Array(height * (1 + bytesPerScanline));
    let pos = 0;

    for (let y = 0; y < height; y++) {
      filtered[pos++] = 3; // Filter type: Average
      const scanlineStart = y * bytesPerScanline;
      const prevScanlineStart = (y - 1) * bytesPerScanline;

      for (let x = 0; x < bytesPerScanline; x++) {
        const current = data[scanlineStart + x];
        const left = x >= 4 ? data[scanlineStart + x - 4] : 0;
        const up = y > 0 ? data[prevScanlineStart + x] : 0;
        const avg = Math.floor((left + up) / 2);
        filtered[pos++] = (current - avg) & 0xff;
      }
    }

    return filtered;
  }

  /**
   * Apply filter type 4 (Paeth) - Paeth predictor
   */
  private applyPaethFilter(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const bytesPerScanline = width * 4;
    const filtered = new Uint8Array(height * (1 + bytesPerScanline));
    let pos = 0;

    for (let y = 0; y < height; y++) {
      filtered[pos++] = 4; // Filter type: Paeth
      const scanlineStart = y * bytesPerScanline;
      const prevScanlineStart = (y - 1) * bytesPerScanline;

      for (let x = 0; x < bytesPerScanline; x++) {
        const current = data[scanlineStart + x];
        const left = x >= 4 ? data[scanlineStart + x - 4] : 0;
        const up = y > 0 ? data[prevScanlineStart + x] : 0;
        const upLeft = (y > 0 && x >= 4) ? data[prevScanlineStart + x - 4] : 0;
        const paeth = this.paethPredictor(left, up, upLeft);
        filtered[pos++] = (current - paeth) & 0xff;
      }
    }

    return filtered;
  }

  /**
   * Calculate sum of absolute differences for a filtered scanline
   * Lower values indicate better compression potential
   */
  private calculateFilterScore(filtered: Uint8Array): number {
    let sum = 0;
    for (let i = 1; i < filtered.length; i++) {
      const byte = filtered[i];
      // Penalize larger absolute values
      sum += byte < 128 ? byte : (256 - byte);
    }
    return sum;
  }

  /**
   * Apply adaptive filtering - choose best filter per scanline
   */
  private applyAdaptiveFilter(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const bytesPerScanline = width * 4;
    const filtered = new Uint8Array(height * (1 + bytesPerScanline));
    let outPos = 0;

    // Try each filter type and choose the best for each scanline
    const filters = [
      (y: number) => this.filterScanline(data, y, width, 0), // None
      (y: number) => this.filterScanline(data, y, width, 1), // Sub
      (y: number) => this.filterScanline(data, y, width, 2), // Up
      (y: number) => this.filterScanline(data, y, width, 3), // Average
      (y: number) => this.filterScanline(data, y, width, 4), // Paeth
    ];

    for (let y = 0; y < height; y++) {
      let bestFilter: Uint8Array | null = null;
      let bestScore = Infinity;

      // Try each filter type
      for (const filterFn of filters) {
        const result = filterFn(y);
        const score = this.calculateFilterScore(result);
        if (score < bestScore) {
          bestScore = score;
          bestFilter = result;
        }
      }

      // Copy best filter result
      if (bestFilter) {
        filtered.set(bestFilter, outPos);
        outPos += bestFilter.length;
      }
    }

    return filtered;
  }

  /**
   * Filter a single scanline with specified filter type
   */
  private filterScanline(
    data: Uint8Array,
    y: number,
    width: number,
    filterType: number,
  ): Uint8Array {
    const bytesPerScanline = width * 4;
    const result = new Uint8Array(1 + bytesPerScanline);
    result[0] = filterType;

    const scanlineStart = y * bytesPerScanline;
    const prevScanlineStart = (y - 1) * bytesPerScanline;

    for (let x = 0; x < bytesPerScanline; x++) {
      const current = data[scanlineStart + x];
      const left = x >= 4 ? data[scanlineStart + x - 4] : 0;
      const up = y > 0 ? data[prevScanlineStart + x] : 0;
      const upLeft = (y > 0 && x >= 4) ? data[prevScanlineStart + x - 4] : 0;

      let filtered: number;
      switch (filterType) {
        case 0: // None
          filtered = current;
          break;
        case 1: // Sub
          filtered = (current - left) & 0xff;
          break;
        case 2: // Up
          filtered = (current - up) & 0xff;
          break;
        case 3: // Average
          filtered = (current - Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4: // Paeth
          filtered = (current - this.paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          filtered = current;
      }

      result[x + 1] = filtered;
    }

    return result;
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

      let gpsIfdOffset = 0;

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

        // GPS IFD Pointer tag (0x8825)
        if (tag === 0x8825) {
          gpsIfdOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];
        }
      }

      // Parse GPS IFD if present
      if (gpsIfdOffset > 0 && gpsIfdOffset + 2 <= data.length) {
        this.parseGPSIFD(data, gpsIfdOffset, littleEndian, metadata);
      }
    } catch (_e) {
      // Ignore EXIF parsing errors
    }
  }

  protected parseGPSIFD(
    data: Uint8Array,
    gpsIfdOffset: number,
    littleEndian: boolean,
    metadata: ImageMetadata,
  ): void {
    try {
      const numEntries = littleEndian
        ? data[gpsIfdOffset] | (data[gpsIfdOffset + 1] << 8)
        : (data[gpsIfdOffset] << 8) | data[gpsIfdOffset + 1];

      let latRef = "";
      let lonRef = "";
      let latitude: number | undefined;
      let longitude: number | undefined;

      for (let i = 0; i < numEntries; i++) {
        const entryOffset = gpsIfdOffset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        const type = littleEndian
          ? data[entryOffset + 2] | (data[entryOffset + 3] << 8)
          : (data[entryOffset + 2] << 8) | data[entryOffset + 3];

        const valueOffset = littleEndian
          ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
            (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
          : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
            (data[entryOffset + 10] << 8) | data[entryOffset + 11];

        // GPSLatitudeRef (0x0001)
        if (tag === 0x0001 && type === 2) {
          latRef = String.fromCharCode(data[entryOffset + 8]);
        }

        // GPSLatitude (0x0002)
        if (tag === 0x0002 && type === 5 && valueOffset + 24 <= data.length) {
          const degrees = this.readRational(data, valueOffset, littleEndian);
          const minutes = this.readRational(
            data,
            valueOffset + 8,
            littleEndian,
          );
          const seconds = this.readRational(
            data,
            valueOffset + 16,
            littleEndian,
          );
          latitude = degrees + minutes / 60 + seconds / 3600;
        }

        // GPSLongitudeRef (0x0003)
        if (tag === 0x0003 && type === 2) {
          lonRef = String.fromCharCode(data[entryOffset + 8]);
        }

        // GPSLongitude (0x0004)
        if (tag === 0x0004 && type === 5 && valueOffset + 24 <= data.length) {
          const degrees = this.readRational(data, valueOffset, littleEndian);
          const minutes = this.readRational(
            data,
            valueOffset + 8,
            littleEndian,
          );
          const seconds = this.readRational(
            data,
            valueOffset + 16,
            littleEndian,
          );
          longitude = degrees + minutes / 60 + seconds / 3600;
        }
      }

      // Apply hemisphere references
      if (latitude !== undefined && latRef) {
        metadata.latitude = latRef === "S" ? -latitude : latitude;
      }
      if (longitude !== undefined && lonRef) {
        metadata.longitude = lonRef === "W" ? -longitude : longitude;
      }
    } catch (_e) {
      // Ignore GPS parsing errors
    }
  }

  protected readRational(
    data: Uint8Array,
    offset: number,
    littleEndian: boolean,
  ): number {
    const numerator = littleEndian
      ? data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) |
        (data[offset + 3] << 24)
      : (data[offset] << 24) | (data[offset + 1] << 16) |
        (data[offset + 2] << 8) | data[offset + 3];

    const denominator = littleEndian
      ? data[offset + 4] | (data[offset + 5] << 8) | (data[offset + 6] << 16) |
        (data[offset + 7] << 24)
      : (data[offset + 4] << 24) | (data[offset + 5] << 16) |
        (data[offset + 6] << 8) | data[offset + 7];

    return denominator !== 0 ? numerator / denominator : 0;
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
      const dateStr = `${date.getFullYear()}:${String(date.getMonth() + 1).padStart(2, "0")}:${
        String(date.getDate()).padStart(2, "0")
      } ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${
        String(date.getSeconds()).padStart(2, "0")
      }\0`;
      entries.push({
        tag: 0x0132,
        type: 2,
        value: new TextEncoder().encode(dateStr),
      });
    }

    // Check if we have GPS data
    const hasGPS = metadata.latitude !== undefined &&
      metadata.longitude !== undefined;

    if (entries.length === 0 && !hasGPS) return null;

    const exif: number[] = [];

    exif.push(0x49, 0x49); // "II"
    exif.push(0x2a, 0x00); // 42

    exif.push(0x08, 0x00, 0x00, 0x00);

    // Number of entries (add GPS IFD pointer if we have GPS data)
    const ifd0Entries = entries.length + (hasGPS ? 1 : 0);
    exif.push(ifd0Entries & 0xff, (ifd0Entries >> 8) & 0xff);

    let dataOffset = 8 + 2 + ifd0Entries * 12 + 4;

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

    // Add GPS IFD pointer if we have GPS data
    let gpsIfdOffset = 0;
    if (hasGPS) {
      gpsIfdOffset = dataOffset;
      // GPS IFD Pointer tag (0x8825), type 4 (LONG), count 1
      exif.push(0x25, 0x88); // Tag
      exif.push(0x04, 0x00); // Type
      exif.push(0x01, 0x00, 0x00, 0x00); // Count
      exif.push(
        gpsIfdOffset & 0xff,
        (gpsIfdOffset >> 8) & 0xff,
        (gpsIfdOffset >> 16) & 0xff,
        (gpsIfdOffset >> 24) & 0xff,
      );
    }

    exif.push(0x00, 0x00, 0x00, 0x00);

    for (const entry of entries) {
      if (entry.value.length > 4) {
        for (const byte of entry.value) {
          exif.push(byte);
        }
      }
    }

    // Add GPS IFD if we have GPS data
    if (hasGPS) {
      const gpsIfd = this.createGPSIFD(metadata, gpsIfdOffset);
      for (const byte of gpsIfd) {
        exif.push(byte);
      }
    }

    return new Uint8Array(exif);
  }

  protected createGPSIFD(
    metadata: ImageMetadata,
    gpsIfdStart: number,
  ): number[] {
    const gps: number[] = [];

    const numEntries = 4;
    gps.push(numEntries & 0xff, (numEntries >> 8) & 0xff);

    const latitude = metadata.latitude!;
    const longitude = metadata.longitude!;

    const absLat = Math.abs(latitude);
    const absLon = Math.abs(longitude);

    const latDeg = Math.floor(absLat);
    const latMin = Math.floor((absLat - latDeg) * 60);
    const latSec = ((absLat - latDeg) * 60 - latMin) * 60;

    const lonDeg = Math.floor(absLon);
    const lonMin = Math.floor((absLon - lonDeg) * 60);
    const lonSec = ((absLon - lonDeg) * 60 - lonMin) * 60;

    let dataOffset = gpsIfdStart + 2 + numEntries * 12 + 4;

    // Entry 1: GPSLatitudeRef
    gps.push(0x01, 0x00);
    gps.push(0x02, 0x00);
    gps.push(0x02, 0x00, 0x00, 0x00);
    gps.push(latitude >= 0 ? 78 : 83, 0x00, 0x00, 0x00);

    // Entry 2: GPSLatitude
    gps.push(0x02, 0x00);
    gps.push(0x05, 0x00);
    gps.push(0x03, 0x00, 0x00, 0x00);
    gps.push(
      dataOffset & 0xff,
      (dataOffset >> 8) & 0xff,
      (dataOffset >> 16) & 0xff,
      (dataOffset >> 24) & 0xff,
    );
    dataOffset += 24;

    // Entry 3: GPSLongitudeRef
    gps.push(0x03, 0x00);
    gps.push(0x02, 0x00);
    gps.push(0x02, 0x00, 0x00, 0x00);
    gps.push(longitude >= 0 ? 69 : 87, 0x00, 0x00, 0x00);

    // Entry 4: GPSLongitude
    gps.push(0x04, 0x00);
    gps.push(0x05, 0x00);
    gps.push(0x03, 0x00, 0x00, 0x00);
    gps.push(
      dataOffset & 0xff,
      (dataOffset >> 8) & 0xff,
      (dataOffset >> 16) & 0xff,
      (dataOffset >> 24) & 0xff,
    );

    gps.push(0x00, 0x00, 0x00, 0x00);

    // Write rationals
    this.writeRational(gps, latDeg, 1);
    this.writeRational(gps, latMin, 1);
    this.writeRational(gps, Math.round(latSec * 1000000), 1000000);

    this.writeRational(gps, lonDeg, 1);
    this.writeRational(gps, lonMin, 1);
    this.writeRational(gps, Math.round(lonSec * 1000000), 1000000);

    return gps;
  }

  protected writeRational(
    output: number[],
    numerator: number,
    denominator: number,
  ): void {
    output.push(
      numerator & 0xff,
      (numerator >> 8) & 0xff,
      (numerator >> 16) & 0xff,
      (numerator >> 24) & 0xff,
    );
    output.push(
      denominator & 0xff,
      (denominator >> 8) & 0xff,
      (denominator >> 16) & 0xff,
      (denominator >> 24) & 0xff,
    );
  }

  /**
   * Concatenate multiple byte arrays into a single Uint8Array
   */
  protected concatenateChunks(
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

  /**
   * Concatenate multiple Uint8Arrays into a single Uint8Array
   */
  protected concatenateArrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /**
   * Add metadata chunks to the chunks array
   * Shared method to avoid duplication between PNG and APNG encoding
   */
  protected addMetadataChunks(
    chunks: Uint8Array[],
    metadata: ImageMetadata | undefined,
  ): void {
    if (!metadata) return;

    // Add pHYs chunk for DPI information
    if (metadata.dpiX !== undefined || metadata.dpiY !== undefined) {
      const physChunk = this.createPhysChunk(metadata);
      chunks.push(this.createChunk("pHYs", physChunk));
    }

    // Add tEXt chunks for standard metadata
    if (metadata.title !== undefined) {
      chunks.push(
        this.createChunk(
          "tEXt",
          this.createTextChunk("Title", metadata.title),
        ),
      );
    }
    if (metadata.author !== undefined) {
      chunks.push(
        this.createChunk(
          "tEXt",
          this.createTextChunk("Author", metadata.author),
        ),
      );
    }
    if (metadata.description !== undefined) {
      chunks.push(
        this.createChunk(
          "tEXt",
          this.createTextChunk("Description", metadata.description),
        ),
      );
    }
    if (metadata.copyright !== undefined) {
      chunks.push(
        this.createChunk(
          "tEXt",
          this.createTextChunk("Copyright", metadata.copyright),
        ),
      );
    }

    // Add custom metadata fields
    if (metadata.custom) {
      for (const [key, value] of Object.entries(metadata.custom)) {
        chunks.push(
          this.createChunk(
            "tEXt",
            this.createTextChunk(key, String(value)),
          ),
        );
      }
    }

    // Add EXIF chunk for GPS data and creation date
    if (
      metadata.latitude !== undefined || metadata.longitude !== undefined ||
      metadata.creationDate !== undefined
    ) {
      const exifChunk = this.createExifChunk(metadata);
      if (exifChunk) {
        chunks.push(this.createChunk("eXIf", exifChunk));
      }
    }
  }

  /**
   * Get the list of metadata fields supported by PNG format
   */
  getSupportedMetadata(): Array<keyof ImageMetadata> {
    return [
      "creationDate", // eXIf chunk
      "latitude", // eXIf chunk (GPS IFD)
      "longitude", // eXIf chunk (GPS IFD)
      "dpiX", // pHYs chunk
      "dpiY", // pHYs chunk
      "title", // tEXt chunk
      "author", // tEXt chunk
      "description", // tEXt chunk
      "copyright", // tEXt chunk
    ];
  }
}
