# @cross/image

A pure JavaScript, dependency-free, cross-runtime image processing library for
Deno, Node.js, and Bun.

## Features

- 🚀 **Pure JavaScript** - No native dependencies
- 🔌 **Pluggable formats** - Easy to extend with custom formats
- 📦 **Cross-runtime** - Works on Deno, Node.js (18+), and Bun
- 🎨 **Multiple formats** - PNG, JPEG, WebP, GIF, TIFF, BMP, and RAW support
- ✂️ **Image manipulation** - Resize with multiple algorithms
- 🔧 **Simple API** - Easy to use, intuitive interface

## Installation

### Deno

```ts
import { Image } from "jsr:@cross/image";
```

### Node.js

```bash
npx jsr add @cross/image
```

```ts
import { Image } from "@cross/image";
```

### Bun

```bash
bunx jsr add @cross/image
```

```ts
import { Image } from "@cross/image";
```

## Quick Start

### Reading and Saving Images

```ts
import { Image } from "@cross/image";

// Read an image (auto-detects format)
const data = await Deno.readFile("input.png");
const image = await Image.read(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Save as different format
const jpeg = await image.save("jpeg");
await Deno.writeFile("output.jpg", jpeg);
```

### Resizing Images

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.read(data);

// Resize with bilinear interpolation (default)
image.resize({ width: 800, height: 600 });

// Or use nearest neighbor for faster, pixelated results
image.resize({ width: 400, height: 300, method: "nearest" });

// Save the result
const output = await image.save("png");
await Deno.writeFile("resized.png", output);
```

### Creating Images from Scratch

```ts
import { Image } from "@cross/image";

// Create a 100x100 red square
const width = 100;
const height = 100;
const data = new Uint8Array(width * height * 4);

for (let i = 0; i < data.length; i += 4) {
  data[i] = 255; // R
  data[i + 1] = 0; // G
  data[i + 2] = 0; // B
  data[i + 3] = 255; // A
}

const image = Image.fromRGBA(width, height, data);
const png = await image.save("png");
await Deno.writeFile("red-square.png", png);
```

### Using TIFF with LZW Compression

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.read(data);

// Save as uncompressed TIFF
const uncompressed = await image.save("tiff");
await Deno.writeFile("output.tiff", uncompressed);

// Save with LZW compression (smaller file size)
const compressed = await image.save("tiff", { compression: "lzw" });
await Deno.writeFile("output-compressed.tiff", compressed);
```

### Using WebP with Quality Settings

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.read(data);

// Save as lossless WebP (quality = 100)
const lossless = await image.save("webp", { quality: 100 });
await Deno.writeFile("output-lossless.webp", lossless);

// Save as lossy WebP with high quality (smaller file size)
const highQuality = await image.save("webp", { quality: 90 });
await Deno.writeFile("output-hq.webp", highQuality);

// Save as lossy WebP with medium quality (much smaller)
const mediumQuality = await image.save("webp", { quality: 75 });
await Deno.writeFile("output-med.webp", mediumQuality);

