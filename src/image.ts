import type {
  ImageData,
  ImageFormat,
  ImageMetadata,
  ResizeOptions,
} from "./types.ts";
import { resizeBilinear, resizeNearest } from "./utils/resize.ts";
import { PNGFormat } from "./formats/png.ts";
import { JPEGFormat } from "./formats/jpeg.ts";
import { WebPFormat } from "./formats/webp.ts";

/**
 * Main Image class for reading, manipulating, and saving images
 */
export class Image {
  private imageData: ImageData | null = null;
  private static formats: ImageFormat[] = [
    new PNGFormat(),
    new JPEGFormat(),
    new WebPFormat(),
  ];

  /**
   * Get the current image width
   */
  get width(): number {
    if (!this.imageData) throw new Error("No image loaded");
    return this.imageData.width;
  }

  /**
   * Get the current image height
   */
  get height(): number {
    if (!this.imageData) throw new Error("No image loaded");
    return this.imageData.height;
  }

  /**
   * Get the current image data
   */
  get data(): Uint8Array {
    if (!this.imageData) throw new Error("No image loaded");
    return this.imageData.data;
  }

  /**
   * Get the current image metadata
   */
  get metadata(): ImageMetadata | undefined {
    if (!this.imageData) throw new Error("No image loaded");
    return this.imageData.metadata;
  }

  /**
   * Set or update image metadata
   * @param metadata Metadata to set or merge
   * @param merge If true, merges with existing metadata. If false, replaces it. Default: true
   */
  setMetadata(metadata: ImageMetadata, merge = true): this {
    if (!this.imageData) throw new Error("No image loaded");

    if (merge && this.imageData.metadata) {
      this.imageData.metadata = {
        ...this.imageData.metadata,
        ...metadata,
        custom: {
          ...(this.imageData.metadata.custom || {}),
          ...(metadata.custom || {}),
        },
      };
    } else {
      this.imageData.metadata = { ...metadata };
    }

    return this;
  }

  /**
   * Get a specific metadata field
   * @param key The metadata field to retrieve
   * @returns The metadata value or undefined
   */
  getMetadataField<K extends keyof ImageMetadata>(
    key: K,
  ): ImageMetadata[K] | undefined {
    if (!this.imageData) throw new Error("No image loaded");
    return this.imageData.metadata?.[key];
  }

  /**
   * Get position (latitude, longitude) from metadata
   * @returns Object with latitude and longitude, or undefined if not available
   */
  getPosition(): { latitude: number; longitude: number } | undefined {
    const latitude = this.getMetadataField("latitude");
    const longitude = this.getMetadataField("longitude");

    if (latitude !== undefined && longitude !== undefined) {
      return { latitude, longitude };
    }

    return undefined;
  }

  /**
   * Set position (latitude, longitude) in metadata
   * @param latitude GPS latitude
   * @param longitude GPS longitude
   */
  setPosition(latitude: number, longitude: number): this {
    return this.setMetadata({ latitude, longitude });
  }

  /**
   * Get physical dimensions from metadata
   * @returns Object with DPI and physical dimensions, or undefined if not available
   */
  getDimensions(): {
    dpiX?: number;
    dpiY?: number;
    physicalWidth?: number;
    physicalHeight?: number;
  } | undefined {
    const dpiX = this.getMetadataField("dpiX");
    const dpiY = this.getMetadataField("dpiY");
    const physicalWidth = this.getMetadataField("physicalWidth");
    const physicalHeight = this.getMetadataField("physicalHeight");

    if (
      dpiX !== undefined || dpiY !== undefined || physicalWidth !== undefined ||
      physicalHeight !== undefined
    ) {
      return { dpiX, dpiY, physicalWidth, physicalHeight };
    }

    return undefined;
  }

  /**
   * Set physical dimensions in metadata
   * @param dpiX Dots per inch (horizontal)
   * @param dpiY Dots per inch (vertical), defaults to dpiX if not provided
   */
  setDPI(dpiX: number, dpiY?: number): this {
    const actualDpiY = dpiY ?? dpiX;

    // Calculate physical dimensions based on pixel dimensions and DPI
    const physicalWidth = this.width / dpiX;
    const physicalHeight = this.height / actualDpiY;

    return this.setMetadata({
      dpiX,
      dpiY: actualDpiY,
      physicalWidth,
      physicalHeight,
    });
  }

