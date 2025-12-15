---
title: "Overview"
nav_order: 1
---

# @cross/image

A pure JavaScript, dependency-free, cross-runtime image processing library for Deno, Node.js, and
Bun.

## Features

- 🚀 **Pure JavaScript** - No native dependencies
- 🔌 **Pluggable formats** - Easy to extend with custom formats
- 📦 **Cross-runtime** - Works on Deno, Node.js (18+), and Bun
- 🎨 **Multiple formats** - PNG, APNG, JPEG, WebP, GIF, TIFF, BMP, ICO, DNG, PAM, PPM, PCX, ASCII,
  HEIC, and AVIF support
- ✂️ **Image manipulation** - Resize, crop, composite, and more
- 🎛️ **Image processing** - Chainable filters including `brightness`, `contrast`, `saturation`,
  `exposure`, `blur`, `sharpen`, `sepia`, and more
- 🖌️ **Drawing operations** - Create, fill, and manipulate pixels
- 🧩 **Multi-frame** - Decode/encode animated GIFs, APNGs and multi-page TIFFs
- 🔧 **Simple API** - Easy to use, intuitive interface

## Installation

### Deno

```ts
import { Image } from "jsr:@cross/image";
```

### Node.js

```bash
npm install cross-image
```

```ts
import { Image } from "cross-image";
```

### Bun

```bash
npm install cross-image
```

```ts
import { Image } from "cross-image";
```

## Quick Start

### Deno

```ts
import { Image } from "jsr:@cross/image";

// Decode an image (auto-detects format)
const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Create a new blank image
const canvas = Image.create(800, 600, 255, 255, 255);

// Composite the loaded image on top
canvas.composite(image, 50, 50);

// Apply image processing
canvas
  .brightness(0.1)
  .contrast(0.2)
  .saturation(-0.1);

// Encode the result
const jpeg = await canvas.encode("jpeg");
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

// Save the result
const jpeg = await image.encode("jpeg");
await writeFile("output.jpg", jpeg);
```

## Base64 / Data URLs

Utilities are available for converting bytes to/from base64 data URLs.

```ts
import { Image, parseDataUrl, toDataUrl } from "jsr:@cross/image";

const image = Image.create(2, 2, 255, 0, 0);
const pngBytes = await image.encode("png");

const url = toDataUrl("image/png", pngBytes);
const { bytes } = parseDataUrl(url);

await Image.decode(bytes, "png");
```

## Documentation

- **[API Reference](api.md)** - Complete API documentation
- **[Format Support](formats.md)** - Supported formats and specifications
- **[Image Processing](processing/)** - Filters, manipulation, and color adjustments
  - [Filters](processing/filters.md) - Blur, sharpen, and noise reduction
  - [Manipulation](processing/manipulation.md) - Resize, crop, composite, and draw
  - [Color Adjustments](processing/color-adjustments.md) - Brightness, contrast, saturation, and
    more
- **[Examples](examples/)** - Practical examples for common tasks
  - [Decoding & Encoding](examples/decoding-encoding.md) - Format-specific examples
  - [Using Filters](examples/filters.md) - Filter workflows and techniques
  - [Manipulation](examples/manipulation.md) - Resizing, cropping, and compositing
  - [Multi-Frame Images](examples/multi-frame.md) - Animated GIFs, APNGs, and TIFFs
- **[JPEG Implementation](implementation/jpeg-implementation.md)** - Technical details for JPEG
- **[WebP Implementation](implementation/webp-implementation.md)** - Technical details for WebP

## Supported Formats

@cross/image supports 15 image formats with varying levels of pure-JS implementation:

- **PNG, APNG, BMP, ICO, GIF, DNG, PAM, PPM, PCX, ASCII** - Full pure-JS implementation
- **JPEG** - Pure-JS baseline & progressive DCT
- **WebP** - Pure-JS lossless, native API for lossy VP8
- **TIFF** - Pure-JS uncompressed + LZW, native API for other compressions
- **HEIC, AVIF** - Runtime-based implementation (requires ImageDecoder/OffscreenCanvas API)

See the [Format Support](formats.md) page for detailed compatibility information.

## JPEG Tolerant Decoding

The JPEG decoder enables a tolerant decoding mode by default that keeps decoding even when
individual blocks fail, filling those areas with neutral values instead of throwing. That makes the
decoder resilient against complex mobile encodings, progressive scans, and partially corrupted
files.

**Highlights:**

- Enabled by default; works automatically through `Image.decode()`
- Supports both baseline and progressive JPEGs, respecting spectral selection and successive
  approximation
- Optional `tolerantDecoding` flag lets you opt into strict validation
- `onWarning` callback can surface non-fatal decode issues for logging

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("input.jpg");

// Default behavior - tolerant decoding enabled
const image = await Image.decode(data);

// Strict mode - fail fast on decode errors
const strictImage = await Image.decode(data, { tolerantDecoding: false });

// Optional: receive warnings during partial decode (pure-JS decoder paths)
const imageWithWarnings = await Image.decode(data, {
  tolerantDecoding: true,
  runtimeDecoding: "never",
  onWarning: (message, details) => {
    myLogger.warn(message, details);
  },
});

void image;
void strictImage;
void imageWithWarnings;
```

Find implementation notes in
[docs/src/implementation/jpeg-implementation.md](implementation/jpeg-implementation.md).

## Fault-Tolerant Decoding for Other Formats

Several other decoders ship with fault-tolerant defaults as well:

- **GIF** - Skips corrupted frames and keeps valid ones instead of aborting.
- **WebP VP8L** - Converts corrupted pixels to neutral gray and continues.

Each decoder exposes the same `tolerantDecoding` option plus `onWarning`, so you can switch between
resilience and strict validation with the same API.

## Metadata Support

@cross/image includes EXIF 3.0-compliant metadata parsing for JPEG, TIFF, WebP, and other
JPEG-family formats. You can read, set, and preserve rich camera information, GPS coordinates, and
DPI when saving images.

**Metadata coverage:**

- Basic fields such as titles, descriptions, copyright, and creation dates
- Camera details like make/model, ISO, exposure time, focal length, and orientation
- GPS coordinates with full precision plus helper methods like `image.getPosition()`
- EXIF, IFD0, InteropIFD, and GPS IFD tags across BYTE, ASCII, SHORT, LONG, and RATIONAL types

```ts
import { Image } from "jsr:@cross/image";

const image = await Image.decode(data);
image.setMetadata({ cameraMake: "Canon", iso: 800 });
image.setPosition(40.7128, -74.0060);
const saved = await image.save("jpeg");
```

## Warning Callbacks

Every decoder exposes an optional `onWarning` callback so you can monitor non-fatal issues without
printing to `console`. The callback receives a human- readable message plus optional details that
describe the underlying error.

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("input.jpg");

const image = await Image.decode(data, {
  tolerantDecoding: true,
  runtimeDecoding: "never",
  onWarning: (message, details) => {
    myLogger.warn(message, details);
  },
});

void image;
```

Use the callback to surface logs, analytics, or recovery strategies while keeping tolerant decoding
enabled.

## License

MIT License - see [LICENSE](https://github.com/cross-org/image/blob/main/LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request on
[GitHub](https://github.com/cross-org/image).