// Force lossless even with quality < 100 (pure-JS VP8L)
const forcedLossless = await image.save("webp", {
  quality: 80,
  lossless: true,
});
await Deno.writeFile("output-forced.webp", forcedLossless);
```

### Converting to ASCII Art

```ts
import { type ASCIIOptions, Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.read(data);

// Convert to ASCII art with simple characters
const ascii = await image.save("ascii", { width: 80, charset: "simple" });
console.log(new TextDecoder().decode(ascii));

// Or use block characters for better gradients
const blocks = await image.save("ascii", {
  width: 60,
  charset: "blocks",
  aspectRatio: 0.5,
});
console.log(new TextDecoder().decode(blocks));

// Save ASCII art to file
await Deno.writeFile("output.txt", ascii);
```

### Working with Multi-Frame Images

Read and manipulate animated GIFs and multi-page TIFFs:

```ts
import { Image } from "@cross/image";

// Read all frames from an animated GIF
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.readFrames(gifData);

console.log(`Canvas: ${multiFrame.width}x${multiFrame.height}`);
console.log(`Number of frames: ${multiFrame.frames.length}`);

// Access individual frames
for (let i = 0; i < multiFrame.frames.length; i++) {
  const frame = multiFrame.frames[i];
  console.log(`Frame ${i}: ${frame.width}x${frame.height}`);
  console.log(`  Delay: ${frame.frameMetadata?.delay}ms`);
  console.log(`  Disposal: ${frame.frameMetadata?.disposal}`);
}

// Create a multi-page TIFF from multiple images
const page1 = Image.fromRGBA(100, 100, new Uint8Array(100 * 100 * 4));
const page2 = Image.fromRGBA(100, 100, new Uint8Array(100 * 100 * 4));

const multiPageTiff = {
  width: 100,
  height: 100,
  frames: [
    { width: 100, height: 100, data: page1.data },
    { width: 100, height: 100, data: page2.data },
  ],
};

// Save as multi-page TIFF with LZW compression
const tiffData = await Image.saveFrames("tiff", multiPageTiff, {
  compression: "lzw",
});
await Deno.writeFile("multipage.tiff", tiffData);

// Read all pages from a multi-page TIFF
const pages = await Image.readFrames(tiffData);
console.log(`Read ${pages.frames.length} pages from TIFF`);
```

### Chaining Operations

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.read(data);

// Chain multiple operations
image
  .resize({ width: 1920, height: 1080 })
  .resize({ width: 800, height: 600 });

const output = await image.save("webp");
await Deno.writeFile("output.webp", output);
```

## Supported Formats

### Format Support Matrix

This table shows which image formats are supported and their implementation
status:

| Format | Read | Write | Pure-JS Decode | Pure-JS Encode | Native API Decode | Native API Encode  | Notes                                        |
| ------ | ---- | ----- | -------------- | -------------- | ----------------- | ------------------ | -------------------------------------------- |
| PNG    | ✅   | ✅    | ✅ Full        | ✅ Full        | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation              |
| BMP    | ✅   | ✅    | ✅ Full        | ✅ Full        | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation              |
| RAW    | ✅   | ✅    | ✅ Full        | ✅ Full        | N/A               | N/A                | Uncompressed RGBA (no metadata)              |
| ASCII  | ✅   | ✅    | ✅ Full        | ✅ Full        | N/A               | N/A                | Text-based ASCII art representation          |
| JPEG   | ✅   | ✅    | ⚠️ Baseline    | ⚠️ Baseline    | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS for baseline DCT only                |
| GIF    | ✅   | ✅    | ✅ Full        | ✅ Full        | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation              |
| WebP   | ✅   | ✅    | ⚠️ Lossless    | ⚠️ Quantized   | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS VP8L with quality-based quantization |
| TIFF   | ✅   | ✅    | ⚠️ Basic       | ⚠️ Basic       | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS for uncompressed & LZW RGB/RGBA      |

**Legend:**

- ✅ **Full support** - Complete implementation with all common features
- ⚠️ **Limited support** - Partial implementation with restrictions
- ❌ **Not supported** - Feature not available in pure-JS, requires native APIs
- **Pure-JS** - Works in all JavaScript runtimes without native dependencies
- **Native API** - Uses runtime APIs like ImageDecoder (decode) or
  OffscreenCanvas (encode)

### Format Specifications Supported

This table shows which format standards and variants are supported:

| Format | Specification/Variant               | Support Level     | Implementation |
| ------ | ----------------------------------- | ----------------- | -------------- |
| PNG    | PNG 1.2 (ISO/IEC 15948)             | ✅ Full           | Pure-JS        |
|        | - Interlaced (Adam7)                | ❌ Not Yet        | -              |
|        | - Color types: Grayscale, RGB, RGBA | ✅ Full           | Pure-JS        |
|        | - Metadata: pHYs, tEXt, iTXt, eXIf  | ✅ Full           | Pure-JS        |
| BMP    | Windows BMP (BITMAPINFOHEADER)      | ✅ Full           | Pure-JS        |
|        | - 24-bit RGB                        | ✅ Full           | Pure-JS        |
|        | - 32-bit RGBA                       | ✅ Full           | Pure-JS        |
|        | - Compressed variants (RLE)         | ❌ Not Yet        | -              |
| JPEG   | JPEG/JFIF Baseline DCT              | ✅ Full           | Pure-JS        |
|        | Progressive DCT                     | ⚠️ Native only    | ImageDecoder   |
|        | - EXIF metadata                     | ✅ Full           | Pure-JS        |
|        | - JFIF (APP0) with DPI              | ✅ Full           | Pure-JS        |
| WebP   | WebP Lossless (VP8L)                | ⚠️ Basic          | Pure-JS        |
|        | - Simple Huffman coding             | ✅ Full           | Pure-JS        |
|        | - LZ77 backward references          | ❌ Not in encoder | -              |
|        | - Color cache                       | ❌ Not in encoder | -              |
|        | - Transforms (predictor, etc.)      | ❌ Not Yet        | -              |
|        | WebP Lossy (VP8L with quantization) | ✅ Quality-based  | Pure-JS        |
|        | - Color quantization for lossy      | ✅ Full           | Pure-JS        |
|        | WebP Lossy (VP8)                    | ⚠️ Native only    | ImageDecoder   |
|        | - EXIF, XMP metadata                | ✅ Full           | Pure-JS        |
| TIFF   | TIFF 6.0 - Uncompressed RGB/RGBA    | ✅ Full           | Pure-JS        |
|        | TIFF 6.0 - LZW compressed RGB/RGBA  | ✅ Full           | Pure-JS        |
|        | - JPEG, PackBits compression        | ⚠️ Native only    | ImageDecoder   |
|        | - Multi-page/IFD (decode & encode)  | ✅ Full           | Pure-JS        |
|        | - EXIF, Artist, Copyright metadata  | ✅ Full           | Pure-JS        |
| GIF    | GIF87a, GIF89a                      | ✅ Full           | Pure-JS        |
|        | - LZW compression/decompression     | ✅ Full           | Pure-JS        |
|        | - Color quantization (encoding)     | ✅ Full           | Pure-JS        |
|        | - Transparency support              | ✅ Full           | Pure-JS        |
|        | - Interlacing support               | ✅ Full           | Pure-JS        |
|        | - Animation (multi-frame decode)    | ✅ Full           | Pure-JS        |
|        | - Animation (encode first frame)    | ⚠️ Single frame   | Pure-JS        |
|        | - Comment extensions, XMP           | ✅ Full           | Pure-JS        |
| RAW    | Uncompressed RGBA                   | ✅ Full           | Pure-JS        |
| ASCII  | Text-based ASCII art                | ✅ Full           | Pure-JS        |
|        | - Multiple character sets           | ✅ Full           | Pure-JS        |
|        | - Configurable width & aspect ratio | ✅ Full           | Pure-JS        |
|        | - Brightness inversion              | ✅ Full           | Pure-JS        |

### Runtime Compatibility by Format

| Format | Deno 2.x | Node.js 18+ | Node.js 20+ | Bun | Notes                                        |
| ------ | -------- | ----------- | ----------- | --- | -------------------------------------------- |
| PNG    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                     |
| BMP    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                     |
| RAW    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                     |
| ASCII  | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                     |
| GIF    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                     |
| JPEG   | ✅       | ⚠️ Baseline | ✅          | ✅  | Node 18: pure-JS baseline only, 20+: full    |
| WebP   | ✅       | ⚠️ Lossless | ✅          | ✅  | Node 18: pure-JS lossless only, 20+: full    |
| TIFF   | ✅       | ✅          | ✅          | ✅  | Node 18: pure-JS uncompressed+LZW, 20+: full |

**Note**: For maximum compatibility across all runtimes, use PNG, BMP, GIF,
ASCII or RAW formats which have complete pure-JS implementations.

## Extending with Custom Formats

```ts
import { Image, type ImageData, type ImageFormat } from "@cross/image";

class MyCustomFormat implements ImageFormat {
  readonly name = "custom";
  readonly mimeType = "image/custom";

  canDecode(data: Uint8Array): boolean {
    // Check if data matches your format
    return data[0] === 0x42; // Example magic byte
  }

  async decode(data: Uint8Array): Promise<ImageData> {
    // Decode your format to RGBA
    return {
      width: 100,
      height: 100,
      data: new Uint8Array(100 * 100 * 4),
    };
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    // Encode RGBA to your format
    return new Uint8Array([0x42 /* ... */]);
  }
}

// Register the format
Image.registerFormat(new MyCustomFormat());

// Now you can use it
const image = await Image.read(customData, "custom");
const output = await image.save("custom");
```

## API Reference

### `Image`

The main class for working with images.

#### Static Methods

- `Image.read(data: Uint8Array, format?: string): Promise<Image>` - Read an
  image from bytes
- `Image.readFrames(data: Uint8Array, format?: string): Promise<MultiFrameImageData>` -
  Read all frames from a multi-frame image (animated GIF or multi-page TIFF)
- `Image.saveFrames(format: string, imageData: MultiFrameImageData, options?: unknown): Promise<Uint8Array>` -
  Save multi-frame image data to bytes in the specified format
- `Image.fromRGBA(width: number, height: number, data: Uint8Array): Image` -
  Create an image from raw RGBA data
- `Image.registerFormat(format: ImageFormat): void` - Register a custom format
- `Image.getFormats(): readonly ImageFormat[]` - Get all registered formats

#### Instance Properties

- `width: number` - Image width in pixels (read-only)
- `height: number` - Image height in pixels (read-only)
- `data: Uint8Array` - Raw RGBA pixel data (read-only)

#### Instance Methods

- `resize(options: ResizeOptions): this` - Resize the image (chainable)
- `save(format: string, options?: unknown): Promise<Uint8Array>` - Save to bytes
  in specified format with optional format-specific options
- `clone(): Image` - Create a copy of the image

### Types

#### `ResizeOptions`

```ts
interface ResizeOptions {
  width: number; // Target width
  height: number; // Target height
  method?: "nearest" | "bilinear"; // Resize algorithm (default: "bilinear")
}
```

#### `ASCIIOptions`

```ts
interface ASCIIOptions {
  width?: number; // Target width in characters (default: 80)
  charset?: "simple" | "extended" | "blocks" | "detailed"; // Character set (default: "simple")
  aspectRatio?: number; // Aspect ratio correction for terminal (default: 0.5)
  invert?: boolean; // Invert brightness (default: false)
}
```

**Character sets:**

- `simple`: 10 characters (`.:-=+*#%@`) - good for basic art
- `extended`: 70 characters - detailed gradients
- `blocks`: 5 block characters (`░▒▓█`) - smooth gradients
- `detailed`: 92 characters - maximum detail

**Usage:**

```ts
const ascii = await image.save("ascii", {
  width: 60,
  charset: "blocks",
  aspectRatio: 0.5,
  invert: false,
});
```

#### `WebPEncodeOptions`

```ts
interface WebPEncodeOptions {
  quality?: number; // Encoding quality 1-100 (default: 90)
  lossless?: boolean; // Force lossless encoding (default: false)
}
```

**Quality levels:**

- `100`: Lossless encoding (VP8L without quantization)
- `90-99`: Very high quality with minimal quantization
- `70-89`: High quality with light quantization
- `50-69`: Medium quality with noticeable quantization
- `30-49`: Lower quality with heavy quantization
- `1-29`: Low quality with very heavy quantization

**Lossless flag:**

- When `lossless: true`, forces lossless VP8L encoding even if quality < 100
- Useful when you want pure-JS encoding without quantization

**Usage:**

```ts
// Lossless WebP
const lossless = await image.save("webp", { quality: 100 });

// Lossy WebP with high quality
const lossy = await image.save("webp", { quality: 85 });

// Force lossless in pure-JS
const forcedLossless = await image.save("webp", {
  quality: 80,
  lossless: true,
});
```

**Note:** When OffscreenCanvas is available (Deno, modern browsers, Bun), the
runtime's native WebP encoder is used for better compression and quality. In
pure-JS mode (Node.js without OffscreenCanvas), VP8L format with quality-based
color quantization is used for lossy encoding.

#### `TIFFEncodeOptions`

```ts
interface TIFFEncodeOptions {
  compression?: "none" | "lzw"; // Compression method (default: "none")
}
```

**Compression methods:**

- `none`: Uncompressed TIFF - larger file size, fastest encoding
- `lzw`: LZW compression - smaller file size for most images, lossless

**Usage:**

```ts
// Save as uncompressed TIFF (default)
const uncompressed = await image.save("tiff");

// Save with LZW compression
const compressed = await image.save("tiff", { compression: "lzw" });
```

#### `ImageData`

```ts
interface ImageData {
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  data: Uint8Array; // Raw RGBA data (4 bytes per pixel)
  metadata?: ImageMetadata; // Optional metadata
}
```

#### `MultiFrameImageData`

```ts
interface MultiFrameImageData {
  width: number; // Canvas width in pixels
  height: number; // Canvas height in pixels
  frames: ImageFrame[]; // Array of frames
  metadata?: ImageMetadata; // Optional global metadata
}
```

#### `ImageFrame`

```ts
interface ImageFrame {
  width: number; // Frame width in pixels
  height: number; // Frame height in pixels
  data: Uint8Array; // Raw RGBA data (4 bytes per pixel)
  frameMetadata?: FrameMetadata; // Optional frame-specific metadata
}
```

#### `FrameMetadata`

```ts
interface FrameMetadata {
  delay?: number; // Frame delay in milliseconds (for animations)
  disposal?: "none" | "background" | "previous"; // Frame disposal method
  left?: number; // X offset of frame within canvas
  top?: number; // Y offset of frame within canvas
}
```

#### `ImageFormat`

```ts
interface ImageFormat {
  readonly name: string; // Format name (e.g., "png")
  readonly mimeType: string; // MIME type (e.g., "image/png")
  canDecode(data: Uint8Array): boolean; // Check if data is in this format
  decode(data: Uint8Array): Promise<ImageData>; // Decode to RGBA
  encode(imageData: ImageData): Promise<Uint8Array>; // Encode from RGBA
  decodeFrames?(data: Uint8Array): Promise<MultiFrameImageData>; // Decode all frames
  encodeFrames?(
    imageData: MultiFrameImageData,
    options?: unknown,
  ): Promise<Uint8Array>; // Encode multi-frame
  supportsMultipleFrames?(): boolean; // Check if format supports multiple frames
}
```

## Runtime Compatibility

- **Deno 2.x** - Full support for all formats
- **Node.js 18+** - Full support with pure-JS fallbacks for formats without
  ImageDecoder
- **Node.js 20+** - Full support including ImageDecoder API for all formats
- **Bun** - Full support for all formats

The library automatically selects the best available implementation:

1. Pure-JS decoders/encoders are tried first when available
2. Native APIs (ImageDecoder, OffscreenCanvas) are used as fallbacks or for
   formats without pure-JS support
3. Graceful degradation ensures maximum compatibility across runtimes

## Development

### Running Tests

```bash
deno test -A
```

### Linting and Formatting

```bash
deno fmt --check
deno lint
```

### Type Checking

```bash
deno check mod.ts
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
