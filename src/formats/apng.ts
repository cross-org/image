import type {
  ImageData,
  ImageFormat,
  ImageFrame,
  ImageMetadata,
  MultiFrameImageData,
} from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

// Constants for unit conversions
const INCHES_PER_METER = 39.3701;

/**
 * APNG (Animated PNG) format handler
 * Implements support for animated PNG images with multiple frames
 * APNG extends PNG with animation control chunks (acTL, fcTL, fdAT)
 */
export class APNGFormat implements ImageFormat {
  /** Format name identifier */
  readonly name = "apng";
  /** MIME type for APNG images */
  readonly mimeType = "image/apng";

  /**
   * Check if this format supports multiple frames (animations)
   * @returns true for APNG format
   */
  supportsMultipleFrames(): boolean {
    return true;
  }

  /**
   * Check if the given data is an APNG image
   * @param data Raw image data to check
   * @returns true if data has PNG signature and contains acTL chunk
   */
  canDecode(data: Uint8Array): boolean {
    // PNG signature: 137 80 78 71 13 10 26 10
    if (
      data.length < 8 ||
      data[0] !== 137 || data[1] !== 80 ||
      data[2] !== 78 || data[3] !== 71 ||
      data[4] !== 13 || data[5] !== 10 ||
      data[6] !== 26 || data[7] !== 10
    ) {
      return false;
    }

    // Check for acTL (animation control) chunk to identify APNG
    let pos = 8;
    while (pos + 8 < data.length) {
      const length = this.readUint32(data, pos);
      pos += 4;
      const type = String.fromCharCode(
        data[pos],
        data[pos + 1],
        data[pos + 2],
        data[pos + 3],
      );
      pos += 4;

      if (type === "acTL") {
        return true;
      }

      pos += length + 4; // Skip chunk data and CRC

      if (type === "IDAT") {
        // If we hit IDAT before acTL, it's not an APNG
        return false;
      }
    }

    return false;
  }

  /**
   * Decode APNG image data to RGBA (first frame only)
   * @param data Raw APNG image data
   * @returns Decoded image data with RGBA pixels of first frame
   */
  async decode(data: Uint8Array): Promise<ImageData> {
    const frames = await this.decodeFrames(data);
    const firstFrame = frames.frames[0];

    return {
      width: firstFrame.width,
      height: firstFrame.height,
      data: firstFrame.data,
      metadata: frames.metadata,
    };
  }

