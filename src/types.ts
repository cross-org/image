/**
 * Image metadata
 */
export interface ImageMetadata {
  /** Physical width in inches (derived from DPI if available) */
  physicalWidth?: number;
  /** Physical height in inches (derived from DPI if available) */
  physicalHeight?: number;
  /** Dots per inch (horizontal) */
  dpiX?: number;
  /** Dots per inch (vertical) */
  dpiY?: number;
  /** GPS latitude */
  latitude?: number;
  /** GPS longitude */
  longitude?: number;
  /** Image title */
  title?: string;
  /** Image description */
  description?: string;
  /** Image author */
  author?: string;
  /** Copyright information */
  copyright?: string;
  /** Creation date */
  creationDate?: Date;

  // Camera settings
  /** Camera make/manufacturer (e.g., "Canon", "Nikon") */
  cameraMake?: string;
  /** Camera model (e.g., "Canon EOS 5D Mark IV") */
  cameraModel?: string;
  /** Lens make/manufacturer */
  lensMake?: string;
  /** Lens model */
  lensModel?: string;
  /** ISO speed rating (e.g., 100, 400, 3200) */
  iso?: number;
  /** Exposure time / Shutter speed in seconds (e.g., 0.0125 = 1/80s) */
  exposureTime?: number;
  /** F-number / Aperture (e.g., 2.8, 5.6, 16) */
  fNumber?: number;
  /** Focal length in millimeters (e.g., 50, 85, 200) */
  focalLength?: number;
  /** Flash mode (0 = no flash, 1 = flash fired) */
  flash?: number;
  /** White balance mode (0 = auto, 1 = manual) */
  whiteBalance?: number;
  /** Orientation (1 = normal, 3 = 180°, 6 = 90° CW, 8 = 90° CCW) */
  orientation?: number;
  /** Software used to create/edit the image */
  software?: string;
  /** User comment / notes */
  userComment?: string;

  /** Custom metadata fields */
  custom?: Record<string, string | number | boolean>;
}

/**
 * Frame-specific metadata for multi-frame images
 */
export interface FrameMetadata {
  /** Frame delay in milliseconds (for animations) */
  delay?: number;
  /** Frame disposal method: how to treat the frame before rendering the next one */
  disposal?: "none" | "background" | "previous";
  /** X offset of frame within the canvas */
  left?: number;
  /** Y offset of frame within the canvas */
  top?: number;
}

/**
 * Image data representation
 */
export interface ImageData {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Raw pixel data as RGBA (4 bytes per pixel) */
  data: Uint8Array;
  /** Optional metadata */
  metadata?: ImageMetadata;
}

/**
 * Single frame in a multi-frame image
 */
export interface ImageFrame {
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Raw pixel data as RGBA (4 bytes per pixel) */
  data: Uint8Array;
  /** Optional frame-specific metadata */
  frameMetadata?: FrameMetadata;
}

/**
 * Multi-frame image data representation
 */
export interface MultiFrameImageData {
  /** Canvas width in pixels (for GIF logical screen) */
  width: number;
  /** Canvas height in pixels (for GIF logical screen) */
  height: number;
  /** Array of frames */
  frames: ImageFrame[];
  /** Optional global metadata */
  metadata?: ImageMetadata;
}

/**
 * Options for resizing images
 */
export interface ResizeOptions {
  /** Target width in pixels */
  width: number;
  /** Target height in pixels */
  height: number;
  /** Resize method (default: "bilinear") */
  method?: "nearest" | "bilinear" | "bicubic";
  /**
   * Fitting mode (default: "stretch")
   * - "stretch": Stretch image to fill dimensions (may distort)
   * - "fit": Fit image within dimensions maintaining aspect ratio (may have letterboxing)
   * - "fill": Fill dimensions maintaining aspect ratio (may crop)
   * - "cover": Alias for "fill"
   * - "contain": Alias for "fit"
   */
  fit?: "stretch" | "fit" | "fill" | "cover" | "contain";
}

/**
 * Options for ASCII art encoding
 */
export interface ASCIIOptions {
  /** Target width in characters (default: 80) */
  width?: number;
  /** Character set to use (default: "simple") */
  charset?: "simple" | "extended" | "blocks" | "detailed";
  /** Aspect ratio correction factor for terminal display (default: 0.5) */
  aspectRatio?: number;
  /** Whether to invert brightness (default: false) */
  invert?: boolean;
}

/**
 * Options for WebP encoding
 */
export interface WebPEncodeOptions {
  /**
   * Encoding quality (1-100, default: 90)
   * - 100 = lossless (VP8L)
   * - 1-99 = lossy (VP8 if OffscreenCanvas available, otherwise quantized VP8L)
   */
  quality?: number;
  /**
   * Force lossless encoding even with quality < 100
   * Uses VP8L format with optional color quantization based on quality
   */
  lossless?: boolean;
}

/**
 * Image format handler interface
 */
export interface ImageFormat {
  /** Format name (e.g., "png", "jpeg", "webp") */
  readonly name: string;
  /** MIME type (e.g., "image/png") */
  readonly mimeType: string;

  /**
   * Decode image data from bytes
   * @param data Raw image data
   * @returns Decoded image data
   */
  decode(data: Uint8Array): Promise<ImageData>;

  /**
   * Encode image data to bytes
   * @param imageData Image data to encode
   * @param options Optional format-specific encoding options
   * @returns Encoded image bytes
   */
  encode(imageData: ImageData, options?: unknown): Promise<Uint8Array>;

  /**
   * Check if the given data is in this format
   * @param data Raw data to check
   * @returns true if the data matches this format
   */
  canDecode(data: Uint8Array): boolean;

  /**
   * Decode all frames from multi-frame image (optional)
   * @param data Raw image data
   * @returns Decoded multi-frame image data
   */
  decodeFrames?(data: Uint8Array): Promise<MultiFrameImageData>;

  /**
   * Encode multi-frame image data to bytes (optional)
   * @param imageData Multi-frame image data to encode
   * @param options Optional format-specific encoding options
   * @returns Encoded image bytes
   */
  encodeFrames?(
    imageData: MultiFrameImageData,
    options?: unknown,
  ): Promise<Uint8Array>;

  /**
   * Check if the format supports multiple frames
   */
  supportsMultipleFrames?(): boolean;

  /**
   * Get the list of metadata fields supported by this format
   * @returns Array of metadata field names that can be persisted
   */
  getSupportedMetadata?(): Array<keyof ImageMetadata>;
}
