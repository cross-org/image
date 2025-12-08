import type {
  ImageData,
  ImageFormat,
  ImageFrame,
  ImageMetadata,
  MultiFrameImageData,
} from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";
import { PNGBase } from "./png_base.ts";

/**
 * APNG (Animated PNG) format handler
 * Implements support for animated PNG images with multiple frames
 * APNG extends PNG with animation control chunks (acTL, fcTL, fdAT)
 */
export class APNGFormat extends PNGBase implements ImageFormat {
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
    this.addMetadataChunks(chunks, metadata);

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
      // Use milliseconds directly if possible (up to ~65 seconds)
      if (delay < 65536) {
        this.writeUint16(fctl, 20, delay); // delay_num
        this.writeUint16(fctl, 22, 1000); // delay_den (1/1000 sec)
      } else {
        // Fallback to 1/100 sec for longer delays
        this.writeUint16(fctl, 20, Math.round(delay / 10)); // delay_num
        this.writeUint16(fctl, 22, 100); // delay_den (1/100 sec)
      }

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
    return this.concatenateArrays(chunks);
  }

  // Helper methods for frame decoding

  private async decodeFrameData(
    chunks: Uint8Array[],
    width: number,
    height: number,
    bitDepth: number,
    colorType: number,
  ): Promise<Uint8Array> {
    // Concatenate chunks
    const idatData = this.concatenateArrays(chunks);

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
}
