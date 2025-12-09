import type {
  ImageData,
  ImageFormat,
  ImageMetadata,
  MultiFrameImageData,
  ResizeOptions,
} from "./types.ts";
import {
  resizeBicubic,
  resizeBilinear,
  resizeNearest,
} from "./utils/resize.ts";
import {
  adjustBrightness,
  adjustContrast,
  adjustExposure,
  adjustHue,
  adjustSaturation,
  boxBlur,
  composite,
  crop,
  fillRect,
  flipHorizontal,
  flipVertical,
  gaussianBlur,
  grayscale,
  invert,
  medianFilter,
  rotate180,
  rotate270,
  rotate90,
  sepia,
  sharpen,
} from "./utils/image_processing.ts";
import { PNGFormat } from "./formats/png.ts";
import { APNGFormat } from "./formats/apng.ts";
import { JPEGFormat } from "./formats/jpeg.ts";
import { WebPFormat } from "./formats/webp.ts";
import { GIFFormat } from "./formats/gif.ts";
import { TIFFFormat } from "./formats/tiff.ts";
import { BMPFormat } from "./formats/bmp.ts";
import { ICOFormat } from "./formats/ico.ts";
import { DNGFormat } from "./formats/dng.ts";
import { PAMFormat } from "./formats/pam.ts";
import { PCXFormat } from "./formats/pcx.ts";
import { PPMFormat } from "./formats/ppm.ts";
import { ASCIIFormat } from "./formats/ascii.ts";
import { validateImageDimensions } from "./utils/security.ts";

/**
 * Main Image class for reading, manipulating, and saving images
 */
