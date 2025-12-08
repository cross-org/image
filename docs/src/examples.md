---
title: Examples
order: 3
---

# Examples

This page provides practical examples of using @cross/image for common image
processing tasks.

## Runtime File I/O

The library operates on `Uint8Array` data. You can use your runtime's native file I/O methods to read and write images.

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

## Basic Operations

### Decoding and Encoding Images

#### Deno

```ts
import { Image } from "@cross/image";

// Decode an image (auto-detects format)
const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Encode as different format
const jpeg = await image.encode("jpeg");
await Deno.writeFile("output.jpg", jpeg);
```

#### Node.js

```ts
import { Image } from "cross-image";
import { readFile, writeFile } from "node:fs/promises";

// Read an image (auto-detects format)
const data = await readFile("input.png");
const image = await Image.read(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Save as different format
const jpeg = await image.save("jpeg");
await writeFile("output.jpg", jpeg);
```

### Resizing Images

#### Deno

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Resize with bilinear interpolation (default)
image.resize({ width: 800, height: 600 });

// Or use nearest neighbor for faster, pixelated results
image.resize({ width: 400, height: 300, method: "nearest" });

// Encode the result
const output = await image.encode("png");
await Deno.writeFile("resized.png", output);
```

#### Node.js

```ts
import { Image } from "cross-image";
import { readFile, writeFile } from "node:fs/promises";

const data = await readFile("input.png");
const image = await Image.read(data);

// Resize with bilinear interpolation (default)
image.resize({ width: 800, height: 600 });

// Or use nearest neighbor for faster, pixelated results
image.resize({ width: 400, height: 300, method: "nearest" });

// Save the result
const output = await image.save("png");
await writeFile("resized.png", output);
```

### Creating Images from Scratch

#### Deno

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
const png = await image.encode("png");
await Deno.writeFile("red-square.png", png);
```

#### Node.js

```ts
import { Image } from "cross-image";
import { writeFile } from "node:fs/promises";

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
await writeFile("red-square.png", png);
```

### Chaining Operations

#### Deno

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Chain multiple operations
image
  .resize({ width: 1920, height: 1080 })
  .resize({ width: 800, height: 600 });

const output = await image.encode("webp");
await Deno.writeFile("output.webp", output);
```

#### Node.js

```ts
import { Image } from "cross-image";
import { readFile, writeFile } from "node:fs/promises";

const data = await readFile("input.png");
const image = await Image.read(data);

// Chain multiple operations
image
  .resize({ width: 1920, height: 1080 })
  .resize({ width: 800, height: 600 });

const output = await image.save("webp");
await writeFile("output.webp", output);
```

## Format-Specific Examples

### Using TIFF with LZW Compression

#### Deno

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as uncompressed TIFF
const uncompressed = await image.encode("tiff");
await Deno.writeFile("output.tiff", uncompressed);

// Encode with LZW compression (smaller file size)
const compressed = await image.encode("tiff", { compression: "lzw" });
await Deno.writeFile("output-compressed.tiff", compressed);
```

#### Node.js

```ts
import { Image } from "cross-image";
import { readFile, writeFile } from "node:fs/promises";

const data = await readFile("input.png");
const image = await Image.read(data);

// Save as uncompressed TIFF
const uncompressed = await image.save("tiff");
await writeFile("output.tiff", uncompressed);

// Save with LZW compression (smaller file size)
const compressed = await image.save("tiff", { compression: "lzw" });
await writeFile("output-compressed.tiff", compressed);
```

### Using WebP with Quality Settings

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as lossless WebP (quality = 100)
const lossless = await image.encode("webp", { quality: 100 });
await Deno.writeFile("output-lossless.webp", lossless);

// Encode as lossy WebP with high quality (smaller file size)
const highQuality = await image.encode("webp", { quality: 90 });
await Deno.writeFile("output-hq.webp", highQuality);

// Encode as lossy WebP with medium quality (much smaller)
const mediumQuality = await image.encode("webp", { quality: 75 });
await Deno.writeFile("output-med.webp", mediumQuality);

// Force lossless even with quality < 100 (pure-JS VP8L)
const forcedLossless = await image.encode("webp", {
  quality: 80,
  lossless: true,
});
await Deno.writeFile("output-forced.webp", forcedLossless);
```

### Converting to ASCII Art

```ts
import { type ASCIIOptions, Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Convert to ASCII art with simple characters
const ascii = await image.encode("ascii", { width: 80, charset: "simple" });
console.log(new TextDecoder().decode(ascii));

// Or use block characters for better gradients
const blocks = await image.encode("ascii", {
  width: 60,
  charset: "blocks",
  aspectRatio: 0.5,
});
console.log(new TextDecoder().decode(blocks));

// Save ASCII art to file
await Deno.writeFile("output.txt", ascii);
```

## Multi-Frame Images

### Working with Animated GIFs

```ts
import { Image } from "@cross/image";

// Decode all frames from an animated GIF
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

console.log(`Canvas: ${multiFrame.width}x${multiFrame.height}`);
console.log(`Number of frames: ${multiFrame.frames.length}`);

// Access individual frames
for (let i = 0; i < multiFrame.frames.length; i++) {
  const frame = multiFrame.frames[i];
  console.log(`Frame ${i}: ${frame.width}x${frame.height}`);
  console.log(`  Delay: ${frame.frameMetadata?.delay}ms`);
  console.log(`  Disposal: ${frame.frameMetadata?.disposal}`);
}
```

### Creating Multi-Page TIFFs

```ts
import { Image } from "@cross/image";

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

// Encode as multi-page TIFF with LZW compression
const tiffData = await Image.encodeFrames("tiff", multiPageTiff, {
  compression: "lzw",
});
await Deno.writeFile("multipage.tiff", tiffData);

// Decode all pages from a multi-page TIFF
const pages = await Image.decodeFrames(tiffData);
console.log(`Read ${pages.frames.length} pages from TIFF`);
```

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
const image = await Image.decode(customData, "custom");
const output = await image.encode("custom");
```

## Cross-Runtime Examples

### Using with Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "@cross/image";

const data = await readFile("input.png");
const image = await Image.decode(data);
image.resize({ width: 400, height: 300 });
const output = await image.encode("png");
await writeFile("output.png", output);
```

### Using with Bun

```ts
import { Image } from "@cross/image";

const file = Bun.file("input.png");
const data = new Uint8Array(await file.arrayBuffer());
const image = await Image.decode(data);
image.resize({ width: 400, height: 300 });
const output = await image.encode("png");
await Bun.write("output.png", output);
```
