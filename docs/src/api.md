---
title: API Reference
order: 1
---

# API Reference

Complete API documentation for @cross/image.

## Image Class

The main class for working with images.

### Static Methods

#### `Image.read(data: Uint8Array, format?: string): Promise<Image>`

Read an image from bytes. Automatically detects format if not specified.

**Parameters:**
- `data` - Raw image data as Uint8Array
- `format` - Optional format hint (e.g., "png", "jpeg", "webp")

**Returns:** Promise that resolves to an Image instance

**Example:**
```ts
const data = await Deno.readFile("input.png");
const image = await Image.read(data);
```

#### `Image.readFrames(data: Uint8Array, format?: string): Promise<MultiFrameImageData>`

Read all frames from a multi-frame image (animated GIF or multi-page TIFF).

**Parameters:**
- `data` - Raw image data as Uint8Array
- `format` - Optional format hint (e.g., "gif", "tiff")

**Returns:** Promise that resolves to MultiFrameImageData with all frames

**Example:**
```ts
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.readFrames(gifData);
console.log(`Number of frames: ${multiFrame.frames.length}`);
```

#### `Image.saveFrames(format: string, imageData: MultiFrameImageData, options?: unknown): Promise<Uint8Array>`

Save multi-frame image data to bytes in the specified format.

**Parameters:**
- `format` - Format name (e.g., "gif", "tiff")
- `imageData` - Multi-frame image data to save
- `options` - Optional format-specific encoding options

**Returns:** Promise that resolves to encoded image bytes

**Example:**
```ts
const tiffData = await Image.saveFrames("tiff", multiPageTiff, {
  compression: "lzw",
});
```

#### `Image.fromRGBA(width: number, height: number, data: Uint8Array): Image`

Create an image from raw RGBA data.

**Parameters:**
- `width` - Image width in pixels
- `height` - Image height in pixels
- `data` - Raw RGBA pixel data (width * height * 4 bytes)

**Returns:** New Image instance

**Example:**
```ts
const data = new Uint8Array(100 * 100 * 4); // 100x100 red square
for (let i = 0; i < data.length; i += 4) {
  data[i] = 255; // R
  data[i + 3] = 255; // A
}
const image = Image.fromRGBA(100, 100, data);
```

#### `Image.registerFormat(format: ImageFormat): void`

Register a custom format handler.

**Parameters:**
- `format` - Custom format implementation

**Example:**
```ts
Image.registerFormat(new MyCustomFormat());
```

#### `Image.getFormats(): readonly ImageFormat[]`

Get all registered format handlers.

**Returns:** Read-only array of registered format handlers

### Instance Properties

#### `width: number` (read-only)

Image width in pixels.

#### `height: number` (read-only)

Image height in pixels.

#### `data: Uint8Array` (read-only)

Raw RGBA pixel data (4 bytes per pixel, in row-major order).

#### `metadata: ImageMetadata | undefined` (read-only)

Optional image metadata including DPI, GPS coordinates, title, description, etc.

### Instance Methods

#### `resize(options: ResizeOptions): this`

Resize the image in-place. Returns `this` for method chaining.

**Parameters:**
- `options` - Resize configuration object

**Returns:** `this` for chaining

**Example:**
```ts
image.resize({ width: 800, height: 600 });
// or with nearest neighbor
image.resize({ width: 400, height: 300, method: "nearest" });
```

#### `save(format: string, options?: unknown): Promise<Uint8Array>`

Save image to bytes in the specified format with optional format-specific options.

**Parameters:**
- `format` - Format name (e.g., "png", "jpeg", "webp")
- `options` - Optional format-specific encoding options

**Returns:** Promise that resolves to encoded image bytes

**Example:**
```ts
const png = await image.save("png");
const jpeg = await image.save("jpeg", { quality: 90 });
```

#### `clone(): Image`

Create a deep copy of the image.

**Returns:** New Image instance with copied data

**Example:**
```ts
const copy = image.clone();
```

#### `setMetadata(metadata: ImageMetadata, merge?: boolean): this`

Set or update image metadata. Returns `this` for method chaining.

**Parameters:**
- `metadata` - Metadata to set or merge
- `merge` - If true (default), merges with existing metadata. If false, replaces it.

**Returns:** `this` for chaining

#### `getMetadataField<K>(key: K): ImageMetadata[K] | undefined`

Get a specific metadata field value.

**Parameters:**
- `key` - The metadata field name to retrieve

**Returns:** The metadata value or undefined if not set

#### `getPosition(): { latitude: number; longitude: number } | undefined`

Get GPS position from metadata.

**Returns:** Object with latitude and longitude, or undefined if not available

#### `setPosition(latitude: number, longitude: number): this`

Set GPS position in metadata. Returns `this` for method chaining.

**Parameters:**
- `latitude` - GPS latitude
- `longitude` - GPS longitude

**Returns:** `this` for chaining

#### `getDimensions(): { dpiX?: number; dpiY?: number; physicalWidth?: number; physicalHeight?: number } | undefined`

Get physical dimensions from metadata.

**Returns:** Object with DPI and physical dimensions, or undefined if not available

