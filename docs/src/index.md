---
title: "Overview"
nav_order: 1
---

# @cross/image

A pure JavaScript, dependency-free, cross-runtime image processing library for
Deno, Node.js, and Bun.

## Features

- 🚀 **Pure JavaScript** - No native dependencies
- 🔌 **Pluggable formats** - Easy to extend with custom formats
- 📦 **Cross-runtime** - Works on Deno, Node.js (18+), and Bun
- 🎨 **Multiple formats** - PNG, JPEG, WebP, GIF, TIFF, BMP, DNG, PAM, PCX, and
  ASCII support
- ✂️ **Image manipulation** - Resize, crop, and composite images
- 🎛️ **Image processing** - Adjust brightness, contrast, saturation, exposure
- 🖌️ **Drawing operations** - Fill rectangles, get/set pixels, create images
  from scratch
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

### Deno

```ts
import { Image } from "@cross/image";

// Read an image (auto-detects format)
const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Resize the image
image.resize({ width: 800, height: 600 });

// Save in a different format
const jpeg = await image.save("jpeg");
await Deno.writeFile("output.jpg", jpeg);
```

### Node.js

```ts
import { Image } from "cross-image";
import { readFile, writeFile } from "node:fs/promises";

// Read an image (auto-detects format)
const data = await readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Resize the image
image.resize({ width: 800, height: 600 });

// Save in a different format
const jpeg = await image.save("jpeg");
await writeFile("output.jpg", jpeg);
```

## Documentation

- **[API Reference](api.md)** - Complete API documentation
- **[Format Support](formats.md)** - Supported formats and specifications
- **[Examples](examples.md)** - Usage examples for common tasks
- **[JPEG Implementation](jpeg-implementation.md)** - Technical details for JPEG
- **[WebP Implementation](webp-implementation.md)** - Technical details for WebP

## Supported Formats

@cross/image supports 10 image formats with varying levels of pure-JS
implementation:

- **PNG, BMP, GIF, DNG, PAM, PCX, ASCII** - Full pure-JS implementation
- **JPEG** - Pure-JS baseline DCT, native API for progressive
- **WebP** - Pure-JS lossless, native API for lossy VP8
- **TIFF** - Pure-JS uncompressed + LZW, native API for other compressions

See the [Format Support](formats.md) page for detailed compatibility
information.

## License

MIT License - see
[LICENSE](https://github.com/cross-org/image/blob/main/LICENSE) file for
details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request on
[GitHub](https://github.com/cross-org/image).