export class Image {
  private imageData: ImageData | null = null;
  private static formats: ImageFormat[] = [
    new PNGFormat(),
    new APNGFormat(),
    new JPEGFormat(),
    new WebPFormat(),
    new GIFFormat(),
    new TIFFFormat(),
    new BMPFormat(),
    new ICOFormat(),
    new DNGFormat(),
    new PAMFormat(),
    new PCXFormat(),
    new PPMFormat(),
    new ASCIIFormat(),
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
   * Decode an image from bytes
   * @param data Raw image data
   * @param format Optional format hint (e.g., "png", "jpeg", "webp")
   * @returns Image instance
   */
  static async decode(data: Uint8Array, format?: string): Promise<Image> {
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
   * Read an image from bytes
   * @deprecated Use `decode()` instead. This method will be removed in a future version.
   * @param data Raw image data
   * @param format Optional format hint (e.g., "png", "jpeg", "webp")
   * @returns Image instance
   */
  static read(data: Uint8Array, format?: string): Promise<Image> {
    return Image.decode(data, format);
  }

  /**
   * Decode all frames from a multi-frame image (GIF animation, multi-page TIFF)
   * @param data Raw image data
   * @param format Optional format hint (e.g., "gif", "tiff")
   * @returns MultiFrameImageData with all frames
   */
  static async decodeFrames(
    data: Uint8Array,
    format?: string,
  ): Promise<MultiFrameImageData> {
    // Try specified format first
    if (format) {
      const handler = Image.formats.find((f) => f.name === format);
      if (handler && handler.canDecode(data) && handler.decodeFrames) {
        return await handler.decodeFrames(data);
      }
    }

    // Auto-detect format
    for (const handler of Image.formats) {
      if (handler.canDecode(data) && handler.decodeFrames) {
        return await handler.decodeFrames(data);
      }
    }

    throw new Error(
      "Unsupported or unrecognized multi-frame image format",
    );
  }

  /**
   * Read all frames from a multi-frame image (GIF animation, multi-page TIFF)
   * @deprecated Use `decodeFrames()` instead. This method will be removed in a future version.
   * @param data Raw image data
   * @param format Optional format hint (e.g., "gif", "tiff")
   * @returns MultiFrameImageData with all frames
   */
  static readFrames(
    data: Uint8Array,
    format?: string,
  ): Promise<MultiFrameImageData> {
    return Image.decodeFrames(data, format);
  }

  /**
   * Encode multi-frame image data to bytes in the specified format
   * @param format Format name (e.g., "gif", "tiff")
   * @param imageData Multi-frame image data to encode
   * @param options Optional format-specific encoding options
   * @returns Encoded image bytes
   */
  static async encodeFrames(
    format: string,
    imageData: MultiFrameImageData,
    options?: unknown,
  ): Promise<Uint8Array> {
    const handler = Image.formats.find((f) => f.name === format);

    if (!handler) {
      throw new Error(`Unsupported format: ${format}`);
    }

    if (!handler.encodeFrames) {
      throw new Error(
        `Format ${format} does not support multi-frame encoding`,
      );
    }

    return await handler.encodeFrames(imageData, options);
  }

  /**
   * Save multi-frame image data to bytes in the specified format
   * @deprecated Use `encodeFrames()` instead. This method will be removed in a future version.
   * @param format Format name (e.g., "gif", "tiff")
   * @param imageData Multi-frame image data to encode
   * @param options Optional format-specific encoding options
   * @returns Encoded image bytes
   */
  static saveFrames(
    format: string,
    imageData: MultiFrameImageData,
    options?: unknown,
  ): Promise<Uint8Array> {
    return Image.encodeFrames(format, imageData, options);
  }

  /**
   * Create an image from raw RGBA data
   * @param width Image width
   * @param height Image height
   * @param data Raw RGBA pixel data (4 bytes per pixel)
   * @returns Image instance
   */
  static fromRGBA(width: number, height: number, data: Uint8Array): Image {
    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

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
   * Create a blank image with the specified dimensions and color
   * @param width Image width
   * @param height Image height
   * @param r Red component (0-255, default: 0)
   * @param g Green component (0-255, default: 0)
   * @param b Blue component (0-255, default: 0)
   * @param a Alpha component (0-255, default: 255)
   * @returns Image instance
   */
  static create(
    width: number,
    height: number,
    r = 0,
    g = 0,
    b = 0,
    a = 255,
  ): Image {
    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

    const data = new Uint8Array(width * height * 4);

    // Fill with the specified color
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }

    const image = new Image();
    image.imageData = { width, height, data };
    return image;
  }

  /**
   * Resize the image
   * @param options Resize options
   * @returns This image instance for chaining
   */
  resize(options: ResizeOptions): this {
    if (!this.imageData) throw new Error("No image loaded");

    const { width, height, method = "bilinear", fit = "stretch" } = options;

    // Validate new dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

    const { data: srcData, width: srcWidth, height: srcHeight } =
      this.imageData;

    // Handle fitting modes
    let targetWidth = width;
    let targetHeight = height;
    let shouldCenter = false;

    const fitMode = fit === "contain" ? "fit" : fit === "cover" ? "fill" : fit;

    if (fitMode === "fit" || fitMode === "fill") {
      const srcAspect = srcWidth / srcHeight;
      const targetAspect = width / height;

      if (fitMode === "fit") {
        // Fit within dimensions (letterbox)
        if (srcAspect > targetAspect) {
          // Source is wider - fit to width
          targetWidth = width;
          targetHeight = Math.round(width / srcAspect);
        } else {
          // Source is taller - fit to height
          targetWidth = Math.round(height * srcAspect);
          targetHeight = height;
        }
        shouldCenter = true;
      } else {
        // Fill dimensions (crop)
        if (srcAspect > targetAspect) {
          // Source is wider - fit to height and crop width
          targetWidth = Math.round(height * srcAspect);
          targetHeight = height;
        } else {
          // Source is taller - fit to width and crop height
          targetWidth = width;
          targetHeight = Math.round(width / srcAspect);
        }
        shouldCenter = true;
      }
    }

    // Perform the resize
    let resizedData: Uint8Array;
    if (method === "nearest") {
      resizedData = resizeNearest(
        srcData,
        srcWidth,
        srcHeight,
        targetWidth,
        targetHeight,
      );
    } else if (method === "bicubic") {
      resizedData = resizeBicubic(
        srcData,
        srcWidth,
        srcHeight,
        targetWidth,
        targetHeight,
      );
    } else {
      resizedData = resizeBilinear(
        srcData,
        srcWidth,
        srcHeight,
        targetWidth,
        targetHeight,
      );
    }

    // Preserve metadata when resizing
    const metadata = this.imageData.metadata;

    // If we need to center (fit mode) or crop (fill mode), create a canvas
    if (shouldCenter && (targetWidth !== width || targetHeight !== height)) {
      const canvas = new Uint8Array(width * height * 4);
      // Fill with transparent black by default
      canvas.fill(0);

      if (fitMode === "fit") {
        // Center the resized image (letterbox)
        const offsetX = Math.floor((width - targetWidth) / 2);
        const offsetY = Math.floor((height - targetHeight) / 2);

        for (let y = 0; y < targetHeight; y++) {
          for (let x = 0; x < targetWidth; x++) {
            const srcIdx = (y * targetWidth + x) * 4;
            const dstIdx = ((y + offsetY) * width + (x + offsetX)) * 4;
            canvas[dstIdx] = resizedData[srcIdx];
            canvas[dstIdx + 1] = resizedData[srcIdx + 1];
            canvas[dstIdx + 2] = resizedData[srcIdx + 2];
            canvas[dstIdx + 3] = resizedData[srcIdx + 3];
          }
        }
        resizedData = canvas;
      } else {
        // Crop to fill (center crop)
        const offsetX = Math.floor((targetWidth - width) / 2);
        const offsetY = Math.floor((targetHeight - height) / 2);

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const srcIdx = ((y + offsetY) * targetWidth + (x + offsetX)) * 4;
            const dstIdx = (y * width + x) * 4;
            canvas[dstIdx] = resizedData[srcIdx];
            canvas[dstIdx + 1] = resizedData[srcIdx + 1];
            canvas[dstIdx + 2] = resizedData[srcIdx + 2];
            canvas[dstIdx + 3] = resizedData[srcIdx + 3];
          }
        }
        resizedData = canvas;
      }
    }

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
   * Encode the image to bytes in the specified format
   * @param format Format name (e.g., "png", "jpeg", "webp", "ascii")
   * @param options Optional format-specific encoding options
   * @returns Encoded image bytes
   */
  async encode(format: string, options?: unknown): Promise<Uint8Array> {
    if (!this.imageData) throw new Error("No image loaded");

    const handler = Image.formats.find((f) => f.name === format);
    if (!handler) {
      throw new Error(`Unsupported format: ${format}`);
    }

    return await handler.encode(this.imageData, options);
  }

  /**
   * Save the image to bytes in the specified format
   * @deprecated Use `encode()` instead. This method will be removed in a future version.
   * @param format Format name (e.g., "png", "jpeg", "webp", "ascii")
   * @param options Optional format-specific encoding options
   * @returns Encoded image bytes
   */
  save(format: string, options?: unknown): Promise<Uint8Array> {
    return this.encode(format, options);
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

  /**
   * Composite another image on top of this image at the specified position
   * @param overlay Image to place on top
   * @param x X position (can be negative)
   * @param y Y position (can be negative)
   * @param opacity Opacity of overlay (0-1, default: 1)
   * @returns This image instance for chaining
   */
  composite(overlay: Image, x: number, y: number, opacity = 1): this {
    if (!this.imageData) throw new Error("No image loaded");
    if (!overlay.imageData) throw new Error("Overlay has no image loaded");

    this.imageData.data = composite(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
      overlay.imageData.data,
      overlay.imageData.width,
      overlay.imageData.height,
      x,
      y,
      opacity,
    );

    return this;
  }

  /**
   * Adjust brightness of the image
   * @param amount Brightness adjustment (-1 to 1, where 0 is no change)
   * @returns This image instance for chaining
   */
  brightness(amount: number): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = adjustBrightness(this.imageData.data, amount);

    return this;
  }

  /**
   * Adjust contrast of the image
   * @param amount Contrast adjustment (-1 to 1, where 0 is no change)
   * @returns This image instance for chaining
   */
  contrast(amount: number): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = adjustContrast(this.imageData.data, amount);

    return this;
  }

