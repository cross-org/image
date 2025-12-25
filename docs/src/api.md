---
title: "API Reference"
nav_order: 2
---

# API Reference

Complete API documentation for @cross/image.

## Image Class

The main class for working with images.

### Static Methods

#### `Image.decode(data: Uint8Array, formatOrOptions?: string | ImageDecoderOptions, options?: ImageDecoderOptions): Promise<Image>`

Decode an image from bytes. Automatically detects format if not specified.

Supports these call forms:

- `Image.decode(data)`
- `Image.decode(data, "jpeg")`
- `Image.decode(data, { tolerantDecoding, onWarning, runtimeDecoding })`
- `Image.decode(data, "jpeg", { ...options })`

**Parameters:**

- `data` - Raw image data as Uint8Array
- `formatOrOptions` - Optional format hint (e.g., "png", "jpeg", "webp") or an
  `ImageDecoderOptions` object
- `options` - Optional `ImageDecoderOptions` (when passing an explicit format
  string)

**Returns:** Promise that resolves to an Image instance

**Example:**

```ts
// Deno
const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Strict decoding (fail fast)
const strict = await Image.decode(data, { tolerantDecoding: false });

// Node.js
// import { readFile } from "node:fs/promises";
// const data = await readFile("input.png");
// const image = await Image.decode(data);
```

#### `Image.read(data: Uint8Array, format?: string): Promise<Image>` ⚠️ Deprecated

**Deprecated:** Use `decode()` instead. This method will be removed in a future
version.

Read an image from bytes. Automatically detects format if not specified.

#### `Image.decodeFrames(data: Uint8Array, formatOrOptions?: string | ImageDecoderOptions, options?: ImageDecoderOptions): Promise<MultiFrameImageData>`

Decode all frames from a multi-frame image (animated GIF or multi-page TIFF).

Supports these call forms:

- `Image.decodeFrames(data)`
- `Image.decodeFrames(data, "gif")`
- `Image.decodeFrames(data, { tolerantDecoding, onWarning, runtimeDecoding })`
- `Image.decodeFrames(data, "gif", { ...options })`

**Parameters:**

- `data` - Raw image data as Uint8Array
- `formatOrOptions` - Optional format hint (e.g., "gif", "tiff") or an
  `ImageDecoderOptions` object
- `options` - Optional `ImageDecoderOptions` (when passing an explicit format
  string)

**Returns:** Promise that resolves to MultiFrameImageData with all frames

**Example:**

```ts
// Deno
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Strict decoding (fail fast)
const strictFrames = await Image.decodeFrames(gifData, {
  tolerantDecoding: false,
});

// Node.js
// import { readFile } from "node:fs/promises";
// const gifData = await readFile("animated.gif");
// const multiFrame = await Image.decodeFrames(gifData);

console.log(`Number of frames: ${multiFrame.frames.length}`);
```

#### `Image.readFrames(data: Uint8Array, format?: string): Promise<MultiFrameImageData>` ⚠️ Deprecated

**Deprecated:** Use `decodeFrames()` instead. This method will be removed in a
future version.

Read all frames from a multi-frame image (animated GIF or multi-page TIFF).

#### `Image.encodeFrames(format: string, imageData: MultiFrameImageData, options?: unknown): Promise<Uint8Array>`

Encode multi-frame image data to bytes in the specified format.

**Parameters:**

- `format` - Format name (e.g., "gif", "tiff")
- `imageData` - Multi-frame image data to encode
- `options` - Optional format-specific encoding options

**Returns:** Promise that resolves to encoded image bytes

**Example:**

```ts
const tiffData = await Image.encodeFrames("tiff", multiPageTiff, {
  compression: "lzw",
});
```

#### `Image.saveFrames(format: string, imageData: MultiFrameImageData, options?: unknown): Promise<Uint8Array>` ⚠️ Deprecated

**Deprecated:** Use `encodeFrames()` instead. This method will be removed in a
future version.

Save multi-frame image data to bytes in the specified format.

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

#### `Image.create(width: number, height: number, r?: number, g?: number, b?: number, a?: number): Image`

Create a blank image with the specified dimensions and color.

**Parameters:**

