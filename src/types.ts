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
  /** Custom metadata fields */
  custom?: Record<string, string | number | boolean>;
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
 * Options for resizing images
 */
export interface ResizeOptions {
  /** Target width in pixels */
  width: number;
  /** Target height in pixels */
  height: number;
  /** Resize method (default: "bilinear") */
  method?: "nearest" | "bilinear";
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
   * @returns Encoded image bytes
   */
  encode(imageData: ImageData): Promise<Uint8Array>;

  /**
   * Check if the given data is in this format
   * @param data Raw data to check
   * @returns true if the data matches this format
   */
  canDecode(data: Uint8Array): boolean;
}