  /**
   * Adjust exposure of the image
   * @param amount Exposure adjustment in stops (-3 to 3, where 0 is no change)
   * @returns This image instance for chaining
   */
  exposure(amount: number): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = adjustExposure(this.imageData.data, amount);

    return this;
  }

  /**
   * Adjust saturation of the image
   * @param amount Saturation adjustment (-1 to 1, where 0 is no change)
   * @returns This image instance for chaining
   */
  saturation(amount: number): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = adjustSaturation(this.imageData.data, amount);

    return this;
  }

  /**
   * Adjust hue of the image by rotating the color wheel
   * @param degrees Hue rotation in degrees (any value accepted, wraps at 360)
   * @returns This image instance for chaining
   */
  hue(degrees: number): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = adjustHue(this.imageData.data, degrees);

    return this;
  }

  /**
   * Invert colors of the image
   * @returns This image instance for chaining
   */
  invert(): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = invert(this.imageData.data);

    return this;
  }

  /**
   * Convert the image to grayscale
   * @returns This image instance for chaining
   */
  grayscale(): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = grayscale(this.imageData.data);

    return this;
  }

  /**
   * Apply sepia tone effect to the image
   * @returns This image instance for chaining
   */
  sepia(): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = sepia(this.imageData.data);

    return this;
  }

  /**
   * Apply box blur filter to the image
   * @param radius Blur radius (default: 1)
   * @returns This image instance for chaining
   */
  blur(radius = 1): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = boxBlur(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
      radius,
    );

    return this;
  }

  /**
   * Apply Gaussian blur filter to the image
   * @param radius Blur radius (default: 1)
   * @param sigma Optional standard deviation (if not provided, calculated from radius)
   * @returns This image instance for chaining
   */
  gaussianBlur(radius = 1, sigma?: number): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = gaussianBlur(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
      radius,
      sigma,
    );

    return this;
  }

  /**
   * Apply sharpen filter to the image
   * @param amount Sharpening amount (0-1, default: 0.5)
   * @returns This image instance for chaining
   */
  sharpen(amount = 0.5): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = sharpen(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
      amount,
    );

    return this;
  }

  /**
   * Apply median filter to reduce noise
   * @param radius Filter radius (default: 1)
   * @returns This image instance for chaining
   */
  medianFilter(radius = 1): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = medianFilter(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
      radius,
    );

    return this;
  }

  /**
   * Fill a rectangular region with a color
   * @param x Starting X position
   * @param y Starting Y position
   * @param width Width of the fill region
   * @param height Height of the fill region
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @param a Alpha component (0-255, default: 255)
   * @returns This image instance for chaining
   */
  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = fillRect(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
      x,
      y,
      width,
      height,
      r,
      g,
      b,
      a,
    );

    return this;
  }

  /**
   * Crop the image to a rectangular region
   * @param x Starting X position
   * @param y Starting Y position
   * @param width Width of the crop region
   * @param height Height of the crop region
   * @returns This image instance for chaining
   */
  crop(x: number, y: number, width: number, height: number): this {
    if (!this.imageData) throw new Error("No image loaded");

    const result = crop(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
      x,
      y,
      width,
      height,
    );

    this.imageData.width = result.width;
    this.imageData.height = result.height;
    this.imageData.data = result.data;

    // Update physical dimensions if DPI is set
    if (this.imageData.metadata) {
      const metadata = this.imageData.metadata;
      if (metadata.dpiX) {
        this.imageData.metadata.physicalWidth = result.width / metadata.dpiX;
      }
      if (metadata.dpiY) {
        this.imageData.metadata.physicalHeight = result.height / metadata.dpiY;
      }
    }

    return this;
  }

  /**
   * Get the pixel color at the specified position
   * @param x X position
   * @param y Y position
   * @returns Object with r, g, b, a components (0-255) or undefined if out of bounds
   */
  getPixel(
    x: number,
    y: number,
  ): { r: number; g: number; b: number; a: number } | undefined {
    if (!this.imageData) throw new Error("No image loaded");

    if (
      x < 0 || x >= this.imageData.width || y < 0 || y >= this.imageData.height
    ) {
      return undefined;
    }

    const idx = (y * this.imageData.width + x) * 4;
    return {
      r: this.imageData.data[idx],
      g: this.imageData.data[idx + 1],
      b: this.imageData.data[idx + 2],
      a: this.imageData.data[idx + 3],
    };
  }

  /**
   * Set the pixel color at the specified position
   * @param x X position
   * @param y Y position
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @param a Alpha component (0-255, default: 255)
   * @returns This image instance for chaining
   */
  setPixel(
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ): this {
    if (!this.imageData) throw new Error("No image loaded");

    if (
      x < 0 || x >= this.imageData.width || y < 0 || y >= this.imageData.height
    ) {
      return this;
    }

    const idx = (y * this.imageData.width + x) * 4;
    this.imageData.data[idx] = r;
    this.imageData.data[idx + 1] = g;
    this.imageData.data[idx + 2] = b;
    this.imageData.data[idx + 3] = a;

    return this;
  }

  /**
   * Rotate the image 90 degrees clockwise
   * @returns This image instance for chaining
   */
  rotate90(): this {
    if (!this.imageData) throw new Error("No image loaded");

    const result = rotate90(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
    );

    this.imageData.width = result.width;
    this.imageData.height = result.height;
    this.imageData.data = result.data;

    // Update physical dimensions if DPI is set
    if (this.imageData.metadata) {
      const metadata = this.imageData.metadata;
      if (metadata.dpiX && metadata.dpiY) {
        // Swap physical dimensions
        const tempPhysical = metadata.physicalWidth;
        this.imageData.metadata.physicalWidth = metadata.physicalHeight;
        this.imageData.metadata.physicalHeight = tempPhysical;
        // Swap DPI
        const tempDpi = metadata.dpiX;
        this.imageData.metadata.dpiX = metadata.dpiY;
        this.imageData.metadata.dpiY = tempDpi;
      }
    }

    return this;
  }

  /**
   * Rotate the image 180 degrees
   * @returns This image instance for chaining
   */
  rotate180(): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = rotate180(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
    );

    return this;
  }

  /**
   * Rotate the image 270 degrees clockwise (or 90 degrees counter-clockwise)
   * @returns This image instance for chaining
   */
  rotate270(): this {
    if (!this.imageData) throw new Error("No image loaded");

    const result = rotate270(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
    );

    this.imageData.width = result.width;
    this.imageData.height = result.height;
    this.imageData.data = result.data;

    // Update physical dimensions if DPI is set
    if (this.imageData.metadata) {
      const metadata = this.imageData.metadata;
      if (metadata.dpiX && metadata.dpiY) {
        // Swap physical dimensions
        const tempPhysical = metadata.physicalWidth;
        this.imageData.metadata.physicalWidth = metadata.physicalHeight;
        this.imageData.metadata.physicalHeight = tempPhysical;
        // Swap DPI
        const tempDpi = metadata.dpiX;
        this.imageData.metadata.dpiX = metadata.dpiY;
        this.imageData.metadata.dpiY = tempDpi;
      }
    }

    return this;
  }

  /**
   * Rotate the image by the specified angle in degrees
   * @param degrees Rotation angle in degrees (positive = clockwise, negative = counter-clockwise)
   * @returns This image instance for chaining
   *
   * @example
   * ```ts
   * image.rotate(90);   // Rotate 90° clockwise
   * image.rotate(-90);  // Rotate 90° counter-clockwise
   * image.rotate(180);  // Rotate 180°
   * image.rotate(45);   // Rotate 45° clockwise (rounded to nearest 90°)
   * ```
   */
  rotate(degrees: number): this {
    // Normalize to 0-360 range
    let normalizedDegrees = degrees % 360;
    if (normalizedDegrees < 0) {
      normalizedDegrees += 360;
    }

    // Round to nearest 90 degrees
    const rounded = Math.round(normalizedDegrees / 90) * 90;

    // Apply rotation based on rounded value
    switch (rounded % 360) {
      case 90:
        return this.rotate90();
      case 180:
        return this.rotate180();
      case 270:
        return this.rotate270();
      default:
        // 0 or 360 degrees - no rotation needed
        return this;
    }
  }

  /**
   * Flip the image horizontally (mirror)
   * @returns This image instance for chaining
   */
  flipHorizontal(): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = flipHorizontal(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
    );

    return this;
  }

  /**
   * Flip the image vertically
   * @returns This image instance for chaining
   */
  flipVertical(): this {
    if (!this.imageData) throw new Error("No image loaded");

    this.imageData.data = flipVertical(
      this.imageData.data,
      this.imageData.width,
      this.imageData.height,
    );

    return this;
  }
}