- `width` - Image width in pixels
- `height` - Image height in pixels
- `r` - Red component (0-255, default: 0)
- `g` - Green component (0-255, default: 0)
- `b` - Blue component (0-255, default: 0)
- `a` - Alpha component (0-255, default: 255)

**Returns:** New Image instance

**Example:**

```ts
// Create a 400x300 white canvas
const canvas = Image.create(400, 300, 255, 255, 255);

// Create a 200x200 transparent canvas
const transparent = Image.create(200, 200, 0, 0, 0, 0);
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

#### `Image.getSupportedMetadata(format: string): Array<keyof ImageMetadata> | undefined`

Get supported metadata fields for a specific format.

**Parameters:**

- `format` - Format name (e.g., "jpeg", "png", "webp")

**Returns:** Array of supported metadata field names, or undefined if format
doesn't support metadata

**Example:**

```ts
const jpegFields = Image.getSupportedMetadata("jpeg");
console.log(jpegFields);
// Includes: cameraMake, cameraModel, iso, exposureTime, fNumber, etc.

const pngFields = Image.getSupportedMetadata("png");
console.log(pngFields);
// Includes: title, description, author, dpiX, dpiY, latitude, longitude, etc.
```

#### `Image.extractMetadata(data: Uint8Array, format?: string): Promise<ImageMetadata | undefined>`

Extract metadata from image data without fully decoding the pixel data. This is
useful for quickly reading EXIF, XMP, or other metadata from images that may
have unsupported features or compression methods.

**Parameters:**

- `data` - Raw image data
- `format` - Optional format hint (e.g., "jpeg", "png", "webp")

**Returns:** Promise that resolves to metadata extracted from the image, or
undefined if extraction fails or format is unsupported

**Example:**

```ts
// Extract metadata without decoding pixels (faster)
const data = await Deno.readFile("large-photo.jpg");
const metadata = await Image.extractMetadata(data);

console.log(metadata?.cameraMake); // "Canon"
console.log(metadata?.iso); // 800
console.log(metadata?.exposureTime); // 0.004

// Works with auto-detection or explicit format
const metadata2 = await Image.extractMetadata(data, "jpeg");
```

#### `Image.extractCoefficients(data: Uint8Array, format?: string, options?: ImageDecoderOptions): Promise<CoefficientData | undefined>`

Extract quantized DCT coefficients from encoded image data. Currently supports
JPEG format. This is useful for frequency-domain processing and steganography
applications.

**Parameters:**

- `data` - Raw image data
- `format` - Optional format hint (e.g., "jpeg")
- `options` - Optional decoder options

**Returns:** Promise that resolves to coefficient data, or undefined if
extraction fails or format is unsupported

**Example:**

```ts
const data = await Deno.readFile("photo.jpg");
const coefficients = await Image.extractCoefficients(data, "jpeg");

if (coefficients) {
  console.log(`Image: ${coefficients.width}x${coefficients.height}`);
  console.log(`Components: ${coefficients.components.length}`);

  // Access DCT coefficient blocks
  for (const comp of coefficients.components) {
    for (const row of comp.blocks) {
      for (const block of row) {
        // block is Int32Array[64] in zigzag order
        const dcCoeff = block[0]; // DC coefficient
        // block[1..63] are AC coefficients
      }
    }
  }
}
```

#### `Image.encodeFromCoefficients(coefficients: CoefficientData, format?: string, options?: unknown): Promise<Uint8Array>`

Encode an image from coefficient data. Currently supports JPEG format. This
allows re-encoding modified coefficients back to a valid image file.

**Parameters:**

- `coefficients` - Coefficient data (e.g., from `extractCoefficients`)
- `format` - Optional format hint (auto-detected from coefficient data if not
  provided)
- `options` - Optional format-specific encoding options

**Returns:** Promise that resolves to encoded image bytes

**Example:**

```ts
const data = await Deno.readFile("input.jpg");
const coefficients = await Image.extractCoefficients(data, "jpeg");

