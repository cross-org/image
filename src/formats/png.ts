import type { ImageData, ImageFormat, ImageMetadata } from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";
import { PNGBase } from "./png_base.ts";

/**
 * PNG format handler
 * Implements a pure JavaScript PNG decoder and encoder
 */
export class PNGFormat extends PNGBase implements ImageFormat {
  /** Format name identifier */
  readonly name = "png";
  /** MIME type for PNG images */
  readonly mimeType = "image/png";

  /**
   * Check if the given data is a PNG image
   * @param data Raw image data to check
   * @returns true if data has PNG signature
   */
  canDecode(data: Uint8Array): boolean {
    // PNG signature: 137 80 78 71 13 10 26 10
    return data.length >= 8 &&
      data[0] === 137 && data[1] === 80 &&
      data[2] === 78 && data[3] === 71 &&
      data[4] === 13 && data[5] === 10 &&
      data[6] === 26 && data[7] === 10;
  }

  /**
   * Decode PNG image data to RGBA
   * @param data Raw PNG image data
   * @returns Decoded image data with RGBA pixels
   */
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

    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

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

  /**
   * Encode RGBA image data to PNG format
   * @param imageData Image data to encode
   * @returns Encoded PNG image bytes
   */
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
}
