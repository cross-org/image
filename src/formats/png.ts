import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";

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
    const metadata: ImageMetadata = {};

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
      } else if (type === "pHYs") {
        // Physical pixel dimensions
        this.parsePhysChunk(chunkData, metadata, width, height);
      } else if (type === "tEXt") {
        // Text chunk
        this.parseTextChunk(chunkData, metadata);
      } else if (type === "iTXt") {
        // International text chunk
        this.parseITxtChunk(chunkData, metadata);
      } else if (type === "eXIf") {
        // EXIF chunk
        this.parseExifChunk(chunkData, metadata);
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

    return {
      width,
      height,
      data: rgba,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    const { width, height, data, metadata } = imageData;

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

    // Add metadata chunks if available
    if (metadata) {
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

  // Metadata parsing methods

  private parsePhysChunk(
    data: Uint8Array,
    metadata: ImageMetadata,
    width: number,
    height: number,
  ): void {
    if (data.length < 9) return;

    const pixelsPerUnitX = this.readUint32(data, 0);
    const pixelsPerUnitY = this.readUint32(data, 4);
    const unit = data[8]; // 0 = unknown, 1 = meter

    if (unit === 1 && pixelsPerUnitX > 0 && pixelsPerUnitY > 0) {
      // Convert pixels per meter to DPI (1 meter = 39.3701 inches)
      metadata.dpiX = Math.round(pixelsPerUnitX / 39.3701);
      metadata.dpiY = Math.round(pixelsPerUnitY / 39.3701);
      metadata.physicalWidth = width / metadata.dpiX;
      metadata.physicalHeight = height / metadata.dpiY;
    }
  }

  private parseTextChunk(data: Uint8Array, metadata: ImageMetadata): void {
    // tEXt format: keyword\0text
    const nullIndex = data.indexOf(0);
    if (nullIndex === -1) return;

    const keyword = new TextDecoder().decode(data.slice(0, nullIndex));
    const text = new TextDecoder().decode(data.slice(nullIndex + 1));

    // Map standard keywords to metadata fields
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
        // Store as custom metadata
        if (!metadata.custom) metadata.custom = {};
        metadata.custom[keyword] = text;
    }
  }

  private parseITxtChunk(data: Uint8Array, metadata: ImageMetadata): void {
    // iTXt format: keyword\0compressed_flag\0compression_method\0language\0translated_keyword\0text
    let pos = 0;
    const nullIndex = data.indexOf(0, pos);
    if (nullIndex === -1) return;

    const keyword = new TextDecoder().decode(data.slice(pos, nullIndex));
    pos = nullIndex + 1;

    const _compressionFlag = data[pos++];
    const _compressionMethod = data[pos++];

    const languageNullIndex = data.indexOf(0, pos);
    if (languageNullIndex === -1) return;
    pos = languageNullIndex + 1;

    const translatedKeywordNullIndex = data.indexOf(0, pos);
    if (translatedKeywordNullIndex === -1) return;
    pos = translatedKeywordNullIndex + 1;

    const text = new TextDecoder("utf-8").decode(data.slice(pos));

    // Map to metadata fields (same as tEXt)
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

  private parseExifChunk(data: Uint8Array, metadata: ImageMetadata): void {
    // Basic EXIF parsing for GPS and date
    // EXIF data starts with byte order marker
    if (data.length < 8) return;

    try {
      const byteOrder = String.fromCharCode(data[0], data[1]);
      const littleEndian = byteOrder === "II";

      // Skip to IFD0 offset
      const ifd0Offset = littleEndian
        ? data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)
        : (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];

      if (ifd0Offset + 2 > data.length) return;

      // Read number of IFD entries
      const numEntries = littleEndian
        ? data[ifd0Offset] | (data[ifd0Offset + 1] << 8)
        : (data[ifd0Offset] << 8) | data[ifd0Offset + 1];

      // Parse IFD entries looking for GPS and DateTime tags
      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        if (entryOffset + 12 > data.length) break;

        const tag = littleEndian
          ? data[entryOffset] | (data[entryOffset + 1] << 8)
          : (data[entryOffset] << 8) | data[entryOffset + 1];

        // DateTime tag (0x0132)
        if (tag === 0x0132) {
          const valueOffset = littleEndian
            ? data[entryOffset + 8] | (data[entryOffset + 9] << 8) |
              (data[entryOffset + 10] << 16) | (data[entryOffset + 11] << 24)
            : (data[entryOffset + 8] << 24) | (data[entryOffset + 9] << 16) |
              (data[entryOffset + 10] << 8) | data[entryOffset + 11];

          if (valueOffset < data.length) {
            const dateStr = new TextDecoder().decode(
              data.slice(valueOffset, data.indexOf(0, valueOffset)),
            );
            // Parse EXIF datetime format: "YYYY:MM:DD HH:MM:SS"
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
    } catch (_e) {
      // Ignore EXIF parsing errors
    }
  }

  private createPhysChunk(metadata: ImageMetadata): Uint8Array {
    const chunk = new Uint8Array(9);

    // Default to 72 DPI if not specified
    const dpiX = metadata.dpiX ?? 72;
    const dpiY = metadata.dpiY ?? 72;

    // Convert DPI to pixels per meter
    const pixelsPerMeterX = Math.round(dpiX * 39.3701);
    const pixelsPerMeterY = Math.round(dpiY * 39.3701);

    this.writeUint32(chunk, 0, pixelsPerMeterX);
    this.writeUint32(chunk, 4, pixelsPerMeterY);
    chunk[8] = 1; // Unit is meters

    return chunk;
  }

  private createTextChunk(keyword: string, text: string): Uint8Array {
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const chunk = new Uint8Array(keywordBytes.length + 1 + textBytes.length);

    chunk.set(keywordBytes, 0);
    chunk[keywordBytes.length] = 0; // Null separator
    chunk.set(textBytes, keywordBytes.length + 1);

    return chunk;
  }

  private createExifChunk(metadata: ImageMetadata): Uint8Array | null {
    // Create a minimal EXIF structure
    const entries: { tag: number; type: number; value: Uint8Array }[] = [];

    // Add DateTime if available
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
        type: 2, // ASCII
        value: new TextEncoder().encode(dateStr),
      });
    }

    if (entries.length === 0) return null;

    // Build minimal EXIF structure
    const exif: number[] = [];

    // Byte order marker (little endian)
    exif.push(0x49, 0x49); // "II"
    exif.push(0x2a, 0x00); // 42

    // Offset to IFD0 (8 bytes from start)
    exif.push(0x08, 0x00, 0x00, 0x00);

    // Number of IFD entries
    exif.push(entries.length & 0xff, (entries.length >> 8) & 0xff);

    // Calculate data offset (after all entries)
    let dataOffset = 8 + 2 + entries.length * 12 + 4;

    for (const entry of entries) {
      // Tag
      exif.push(entry.tag & 0xff, (entry.tag >> 8) & 0xff);
      // Type
      exif.push(entry.type & 0xff, (entry.type >> 8) & 0xff);
      // Count
      const count = entry.value.length;
      exif.push(
        count & 0xff,
        (count >> 8) & 0xff,
        (count >> 16) & 0xff,
        (count >> 24) & 0xff,
      );
      // Value/Offset
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

    // Next IFD offset (0 = no more IFDs)
    exif.push(0x00, 0x00, 0x00, 0x00);

    // Append data for entries that didn't fit in value field
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
