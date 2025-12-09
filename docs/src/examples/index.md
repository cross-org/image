---
title: "Examples"
nav_order: 5
---

# Examples

This section provides practical examples of using @cross/image for common image
processing tasks.

## Quick Links

- **[Decoding & Encoding](decoding-encoding.md)** - Format-specific examples for
  reading and writing images
- **[Using Filters](filters.md)** - Practical filter examples and workflows
- **[Manipulation Examples](manipulation.md)** - Resizing, cropping, and
  compositing
- **[Multi-Frame Images](multi-frame.md)** - Working with animated GIFs, APNGs,
  and multi-page TIFFs

## Runtime File I/O

The library operates on `Uint8Array` data. You can use your runtime's native
file I/O methods to read and write images.

### Deno

```ts
const data = await Deno.readFile("input.png");
await Deno.writeFile("output.png", data);
```

### Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
const data = await readFile("input.png");
await writeFile("output.png", data);
```

### Bun

```ts
const data = await Bun.file("input.png").bytes();
await Bun.write("output.png", data);
```

## Basic Example

Here's a complete example showing common operations:

```ts
import { Image } from "@cross/image";

// Decode an image (auto-detects format)
const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Apply processing
image
  .resize({ width: 800, height: 600 })
  .brightness(0.1)
  .contrast(0.2)
  .gaussianBlur(1)
  .sharpen(0.5);

// Encode as different format
const jpeg = await image.encode("jpeg");
await Deno.writeFile("output.jpg", jpeg);
```

## Creating Images from Scratch

### Using Image.create()

```ts
import { Image } from "@cross/image";

// Create a white 800x600 canvas
const canvas = Image.create(800, 600, 255, 255, 255);

// Draw on it
canvas.fillRect(100, 100, 200, 150, 255, 0, 0); // Red rectangle

// Save it
await Deno.writeFile("canvas.png", await canvas.encode("png"));
```

### Using Image.fromRGBA()

```ts
import { Image } from "@cross/image";

// Create raw RGBA data
const width = 100;
const height = 100;
const data = new Uint8Array(width * height * 4);

// Fill with gradient
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = x * 2.55; // R: 0-255 left to right
    data[i + 1] = y * 2.55; // G: 0-255 top to bottom
    data[i + 2] = 128; // B: constant
    data[i + 3] = 255; // A: opaque
  }
}

const image = Image.fromRGBA(width, height, data);
await Deno.writeFile("gradient.png", await image.encode("png"));
```

## Chaining Operations

All processing methods return `this`, allowing elegant method chaining:

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Chain multiple operations
image
  .resize({ width: 1920, height: 1080 })
  .crop(100, 100, 1720, 880)
  .brightness(0.1)
  .contrast(0.2)
  .saturation(-0.1)
  .gaussianBlur(1)
  .sharpen(0.5);

const output = await image.encode("png");
await Deno.writeFile("processed.png", output);
```

## Cross-Runtime Examples

### Node.js Example

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "@cross/image";

const data = await readFile("input.png");
const image = await Image.decode(data);

image.resize({ width: 400, height: 300 });

const output = await image.encode("png");
await writeFile("output.png", output);
```

### Bun Example

```ts
import { Image } from "@cross/image";

const file = Bun.file("input.png");
const data = new Uint8Array(await file.arrayBuffer());
const image = await Image.decode(data);

image.resize({ width: 400, height: 300 });

const output = await image.encode("png");
await Bun.write("output.png", output);
```

## Next Steps

Explore the detailed examples in each section:

- **[Decoding & Encoding](decoding-encoding.md)** - Learn format-specific
  options
- **[Using Filters](filters.md)** - Apply blur, sharpen, and noise reduction
- **[Manipulation Examples](manipulation.md)** - Transform and layer images
- **[Multi-Frame Images](multi-frame.md)** - Work with animations and multi-page
  documents