if (coefficients) {
  // Modify coefficients (e.g., for steganography)
  for (const comp of coefficients.components) {
    for (const row of comp.blocks) {
      for (const block of row) {
        // Modify AC coefficient LSBs
        if (block[1] !== 0 && Math.abs(block[1]) > 1) {
          block[1] = block[1] & ~1; // Clear LSB
        }
      }
    }
  }

  // Re-encode to JPEG
  const encoded = await Image.encodeFromCoefficients(coefficients, "jpeg");
  await Deno.writeFile("output.jpg", encoded);
}
```

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

#### `encode(format: string, options?: unknown): Promise<Uint8Array>`

Encode image to bytes in the specified format with optional format-specific
options.

**Parameters:**

- `format` - Format name (e.g., "png", "jpeg", "webp")
- `options` - Optional format-specific encoding options

**Returns:** Promise that resolves to encoded image bytes

**Example:**

```ts
const png = await image.encode("png");
const jpeg = await image.encode("jpeg", { quality: 90 });
const progressiveJpeg = await image.encode("jpeg", {
  quality: 90,
  progressive: true,
});
```

#### `save(format: string, options?: unknown): Promise<Uint8Array>` ⚠️ Deprecated

**Deprecated:** Use `encode()` instead. This method will be removed in a future
version.

Save image to bytes in the specified format with optional format-specific
options.

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
- `merge` - If true (default), merges with existing metadata. If false, replaces
  it.

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

**Returns:** Object with DPI and physical dimensions, or undefined if not
available

#### `setDPI(dpiX: number, dpiY?: number): this`

Set DPI and calculate physical dimensions. Returns `this` for method chaining.

**Parameters:**

- `dpiX` - Dots per inch (horizontal)
- `dpiY` - Dots per inch (vertical), defaults to dpiX if not provided

**Returns:** `this` for chaining

#### `composite(overlay: Image, x: number, y: number, opacity?: number): this`

Composite another image on top of this image at the specified position.

**Parameters:**

- `overlay` - Image to place on top
- `x` - X position (can be negative)
- `y` - Y position (can be negative)
- `opacity` - Opacity of overlay (0-1, default: 1)

**Returns:** `this` for chaining

**Example:**

```ts
const background = Image.create(800, 600, 255, 255, 255);
const logo = await Image.decode(await Deno.readFile("logo.png"));
background.composite(logo, 10, 10, 0.8);
```

#### `brightness(amount: number): this`

Adjust the brightness of the image.

**Parameters:**

- `amount` - Brightness adjustment (-1 to 1, where 0 is no change)

**Returns:** `this` for chaining

**Example:**

```ts
image.brightness(0.2); // Increase brightness by 20%
image.brightness(-0.1); // Decrease brightness by 10%
```

#### `contrast(amount: number): this`

Adjust the contrast of the image.

**Parameters:**

- `amount` - Contrast adjustment (-1 to 1, where 0 is no change)

**Returns:** `this` for chaining

**Example:**

```ts
image.contrast(0.3); // Increase contrast
image.contrast(-0.2); // Decrease contrast
```

#### `exposure(amount: number): this`

Adjust the exposure of the image in photographic stops.

**Parameters:**

- `amount` - Exposure adjustment in stops (-3 to 3, where 0 is no change)

**Returns:** `this` for chaining

**Example:**

```ts
image.exposure(1); // Increase exposure by 1 stop (2x brighter)
image.exposure(-1); // Decrease exposure by 1 stop (0.5x darker)
```

#### `saturation(amount: number): this`

Adjust the color saturation of the image.

**Parameters:**

- `amount` - Saturation adjustment (-1 to 1, where 0 is no change, -1 is
  grayscale)

**Returns:** `this` for chaining

**Example:**

```ts
image.saturation(0.5); // Increase saturation
image.saturation(-0.3); // Desaturate
image.saturation(-1); // Full grayscale (same as image.grayscale())
```

#### `hue(degrees: number): this`

Adjust the hue of the image by rotating the color wheel.

**Parameters:**

- `degrees` - Hue rotation in degrees. Any value is accepted and wraps at 360
  degrees. Positive values rotate clockwise, negative values rotate
  counter-clockwise. 0 means no change.

**Returns:** `this` for chaining

**Example:**

```ts
image.hue(30); // Shift colors towards yellow/orange
image.hue(120); // Shift reds to greens, greens to blues, blues to reds
image.hue(-60); // Shift colors towards blue/purple
```

**Use Cases:**

- Color correction (e.g., adjusting skin tones, sky colors)
- Creative color grading effects
- Fixing white balance issues
- Seasonal color shifts (autumn/spring effects)

#### `invert(): this`

Invert all colors in the image (negative effect).

**Returns:** `this` for chaining

**Example:**

```ts
image.invert(); // Create a color negative
```

#### `grayscale(): this`

Convert the image to grayscale.

**Returns:** `this` for chaining

**Example:**

```ts
image.grayscale(); // Convert to black and white
```

#### `sepia(): this`

Apply a sepia tone effect to the image, giving it a warm, brownish, vintage
appearance.

**Returns:** `this` for chaining

**Example:**

```ts
image.sepia(); // Apply vintage sepia tone effect
```

#### `blur(radius?: number): this`

Apply a box blur filter to the image.

**Parameters:**

- `radius` - Blur radius (default: 1). Higher values create stronger blur.

**Returns:** `this` for chaining

**Example:**

```ts
image.blur(); // Light blur with default radius
image.blur(3); // Stronger blur effect
```

#### `gaussianBlur(radius?: number, sigma?: number): this`

Apply a Gaussian blur filter to the image. Gaussian blur provides more natural,
edge-preserving results compared to box blur.

**Parameters:**

- `radius` - Blur radius (default: 1)
- `sigma` - Optional standard deviation for the Gaussian kernel. If not
  provided, calculated from radius (radius / 3)

**Returns:** `this` for chaining

**Example:**

```ts
image.gaussianBlur(); // Natural blur with default parameters
image.gaussianBlur(2); // Medium blur
image.gaussianBlur(3, 1.5); // Custom blur with specific sigma
```

#### `sharpen(amount?: number): this`

Apply a sharpening filter to enhance edges and details in the image.

**Parameters:**

- `amount` - Sharpening amount (0 to 1, default: 0.5). Higher values create
  stronger sharpening.

**Returns:** `this` for chaining

**Example:**

```ts
image.sharpen(); // Moderate sharpening
image.sharpen(0.3); // Light sharpening
image.sharpen(0.8); // Strong sharpening
```

#### `medianFilter(radius?: number): this`

Apply a median filter to reduce noise, especially effective for salt-and-pepper
noise while preserving edges.

**Parameters:**

- `radius` - Filter radius (default: 1). Higher values provide stronger noise
  reduction but slower processing.

**Returns:** `this` for chaining

**Example:**

```ts
image.medianFilter(); // Light noise reduction
image.medianFilter(2); // Stronger noise reduction
```

#### `fillRect(x: number, y: number, width: number, height: number, r: number, g: number, b: number, a?: number): this`

Fill a rectangular region with a solid color.

**Parameters:**

- `x` - Starting X position
- `y` - Starting Y position
- `width` - Width of the fill region
- `height` - Height of the fill region
- `r` - Red component (0-255)
- `g` - Green component (0-255)
- `b` - Blue component (0-255)
- `a` - Alpha component (0-255, default: 255)

**Returns:** `this` for chaining

**Example:**

```ts
const canvas = Image.create(400, 300, 255, 255, 255);
canvas.fillRect(50, 50, 100, 100, 255, 0, 0); // Red rectangle
canvas.fillRect(200, 100, 150, 80, 0, 0, 255, 128); // Semi-transparent blue
```

#### `crop(x: number, y: number, width: number, height: number): this`

Crop the image to a rectangular region.

**Parameters:**

- `x` - Starting X position
- `y` - Starting Y position
- `width` - Width of the crop region
- `height` - Height of the crop region

**Returns:** `this` for chaining

**Example:**

```ts
image.crop(100, 100, 200, 150); // Crop to 200x150 region starting at (100, 100)
```

#### `getPixel(x: number, y: number): { r: number; g: number; b: number; a: number } | undefined`

Get the color of a pixel at the specified position.

**Parameters:**

- `x` - X position
- `y` - Y position

**Returns:** Object with r, g, b, a components (0-255) or undefined if out of
bounds

**Example:**

```ts
const color = image.getPixel(50, 100);
if (color) {
  console.log(
    `Pixel color: rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
  );
}
```

#### `setPixel(x: number, y: number, r: number, g: number, b: number, a?: number): this`

Set the color of a pixel at the specified position.

**Parameters:**

- `x` - X position
- `y` - Y position
- `r` - Red component (0-255)
- `g` - Green component (0-255)
- `b` - Blue component (0-255)
- `a` - Alpha component (0-255, default: 255)

**Returns:** `this` for chaining

**Example:**

```ts
image.setPixel(50, 100, 255, 0, 0); // Set pixel to red
image.setPixel(51, 100, 0, 255, 0, 128); // Set pixel to semi-transparent green
```

#### `rotate(degrees: number): this`

Rotate the image by the specified angle in degrees. Rotations are rounded to the
nearest 90-degree increment.

**Parameters:**

- `degrees` - Rotation angle in degrees (positive = clockwise, negative =
  counter-clockwise)

**Returns:** `this` for chaining

**Example:**

```ts
image.rotate(90); // Rotate 90° clockwise
image.rotate(-90); // Rotate 90° counter-clockwise
image.rotate(180); // Rotate 180°
image.rotate(45); // Rotate 45° clockwise (rounded to nearest 90°)
```

#### `rotate90(): this`

Rotate the image 90 degrees clockwise.

**Returns:** `this` for chaining

**Example:**

```ts
image.rotate90(); // Rotate 90° clockwise
```

#### `rotate180(): this`

Rotate the image 180 degrees.

**Returns:** `this` for chaining

**Example:**

```ts
image.rotate180(); // Flip upside down
```

#### `rotate270(): this`

Rotate the image 270 degrees clockwise (or 90 degrees counter-clockwise).

**Returns:** `this` for chaining

**Example:**

```ts
image.rotate270(); // Rotate 90° counter-clockwise
```

#### `flipHorizontal(): this`

Flip the image horizontally (mirror effect).

**Returns:** `this` for chaining

**Example:**

```ts
image.flipHorizontal(); // Create horizontal mirror
```

#### `flipVertical(): this`

Flip the image vertically.

**Returns:** `this` for chaining

**Example:**

```ts
image.flipVertical(); // Flip upside down
```

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
  method?: "nearest" | "bilinear" | "bicubic";
  /** Fitting mode (default: "stretch") */
  fit?: "stretch" | "fit" | "fill" | "cover" | "contain";
}
```

**Resize methods:**

- `bilinear` - Smooth interpolation, better quality (default)
- `nearest` - Fast pixel sampling, pixelated result
- `bicubic` - High-quality cubic interpolation, best quality (slowest)

**Fitting modes:**

- `stretch` - Stretch image to fill dimensions (may distort) (default)
- `fit` / `contain` - Fit image within dimensions maintaining aspect ratio (may
  have letterboxing)
- `fill` / `cover` - Fill dimensions maintaining aspect ratio (may crop)

### `ASCIIEncoderOptions`

Configuration for ASCII art encoding.

```ts
interface ASCIIEncoderOptions {
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

### `WebPEncoderOptions`

Configuration for WebP encoding.

```ts
interface WebPEncoderOptions {
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

**Note:** When OffscreenCanvas is available (Deno, modern browsers, Bun), the
runtime's native WebP encoder is used for better compression. In pure-JS mode
(Node.js without OffscreenCanvas), VP8L format with quality-based color
quantization is used.

### `TIFFEncoderOptions`

Configuration for TIFF encoding.

```ts
interface TIFFEncoderOptions {
  /** Compression method: "none" (default), "lzw", "packbits", or "deflate" */
  compression?: "none" | "lzw" | "packbits" | "deflate";
  /** Encode as grayscale instead of RGB/RGBA (default: false) */
  grayscale?: boolean;
  /** Encode as RGB without alpha channel (default: false, ignored if grayscale is true) */
  rgb?: boolean;
}
```

**Compression methods:**

- `none` - Uncompressed TIFF (larger file size, fastest encoding)
- `lzw` - LZW compression (smaller file size, lossless)
- `packbits` - PackBits RLE compression (lossless)
- `deflate` - Deflate compression (lossless)

**Color modes:**

- Default: RGBA with alpha channel
- `grayscale: true` - Convert to grayscale
- `rgb: true` - RGB without alpha channel (smaller file size if transparency not
  needed)

### `JPEGEncoderOptions`

Configuration for JPEG encoding.

```ts
interface JPEGEncoderOptions {
  /** Encoding quality (1-100) */
  quality?: number;
  /** Progressive JPEG output (pure-JS encoder only) */
  progressive?: boolean;
}
```

### `PNGEncoderOptions`

Configuration for PNG encoding.

```ts
interface PNGEncoderOptions {
  /** Compression level (0-9, default: 6) */
  compressionLevel?: number;
}
```

**Compression levels:**

- `0` - No filtering, fastest encoding
- `1-2` - Fast (no filtering)
- `3-6` - Balanced (Sub filter)
- `7-9` - Best compression (adaptive filtering per scanline)

The compression level controls PNG filter selection, which significantly affects
compression efficiency. Higher levels produce smaller files but take longer to
encode.

**Example:**

```ts
// Fast encoding
const pngFast = await image.encode("png", { compressionLevel: 0 });

// Balanced (default)
const pngBalanced = await image.encode("png", { compressionLevel: 6 });

// Best compression
const pngBest = await image.encode("png", { compressionLevel: 9 });
```

### `APNGEncoderOptions`

Configuration for APNG (Animated PNG) encoding.

```ts
interface APNGEncoderOptions extends PNGEncoderOptions {
  /** Compression level (0-9, default: 6) - inherited from PNGEncoderOptions */
  compressionLevel?: number;
}
```

**Note:** APNG uses PNG encoding for each frame and supports the same
compression levels.

### `GIFEncoderOptions`

Configuration for GIF encoding.

```ts
interface GIFEncoderOptions {
  /** Loop count for animated GIFs (0 = infinite, 1+ = specific count) */
  loop?: number;
}
```

**Loop count:**

- `0` (default) - Loop infinitely
- `1+` - Loop a specific number of times
- `undefined` - Same as 0 (infinite loop)

**Example:**

```ts
// Infinite loop (default)
const gif = await Image.encodeFrames("gif", multiFrame);

// Loop 3 times then stop
const gifLoopThree = await Image.encodeFrames("gif", multiFrame, { loop: 3 });

// Single play (no loop)
const gifOnce = await Image.encodeFrames("gif", multiFrame, { loop: 1 });
```

### `AVIFEncoderOptions`

Configuration for AVIF encoding.

```ts
interface AVIFEncoderOptions {
  /** Best-effort encoding quality (0-1 or 1-100) */
  quality?: number;
}
```

**Note:** AVIF encoding is delegated to runtime APIs (OffscreenCanvas). Many
runtimes ignore quality or may not support AVIF encoding at all.

### `HEICEncoderOptions`

Configuration for HEIC encoding.

```ts
interface HEICEncoderOptions {
  /** Best-effort encoding quality (0-1 or 1-100) */
  quality?: number;
}
```

**Note:** HEIC encoding is delegated to runtime APIs (OffscreenCanvas). Many
runtimes do not support HEIC encoding.

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

### `ImageDecoderOptions`

Common options for the decode APIs.

```ts
interface ImageDecoderOptions {
  /**
   * Controls tolerant decoding in the pure-JS decoders.
   *
   * - true (default): try to recover from corruption and continue
   * - false: strict mode (fail fast)
   */
  tolerantDecoding?: boolean;

  /**
   * Optional warning callback used by pure-JS decoders when non-fatal issues
   * are encountered.
   */
  onWarning?: (message: string, details?: unknown) => void;

  /**
   * Runtime decoder strategy.
   *
   * - "prefer" (default): try runtime decoders first (ImageDecoder/Canvas), then fall back to pure JS
   * - "never": skip runtime decoders and use pure JS when available
   */
  runtimeDecoding?: "prefer" | "never";
}
```

### `JPEGQuantizedCoefficients`

JPEG quantized DCT coefficients for frequency-domain processing and
steganography.

```ts
interface JPEGQuantizedCoefficients {
  /** Format identifier */
  format: "jpeg";
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Whether the JPEG is progressive */
  isProgressive: boolean;
  /** Component data (Y, Cb, Cr for color images) */
  components: JPEGComponentCoefficients[];
  /** Quantization tables used (indexed by table ID) */
  quantizationTables: (Uint8Array | number[])[];
  /** MCU width (number of 8x8 blocks horizontally) */
  mcuWidth: number;
  /** MCU height (number of 8x8 blocks vertically) */
  mcuHeight: number;
}
```

### `JPEGComponentCoefficients`

Coefficients for a single JPEG component (Y, Cb, or Cr).

```ts
interface JPEGComponentCoefficients {
  /** Component ID (1=Y, 2=Cb, 3=Cr typically) */
  id: number;
  /** Horizontal sampling factor */
  h: number;
  /** Vertical sampling factor */
  v: number;
  /** Quantization table index */
  qTable: number;
  /**
   * Quantized DCT coefficient blocks
   * blocks[blockRow][blockCol] contains a 64-element Int32Array in zigzag order
   * Coefficients are quantized (divided by quantization table values)
   */
  blocks: Int32Array[][];
}
```

### `CoefficientData`

Union type for coefficient data from different formats. Currently only JPEG is
supported.

```ts
type CoefficientData = JPEGQuantizedCoefficients;
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
   * Decode image data from bytes
   * @param data Raw image data
   * @param options Optional `ImageDecoderOptions`
   * @returns Decoded image data
   */
  decode(data: Uint8Array, options?: ImageDecoderOptions): Promise<ImageData>;

  /**
   * Encode image data to bytes
   * @param imageData Image data to encode
   * @param options Optional format-specific encoding options
   * @returns Encoded image bytes
   */
  encode(
    imageData: ImageData,
    options?: unknown,
  ): Promise<Uint8Array>;

  /**
   * Check if the given data is in this format
   * @param data Raw data to check
   * @returns true if the data matches this format
   */
  canDecode(data: Uint8Array): boolean;

  /**
   * Decode all frames from multi-frame image (optional)
   * @param data Raw image data
   * @param options Optional `ImageDecoderOptions`
   * @returns Decoded multi-frame image data
   */
  decodeFrames?(
    data: Uint8Array,
    options?: ImageDecoderOptions,
  ): Promise<MultiFrameImageData>;

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
   */
  getSupportedMetadata?(): Array<keyof ImageMetadata>;

  /**
   * Extract metadata from image data without fully decoding the pixel data
   */
  extractMetadata?(data: Uint8Array): Promise<ImageMetadata | undefined>;
}
```

## Exported Format Classes

The library exports format classes that can be used for advanced scenarios:

- `PNGFormat` - PNG format handler
- `APNGFormat` - Animated PNG format handler
- `JPEGFormat` - JPEG format handler
- `WebPFormat` - WebP format handler
- `GIFFormat` - GIF format handler
- `TIFFFormat` - TIFF format handler
- `BMPFormat` - BMP format handler
- `ICOFormat` - ICO/CUR format handler
- `DNGFormat` - DNG format handler
- `PAMFormat` - PAM format handler
- `PCXFormat` - PCX format handler
- `PPMFormat` - PPM format handler
- `ASCIIFormat` - ASCII art format handler
- `HEICFormat` - HEIC/HEIF format handler
- `AVIFFormat` - AVIF format handler

Most users should use the `Image` class methods instead. The format classes are
useful when you want to:

- Use a handler directly (`format.decode(...)`, `format.encode(...)`) without
  the higher-level `Image` convenience APIs.
- Register a custom format implementation via `Image.registerFormat(...)`.

### Example: Use a format handler directly

```ts
import { PNGFormat } from "jsr:@cross/image";

const png = new PNGFormat();

const data = await Deno.readFile("input.png");
const decoded = await png.decode(data, { tolerantDecoding: false });

// `decoded` is an ImageData structure; you can re-encode it directly.
const out = await png.encode(decoded);
await Deno.writeFile("roundtrip.png", out);
```

### Example: Register a custom format

```ts
import type { ImageData, ImageFormat } from "jsr:@cross/image";
import { Image } from "jsr:@cross/image";

class MyFormat implements ImageFormat {
  readonly name = "myfmt";
  readonly mimeType = "application/x-myfmt";

  canDecode(data: Uint8Array): boolean {
    return data.length >= 4 && data[0] === 0x4d && data[1] === 0x59;
  }

  async decode(_data: Uint8Array): Promise<ImageData> {
    throw new Error("Not implemented");
  }

  async encode(_imageData: ImageData): Promise<Uint8Array> {
    throw new Error("Not implemented");
  }
}

Image.registerFormat(new MyFormat());
```