  /**
   * Decode all frames from APNG image
   * @param data Raw APNG image data
   * @returns Decoded multi-frame image data
   */
  async decodeFrames(data: Uint8Array): Promise<MultiFrameImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid APNG signature or missing acTL chunk");
    }

    let pos = 8; // Skip PNG signature
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const metadata: ImageMetadata = {};
    const frames: ImageFrame[] = [];

    // First pass: parse structure and extract metadata
    const chunkList: Array<{
      type: string;
      data: Uint8Array;
      pos: number;
    }> = [];

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
      const chunkPos = pos;
      pos += length;
      pos += 4; // Skip CRC

      chunkList.push({ type, data: chunkData, pos: chunkPos });

      if (type === "IHDR") {
        width = this.readUint32(chunkData, 0);
        height = this.readUint32(chunkData, 4);
        bitDepth = chunkData[8];
        colorType = chunkData[9];
      } else if (type === "acTL") {
        // Animation control chunk - we'll use frame count later if needed
        // const numFrames = this.readUint32(chunkData, 0);
        // const numPlays = this.readUint32(chunkData, 4);
      } else if (type === "pHYs") {
        this.parsePhysChunk(chunkData, metadata, width, height);
      } else if (type === "tEXt") {
        this.parseTextChunk(chunkData, metadata);
      } else if (type === "iTXt") {
        this.parseITxtChunk(chunkData, metadata);
      } else if (type === "eXIf") {
        this.parseExifChunk(chunkData, metadata);
      } else if (type === "IEND") {
        break;
      }
    }

    if (width === 0 || height === 0) {
      throw new Error("Invalid APNG: missing IHDR chunk");
    }

    validateImageDimensions(width, height);

    // Second pass: decode frames
    let currentFrameControl: {
      width: number;
      height: number;
      xOffset: number;
      yOffset: number;
      delay: number;
      disposal: "none" | "background" | "previous";
      blend: "source" | "over";
    } | null = null;
    let frameDataChunks: Uint8Array[] = [];
    let defaultImageChunks: Uint8Array[] = [];
    let hasSeenFcTL = false;

    for (const chunk of chunkList) {
      if (chunk.type === "fcTL") {
        // If we have a previous frame to decode
        if (frameDataChunks.length > 0 && currentFrameControl) {
          const frameData = await this.decodeFrameData(
            frameDataChunks,
            currentFrameControl.width,
            currentFrameControl.height,
            bitDepth,
            colorType,
          );

          frames.push({
            width: currentFrameControl.width,
            height: currentFrameControl.height,
            data: frameData,
            frameMetadata: {
              delay: currentFrameControl.delay,
              disposal: currentFrameControl.disposal,
              left: currentFrameControl.xOffset,
              top: currentFrameControl.yOffset,
            },
          });

          frameDataChunks = [];
        }

        // Parse frame control
        const _fcSeq = this.readUint32(chunk.data, 0);
        const fcWidth = this.readUint32(chunk.data, 4);
        const fcHeight = this.readUint32(chunk.data, 8);
        const fcXOffset = this.readUint32(chunk.data, 12);
        const fcYOffset = this.readUint32(chunk.data, 16);
        const delayNum = this.readUint16(chunk.data, 20);
        const delayDen = this.readUint16(chunk.data, 22);
        const disposeOp = chunk.data[24];
        const blendOp = chunk.data[25];

        const delay = delayDen === 0
          ? delayNum * 10
          : Math.round((delayNum / delayDen) * 1000);

        let disposal: "none" | "background" | "previous" = "none";
        if (disposeOp === 1) disposal = "background";
        else if (disposeOp === 2) disposal = "previous";

        currentFrameControl = {
          width: fcWidth,
          height: fcHeight,
          xOffset: fcXOffset,
          yOffset: fcYOffset,
          delay,
          disposal,
          blend: blendOp === 1 ? "over" : "source",
        };

        // If this is the first fcTL and we have default image data, use it for this frame
        if (frames.length === 0 && defaultImageChunks.length > 0) {
          frameDataChunks = defaultImageChunks;
          defaultImageChunks = [];
        }

        hasSeenFcTL = true;
      } else if (chunk.type === "IDAT") {
        if (!hasSeenFcTL) {
          // Collect default image chunks
          defaultImageChunks.push(chunk.data);
        } else if (currentFrameControl) {
          // IDAT after first fcTL belongs to that frame
          frameDataChunks.push(chunk.data);
        }
      } else if (chunk.type === "fdAT") {
        // Frame data chunk (skip sequence number)
        const _frameSeq = this.readUint32(chunk.data, 0);
        frameDataChunks.push(chunk.data.slice(4));
      } else if (chunk.type === "IEND") {
        // Decode last frame if any
        if (frameDataChunks.length > 0 && currentFrameControl) {
          const frameData = await this.decodeFrameData(
            frameDataChunks,
            currentFrameControl.width,
            currentFrameControl.height,
            bitDepth,
            colorType,
          );

          frames.push({
            width: currentFrameControl.width,
            height: currentFrameControl.height,
            data: frameData,
            frameMetadata: {
              delay: currentFrameControl.delay,
              disposal: currentFrameControl.disposal,
              left: currentFrameControl.xOffset,
              top: currentFrameControl.yOffset,
            },
          });
        } else if (defaultImageChunks.length > 0) {
          // Only default image, no fcTL found - treat as single frame
          const frameData = await this.decodeFrameData(
            defaultImageChunks,
            width,
            height,
            bitDepth,
            colorType,
          );

          frames.push({
            width,
            height,
            data: frameData,
            frameMetadata: {
              delay: 0,
              disposal: "none",
              left: 0,
              top: 0,
            },
          });
        }
        break;
      }
    }

    return {
      width,
      height,
      frames,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Encode RGBA image data to APNG format (single frame)
   * @param imageData Image data to encode
   * @returns Encoded APNG image bytes
   */
  encode(imageData: ImageData): Promise<Uint8Array> {
    // For single frame, create a multi-frame with one frame
    const multiFrame: MultiFrameImageData = {
      width: imageData.width,
      height: imageData.height,
      frames: [{
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
        frameMetadata: { delay: 0 },
      }],
      metadata: imageData.metadata,
    };

    return this.encodeFrames(multiFrame);
  }

  /**
   * Encode multi-frame image data to APNG format
   * @param imageData Multi-frame image data to encode
   * @returns Encoded APNG image bytes
   */
  async encodeFrames(imageData: MultiFrameImageData): Promise<Uint8Array> {
    const { width, height, frames, metadata } = imageData;

    if (frames.length === 0) {
      throw new Error("No frames to encode");
    }

    // Prepare IHDR chunk
    const ihdr = new Uint8Array(13);
    this.writeUint32(ihdr, 0, width);
    this.writeUint32(ihdr, 4, height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    ihdr[10] = 0; // compression method
    ihdr[11] = 0; // filter method
    ihdr[12] = 0; // interlace method

    // Build PNG
    const chunks: Uint8Array[] = [];
    chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])); // PNG signature
    chunks.push(this.createChunk("IHDR", ihdr));

    // Add acTL chunk for animation control
    const actl = new Uint8Array(8);
    this.writeUint32(actl, 0, frames.length); // num_frames
    this.writeUint32(actl, 4, 0); // num_plays (0 = infinite)
    chunks.push(this.createChunk("acTL", actl));

    // Add metadata chunks if available
    if (metadata) {
      if (metadata.dpiX !== undefined || metadata.dpiY !== undefined) {
        const physChunk = this.createPhysChunk(metadata);
        chunks.push(this.createChunk("pHYs", physChunk));
      }

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

    // Add frames
    let sequenceNumber = 0;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const fctl = new Uint8Array(26);

      this.writeUint32(fctl, 0, sequenceNumber++); // sequence_number
      this.writeUint32(fctl, 4, frame.width); // width
      this.writeUint32(fctl, 8, frame.height); // height
      this.writeUint32(fctl, 12, frame.frameMetadata?.left ?? 0); // x_offset
      this.writeUint32(fctl, 16, frame.frameMetadata?.top ?? 0); // y_offset

      // Convert delay from milliseconds to fraction
      const delay = frame.frameMetadata?.delay ?? 100;
      const delayNum = Math.round(delay / 10);
      this.writeUint16(fctl, 20, delayNum); // delay_num
      this.writeUint16(fctl, 22, 100); // delay_den (1/100 sec)

      // Disposal method
      let disposeOp = 0; // APNG_DISPOSE_OP_NONE
      if (frame.frameMetadata?.disposal === "background") {
        disposeOp = 1; // APNG_DISPOSE_OP_BACKGROUND
      } else if (frame.frameMetadata?.disposal === "previous") {
        disposeOp = 2; // APNG_DISPOSE_OP_PREVIOUS
      }
      fctl[24] = disposeOp;
      fctl[25] = 0; // blend_op: APNG_BLEND_OP_SOURCE

      chunks.push(this.createChunk("fcTL", fctl));

      // Filter and compress frame data
      const filtered = this.filterData(frame.data, frame.width, frame.height);
      const compressed = await this.deflate(filtered);

      if (i === 0) {
        // First frame uses IDAT
        chunks.push(this.createChunk("IDAT", compressed));
      } else {
        // Subsequent frames use fdAT with sequence number
        const fdat = new Uint8Array(4 + compressed.length);
        this.writeUint32(fdat, 0, sequenceNumber++);
        fdat.set(compressed, 4);
        chunks.push(this.createChunk("fdAT", fdat));
      }
    }

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

  // Helper methods for reading/writing data

  private readUint32(data: Uint8Array, offset: number): number {
    return (data[offset] << 24) | (data[offset + 1] << 16) |
      (data[offset + 2] << 8) | data[offset + 3];
  }

  private readUint16(data: Uint8Array, offset: number): number {
    return (data[offset] << 8) | data[offset + 1];
  }

  private writeUint32(data: Uint8Array, offset: number, value: number): void {
    data[offset] = (value >>> 24) & 0xff;
    data[offset + 1] = (value >>> 16) & 0xff;
    data[offset + 2] = (value >>> 8) & 0xff;
    data[offset + 3] = value & 0xff;
  }

  private writeUint16(data: Uint8Array, offset: number, value: number): void {
    data[offset] = (value >>> 8) & 0xff;
    data[offset + 1] = value & 0xff;
  }

  private async decodeFrameData(
    chunks: Uint8Array[],
    width: number,
    height: number,
    bitDepth: number,
    colorType: number,
  ): Promise<Uint8Array> {
    // Concatenate chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const idatData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      idatData.set(chunk, offset);
      offset += chunk.length;
    }

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

    return rgba;
  }

  private async inflate(data: Uint8Array): Promise<Uint8Array> {
    const stream = new Response(data as unknown as BodyInit).body!
      .pipeThrough(new DecompressionStream("deflate"));
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  }

  private async deflate(data: Uint8Array): Promise<Uint8Array> {
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

  // Metadata parsing methods (similar to PNG format)

  private parsePhysChunk(
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

  private parseTextChunk(data: Uint8Array, metadata: ImageMetadata): void {
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

  private parseITxtChunk(data: Uint8Array, metadata: ImageMetadata): void {
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

  private parseExifChunk(data: Uint8Array, metadata: ImageMetadata): void {
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

  private createPhysChunk(metadata: ImageMetadata): Uint8Array {
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

  private createTextChunk(keyword: string, text: string): Uint8Array {
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const chunk = new Uint8Array(keywordBytes.length + 1 + textBytes.length);

    chunk.set(keywordBytes, 0);
    chunk[keywordBytes.length] = 0;
    chunk.set(textBytes, keywordBytes.length + 1);

    return chunk;
  }

  private createExifChunk(metadata: ImageMetadata): Uint8Array | null {
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
