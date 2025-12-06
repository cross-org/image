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

| Format | Read | Write | Pure-JS Decode  | Pure-JS Encode  | Native API Decode | Native API Encode  | Notes                                  |
| ------ | ---- | ----- | --------------- | --------------- | ----------------- | ------------------ | -------------------------------------- |
| PNG    | ✅   | ✅    | ✅ Full         | ✅ Full         | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation        |
| BMP    | ✅   | ✅    | ✅ Full         | ✅ Full         | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation        |
| RAW    | ✅   | ✅    | ✅ Full         | ✅ Full         | N/A               | N/A                | Uncompressed RGBA (no metadata)        |
| ASCII  | ✅   | ✅    | ✅ Full         | ✅ Full         | N/A               | N/A                | Text-based ASCII art representation    |
| JPEG   | ✅   | ✅    | ⚠️ Baseline     | ⚠️ Baseline     | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS for baseline DCT only          |
| GIF    | ✅   | ✅    | ✅ Full         | ✅ Full         | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation        |
| WebP   | ✅   | ✅    | ⚠️ Lossless     | ❌              | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS for lossless (VP8L) only       |
| TIFF   | ✅   | ✅    | ⚠️ Uncompressed | ✅ Uncompressed | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS for uncompressed RGB/RGBA only |

**Legend:**

- ✅ **Full support** - Complete implementation with all common features
- ⚠️ **Limited support** - Partial implementation with restrictions
- ❌ **Not supported** - Feature not available in pure-JS, requires native APIs
- **Pure-JS** - Works in all JavaScript runtimes without native dependencies
- **Native API** - Uses runtime APIs like ImageDecoder (decode) or
  OffscreenCanvas (encode)

### Format Specifications Supported

This table shows which format standards and variants are supported:

| Format | Specification/Variant               | Support Level  | Implementation |
| ------ | ----------------------------------- | -------------- | -------------- |
| PNG    | PNG 1.2 (ISO/IEC 15948)             | ✅ Full        | Pure-JS        |
|        | - Interlaced (Adam7)                | ❌ Not Yet     | -              |
|        | - Color types: Grayscale, RGB, RGBA | ✅ Full        | Pure-JS        |
|        | - Metadata: pHYs, tEXt, iTXt, eXIf  | ✅ Full        | Pure-JS        |
| BMP    | Windows BMP (BITMAPINFOHEADER)      | ✅ Full        | Pure-JS        |
|        | - 24-bit RGB                        | ✅ Full        | Pure-JS        |
|        | - 32-bit RGBA                       | ✅ Full        | Pure-JS        |
|        | - Compressed variants (RLE)         | ❌ Not Yet     | -              |
| JPEG   | JPEG/JFIF Baseline DCT              | ✅ Full        | Pure-JS        |
|        | Progressive DCT                     | ⚠️ Native only | ImageDecoder   |
|        | - EXIF metadata                     | ✅ Full        | Pure-JS        |
|        | - JFIF (APP0) with DPI              | ✅ Full        | Pure-JS        |
| WebP   | WebP Lossless (VP8L)                | ⚠️ Partial     | Pure-JS        |
|        | - Huffman coding                    | ✅ Full        | Pure-JS        |
|        | - LZ77 backward references          | ✅ Full        | Pure-JS        |
|        | - Color cache                       | ✅ Full        | Pure-JS        |
|        | - Transforms (predictor, etc.)      | ❌ Not Yet     | -              |
|        | WebP Lossy (VP8)                    | ⚠️ Native only | ImageDecoder   |
|        | - EXIF, XMP metadata                | ✅ Full        | Pure-JS        |
| TIFF   | TIFF 6.0 - Uncompressed RGB/RGBA    | ✅ Full        | Pure-JS        |
|        | - LZW, JPEG, PackBits compression   | ⚠️ Native only | ImageDecoder   |
|        | - Multi-page/IFD                    | ❌ Not Yet     | -              |
|        | - EXIF, Artist, Copyright metadata  | ✅ Full        | Pure-JS        |
| GIF    | GIF87a, GIF89a                      | ✅ Full        | Pure-JS        |
|        | - LZW compression/decompression     | ✅ Full        | Pure-JS        |
|        | - Color quantization (encoding)     | ✅ Full        | Pure-JS        |
|        | - Transparency support              | ✅ Full        | Pure-JS        |
|        | - Interlacing support               | ✅ Full        | Pure-JS        |
|        | - Animation (first frame only)      | ✅ Full        | Pure-JS        |
|        | - Comment extensions, XMP           | ✅ Full        | Pure-JS        |
| RAW    | Uncompressed RGBA                   | ✅ Full        | Pure-JS        |
| ASCII  | Text-based ASCII art                | ✅ Full        | Pure-JS        |
|        | - Multiple character sets           | ✅ Full        | Pure-JS        |
|        | - Configurable width & aspect ratio | ✅ Full        | Pure-JS        |
|        | - Brightness inversion              | ✅ Full        | Pure-JS        |

### Runtime Compatibility by Format

| Format | Deno 2.x | Node.js 18+ | Node.js 20+ | Bun | Notes                                         |
| ------ | -------- | ----------- | ----------- | --- | --------------------------------------------- |
| PNG    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                      |
| BMP    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                      |
| RAW    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                      |
| ASCII  | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                      |
| GIF    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                      |
| JPEG   | ✅       | ⚠️ Baseline | ✅          | ✅  | Node 18: pure-JS baseline only, 20+: full     |
| WebP   | ✅       | ⚠️ Lossless | ✅          | ✅  | Node 18: pure-JS lossless only, 20+: full     |
| TIFF   | ✅       | ⚠️ Basic    | ✅          | ✅  | Node 18: pure-JS uncompressed only, 20+: full |

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

#### `ImageData`

```ts
interface ImageData {
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  data: Uint8Array; // Raw RGBA data (4 bytes per pixel)
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