  /**
   * Register a custom image format
   * @param format Custom format implementation
   */
  static registerFormat(format: ImageFormat): void {
    Image.formats.push(format);
  }

  /**
   * Get all registered formats
   */
  static getFormats(): readonly ImageFormat[] {
    return Image.formats;
  }

  /**
   * Read an image from bytes
   * @param data Raw image data
   * @param format Optional format hint (e.g., "png", "jpeg", "webp")
   * @returns Image instance
   */
  static async read(data: Uint8Array, format?: string): Promise<Image> {
    const image = new Image();

    // Try specified format first
    if (format) {
      const handler = Image.formats.find((f) => f.name === format);
      if (handler && handler.canDecode(data)) {
        image.imageData = await handler.decode(data);
        return image;
      }
    }

    // Auto-detect format
    for (const handler of Image.formats) {
      if (handler.canDecode(data)) {
        image.imageData = await handler.decode(data);
        return image;
      }
    }

    throw new Error("Unsupported or unrecognized image format");
  }

  /**
   * Create an image from raw RGBA data
   * @param width Image width
   * @param height Image height
   * @param data Raw RGBA pixel data (4 bytes per pixel)
   * @returns Image instance
   */
  static fromRGBA(width: number, height: number, data: Uint8Array): Image {
    if (data.length !== width * height * 4) {
      throw new Error(
        `Data length mismatch: expected ${
          width * height * 4
        }, got ${data.length}`,
      );
    }

    const image = new Image();
    image.imageData = { width, height, data: new Uint8Array(data) };
    return image;
  }

  /**
   * Resize the image
   * @param options Resize options
   * @returns This image instance for chaining
   */
  resize(options: ResizeOptions): this {
    if (!this.imageData) throw new Error("No image loaded");

    const { width, height, method = "bilinear" } = options;
    const { data: srcData, width: srcWidth, height: srcHeight } =
      this.imageData;

    let resizedData: Uint8Array;
    if (method === "nearest") {
      resizedData = resizeNearest(srcData, srcWidth, srcHeight, width, height);
    } else {
      resizedData = resizeBilinear(srcData, srcWidth, srcHeight, width, height);
    }

    // Preserve metadata when resizing
    const metadata = this.imageData.metadata;

    this.imageData = {
      width,
      height,
      data: resizedData,
      metadata: metadata ? { ...metadata } : undefined,
    };

    // Update physical dimensions if DPI is set
    if (this.imageData.metadata) {
      if (metadata?.dpiX) {
        this.imageData.metadata.physicalWidth = width / metadata.dpiX;
      }
      if (metadata?.dpiY) {
        this.imageData.metadata.physicalHeight = height / metadata.dpiY;
      }
    }

    return this;
  }

  /**
   * Save the image to bytes in the specified format
   * @param format Format name (e.g., "png", "jpeg", "webp")
   * @returns Encoded image bytes
   */
  async save(format: string): Promise<Uint8Array> {
    if (!this.imageData) throw new Error("No image loaded");

    const handler = Image.formats.find((f) => f.name === format);
    if (!handler) {
      throw new Error(`Unsupported format: ${format}`);
    }

    return await handler.encode(this.imageData);
  }

  /**
   * Clone this image
   * @returns New image instance with copied data and metadata
   */
  clone(): Image {
    if (!this.imageData) throw new Error("No image loaded");

    const image = new Image();
    image.imageData = {
      width: this.imageData.width,
      height: this.imageData.height,
      data: new Uint8Array(this.imageData.data),
      metadata: this.imageData.metadata
        ? {
          ...this.imageData.metadata,
          custom: this.imageData.metadata.custom
            ? { ...this.imageData.metadata.custom }
            : undefined,
        }
        : undefined,
    };
    return image;
  }
}
