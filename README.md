# @cross/image

A pure JavaScript, dependency-free, cross-runtime image processing library for
Deno, Node.js, and Bun.

## Features

- 🚀 **Pure JavaScript** - No native dependencies
- 🔌 **Pluggable formats** - Easy to extend with custom formats
- 📦 **Cross-runtime** - Works on Deno, Node.js (18+), and Bun
- 🎨 **Multiple formats** - PNG, JPEG, WebP, GIF, TIFF, and BMP support
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

| Format | Read | Write | Notes                            |
| ------ | ---- | ----- | -------------------------------- |
| PNG    | ✅   | ✅    | Full pure-JS implementation      |
| JPEG   | ✅   | ✅    | Uses runtime APIs (ImageDecoder) |
| WebP   | ✅   | ✅    | Uses runtime APIs (ImageDecoder) |
| GIF    | ✅   | ✅    | Uses runtime APIs (ImageDecoder) |
| TIFF   | ✅   | ✅    | Uses runtime APIs (ImageDecoder) |
| BMP    | ✅   | ✅    | Full pure-JS implementation      |

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
- `save(format: string): Promise<Uint8Array>` - Save to bytes in specified
  format
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

- **Deno 2.x** - Full support
- **Node.js 18+** - Full support (requires built-in Web APIs)
- **Bun** - Full support

Note: JPEG and WebP encoding/decoding use runtime APIs (`ImageDecoder`,
`OffscreenCanvas`) which are available in modern runtimes. PNG has a full
pure-JS implementation and works everywhere.

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
