# @cross/image

A pure JavaScript, dependency-free, cross-runtime image processing library for
Deno, Node.js, and Bun. Decode, encode, manipulate, and process images in
multiple formats including PNG, JPEG, WebP, GIF, and more—all without native
dependencies.

📚 **[Full Documentation](https://cross-image.56k.guru/)**

## Features

- 🚀 **Pure JavaScript** - No native dependencies
- 🔌 **Pluggable formats** - Easy to extend with custom formats
- 📦 **Cross-runtime** - Works on Deno, Node.js (18+), and Bun
- 🎨 **Multiple formats** - PNG, APNG, JPEG, WebP, GIF, TIFF, BMP, ICO, DNG,
  PAM, PPM, PCX and ASCII support
- ✂️ **Image manipulation** - Resize, crop, composite, and more
- 🎛️ **Image processing** - Chainable filters including `brightness`,
  `contrast`, `saturation`, `exposure`, `blur`, `sharpen`, `sepia`, and more
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

// Decode an image (auto-detects format)
const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Create a new blank image
const canvas = Image.create(800, 600, 255, 255, 255); // white background

// Composite the loaded image on top
canvas.composite(image, 50, 50);

// Apply image processing filters
canvas
  .brightness(0.1)
  .contrast(0.2)
  .saturation(-0.1)
  .blur(1)
  .sharpen(0.3);

// Encode in a different format
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

// Save in a different format
const jpeg = await image.encode("jpeg");
await writeFile("output.jpg", jpeg);
```

## Supported Formats

| Format | Pure-JS     | Notes                           |
| ------ | ----------- | ------------------------------- |
| PNG    | ✅ Full     | Complete pure-JS implementation |
| APNG   | ✅ Full     | Animated PNG with multi-frame   |
| BMP    | ✅ Full     | Complete pure-JS implementation |
| ICO    | ✅ Full     | Windows Icon format             |
| GIF    | ✅ Full     | Animated GIF with multi-frame   |
| DNG    | ✅ Full     | Linear DNG (Uncompressed RGBA)  |
| PAM    | ✅ Full     | Netpbm PAM format               |
| PPM    | ✅ Full     | Netpbm PPM format (P3/P6)       |
| PCX    | ✅ Full     | ZSoft PCX (RLE compressed)      |
| ASCII  | ✅ Full     | Text-based ASCII art            |
| JPEG   | ⚠️ Baseline | Pure-JS baseline DCT only       |
| WebP   | ⚠️ Lossless | Pure-JS lossless VP8L           |
| TIFF   | ⚠️ Basic    | Pure-JS uncompressed + LZW      |

See the
[full format support documentation](https://cross-image.56k.guru/formats/) for
detailed compatibility information.

## Documentation

- **[API Reference](https://cross-image.56k.guru/api/)** - Complete API
  documentation
- **[Examples](https://cross-image.56k.guru/examples/)** - Usage examples for
  common tasks
- **[Format Support](https://cross-image.56k.guru/formats/)** - Supported
  formats and specifications
- **[JPEG Implementation](https://cross-image.56k.guru/implementation/jpeg-implementation/)** -
  Technical details for JPEG
- **[WebP Implementation](https://cross-image.56k.guru/implementation/webp-implementation/)** -
  Technical details for WebP

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
