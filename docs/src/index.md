---
title: Home
order: 0
---

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

## Supported Formats

This table shows which image formats are supported and their implementation
status:

| Format | Read | Write | Pure-JS Decode | Pure-JS Encode | Notes                                        |
| ------ | ---- | ----- | -------------- | -------------- | -------------------------------------------- |
| PNG    | ✅   | ✅    | ✅ Full        | ✅ Full        | Complete pure-JS implementation              |
| BMP    | ✅   | ✅    | ✅ Full        | ✅ Full        | Complete pure-JS implementation              |
| RAW    | ✅   | ✅    | ✅ Full        | ✅ Full        | Uncompressed RGBA (no metadata)              |
| ASCII  | ✅   | ✅    | ✅ Full        | ✅ Full        | Text-based ASCII art representation          |
| JPEG   | ✅   | ✅    | ⚠️ Baseline    | ⚠️ Baseline    | Pure-JS for baseline DCT only                |
| GIF    | ✅   | ✅    | ✅ Full        | ✅ Full        | Complete pure-JS implementation              |
| WebP   | ✅   | ✅    | ⚠️ Lossless    | ⚠️ Quantized   | Pure-JS VP8L with quality-based quantization |
| TIFF   | ✅   | ✅    | ⚠️ Basic       | ⚠️ Basic       | Pure-JS for uncompressed & LZW RGB/RGBA      |

**Legend:**

- ✅ **Full support** - Complete implementation with all common features
- ⚠️ **Limited support** - Partial implementation with restrictions
- **Pure-JS** - Works in all JavaScript runtimes without native dependencies

## Runtime Compatibility

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

## API Reference

See the [API documentation](api.md) for detailed information about classes,
methods, and types.

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request on
[GitHub](https://github.com/cross-org/image).