#### `setDPI(dpiX: number, dpiY?: number): this`

Set DPI and calculate physical dimensions. Returns `this` for method chaining.

**Parameters:**
- `dpiX` - Dots per inch (horizontal)
- `dpiY` - Dots per inch (vertical), defaults to dpiX if not provided

**Returns:** `this` for chaining

## Type Definitions

### `ResizeOptions`

Configuration for image resizing.

```ts
interface ResizeOptions {
  /** Target width in pixels */
  width: number;
  /** Target height in pixels */
  height: number;
  /** Resize algorithm (default: "bilinear") */
  method?: "nearest" | "bilinear";
}
```

**Resize methods:**
- `bilinear` - Smooth interpolation, better quality (default)
- `nearest` - Fast pixel sampling, pixelated result

### `ASCIIOptions`

Configuration for ASCII art encoding.

```ts
interface ASCIIOptions {
  /** Target width in characters (default: 80) */
  width?: number;
  /** Character set to use (default: "simple") */
  charset?: "simple" | "extended" | "blocks" | "detailed";
  /** Aspect ratio correction factor for terminal display (default: 0.5) */
  aspectRatio?: number;
  /** Whether to invert brightness (default: false) */
  invert?: boolean;
}
```

**Character sets:**
- `simple` - 10 characters (`.:-=+*#%@`) - good for basic art
- `extended` - 70 characters - detailed gradients
- `blocks` - 5 block characters (`░▒▓█`) - smooth gradients
- `detailed` - 92 characters - maximum detail

### `WebPEncodeOptions`

Configuration for WebP encoding.

```ts
interface WebPEncodeOptions {
  /** Encoding quality 1-100 (default: 90) */
  quality?: number;
  /** Force lossless encoding even with quality < 100 (default: false) */
  lossless?: boolean;
}
```

**Quality levels:**
- `100` - Lossless encoding (VP8L without quantization)
- `90-99` - Very high quality with minimal quantization
- `70-89` - High quality with light quantization
- `50-69` - Medium quality with noticeable quantization
- `30-49` - Lower quality with heavy quantization
- `1-29` - Low quality with very heavy quantization

**Note:** When OffscreenCanvas is available (Deno, modern browsers, Bun), the runtime's native WebP encoder is used for better compression. In pure-JS mode (Node.js without OffscreenCanvas), VP8L format with quality-based color quantization is used.

### `TIFFEncodeOptions`

Configuration for TIFF encoding.

```ts
interface TIFFEncodeOptions {
  /** Compression method: "none" (default) or "lzw" */
  compression?: "none" | "lzw";
}
```

**Compression methods:**
- `none` - Uncompressed TIFF (larger file size, fastest encoding)
- `lzw` - LZW compression (smaller file size, lossless)

### `ImageData`

Represents decoded image data.

```ts
interface ImageData {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Raw RGBA pixel data (4 bytes per pixel) */
  data: Uint8Array;
  /** Optional metadata */
  metadata?: ImageMetadata;
}
```

### `MultiFrameImageData`

Represents multi-frame image data (animated GIF, multi-page TIFF).

```ts
interface MultiFrameImageData {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Array of frames */
  frames: ImageFrame[];
  /** Optional global metadata */
  metadata?: ImageMetadata;
}
```

### `ImageFrame`

Represents a single frame in a multi-frame image.

```ts
interface ImageFrame {
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Raw RGBA pixel data (4 bytes per pixel) */
  data: Uint8Array;
  /** Optional frame-specific metadata */
  frameMetadata?: FrameMetadata;
}
```

### `FrameMetadata`

Frame-specific metadata for animations.

```ts
interface FrameMetadata {
  /** Frame delay in milliseconds (for animations) */
  delay?: number;
  /** Frame disposal method */
  disposal?: "none" | "background" | "previous";
  /** X offset of frame within canvas */
  left?: number;
  /** Y offset of frame within canvas */
  top?: number;
}
```

**Disposal methods:**
- `none` - Do nothing (leave frame as-is)
- `background` - Clear to background color before next frame
- `previous` - Restore to previous frame state

### `ImageMetadata`

General image metadata.

```ts
interface ImageMetadata {
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
```

### `ImageFormat`

Interface for custom format handlers.

```ts
interface ImageFormat {
  /** Format name (e.g., "png", "jpeg", "webp") */
  readonly name: string;
  /** MIME type (e.g., "image/png") */
  readonly mimeType: string;

  /**
   * Check if the given data is in this format
   * @param data Raw data to check
   * @returns true if the data matches this format
   */
  canDecode(data: Uint8Array): boolean;

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
}
```

## Exported Format Classes

The library exports format classes that can be used for advanced scenarios:

- `PNGFormat` - PNG format handler
- `JPEGFormat` - JPEG format handler
- `WebPFormat` - WebP format handler
- `GIFFormat` - GIF format handler
- `TIFFFormat` - TIFF format handler
- `BMPFormat` - BMP format handler
- `RAWFormat` - RAW format handler
- `ASCIIFormat` - ASCII art format handler

These are primarily for internal use and custom format registration. Most users should use the `Image` class methods instead.
