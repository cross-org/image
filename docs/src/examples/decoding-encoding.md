---
title: "Decoding & Encoding"
parent: "Examples"
---

# Decoding & Encoding Examples

This page demonstrates format-specific decoding and encoding operations.

## Basic Decode and Encode

### Auto-Detection

The library automatically detects image formats:

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data); // Format auto-detected
console.log(`Loaded ${image.width}x${image.height} image`);
```

### Format Hints

You can provide a format hint for ambiguous cases:

```ts
const image = await Image.decode(data, "png");
```

## Format-Specific Examples

### PNG

PNG supports full RGBA with lossless compression.

```ts
import { Image } from "@cross/image";

// Decode PNG
const pngData = await Deno.readFile("input.png");
const image = await Image.decode(pngData);

// Encode as PNG (default options)
const output = await image.encode("png");
await Deno.writeFile("output.png", output);
```

### JPEG

JPEG is best for photographs. Quality setting controls file size vs. image
quality.

```ts
import { Image } from "@cross/image";

// Decode JPEG
const jpegData = await Deno.readFile("photo.jpg");
const image = await Image.decode(jpegData);

// Encode with high quality (larger file)
const highQuality = await image.encode("jpeg", { quality: 95 });
await Deno.writeFile("high-quality.jpg", highQuality);

// Encode with medium quality (smaller file)
const mediumQuality = await image.encode("jpeg", { quality: 80 });
await Deno.writeFile("medium-quality.jpg", mediumQuality);

// Encode with low quality (much smaller)
const lowQuality = await image.encode("jpeg", { quality: 60 });
await Deno.writeFile("low-quality.jpg", lowQuality);
```

### WebP

WebP supports both lossless and lossy compression.

#### Lossless WebP

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as lossless WebP (quality = 100)
const lossless = await image.encode("webp", { quality: 100 });
await Deno.writeFile("output-lossless.webp", lossless);

// Or force lossless mode explicitly
const forcedLossless = await image.encode("webp", {
  quality: 90,
  lossless: true,
});
await Deno.writeFile("output-forced.webp", forcedLossless);
```

#### Lossy WebP

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// High quality lossy WebP
const highQuality = await image.encode("webp", { quality: 90 });
await Deno.writeFile("high.webp", highQuality);

// Medium quality lossy WebP (good balance)
const mediumQuality = await image.encode("webp", { quality: 75 });
await Deno.writeFile("medium.webp", mediumQuality);

// Low quality lossy WebP (smallest file)
const lowQuality = await image.encode("webp", { quality: 60 });
await Deno.writeFile("low.webp", lowQuality);
```

### TIFF

TIFF supports various compression methods.

#### Uncompressed TIFF

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as uncompressed TIFF (larger file)
const uncompressed = await image.encode("tiff");
await Deno.writeFile("output.tiff", uncompressed);
```

#### LZW Compressed TIFF

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode with LZW compression (smaller file)
const compressed = await image.encode("tiff", { compression: "lzw" });
await Deno.writeFile("output-lzw.tiff", compressed);
```

### GIF

GIF is limited to 256 colors but supports animation.

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as GIF (colors automatically quantized to 256)
const gif = await image.encode("gif");
await Deno.writeFile("output.gif", gif);
```

### BMP

BMP is an uncompressed format commonly used on Windows.

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as BMP
const bmp = await image.encode("bmp");
await Deno.writeFile("output.bmp", bmp);
```

### ASCII Art

Convert images to text-based ASCII art.

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Simple ASCII characters
const simple = await image.encode("ascii", {
  width: 80,
  charset: "simple",
});
console.log(new TextDecoder().decode(simple));

// Block characters for better gradients
const blocks = await image.encode("ascii", {
  width: 60,
  charset: "blocks",
  aspectRatio: 0.5, // Compensate for character aspect ratio
});
console.log(new TextDecoder().decode(blocks));

// Extended ASCII for more detail
const extended = await image.encode("ascii", {
  width: 100,
  charset: "extended",
});

// Save to file
await Deno.writeFile("output.txt", extended);
```

### DNG (Digital Negative)

Linear DNG format for uncompressed RGBA data.

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as linear DNG
const dng = await image.encode("dng");
await Deno.writeFile("output.dng", dng);
```

### PAM (Portable Arbitrary Map)

Netpbm PAM format.

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as PAM
const pam = await image.encode("pam");
await Deno.writeFile("output.pam", pam);
```

### PPM (Portable PixMap)

Netpbm PPM format (P3 ASCII or P6 binary).

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as PPM (binary P6 format)
const ppm = await image.encode("ppm");
await Deno.writeFile("output.ppm", ppm);
```

### PCX

ZSoft PCX format with RLE compression.

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Encode as PCX
const pcx = await image.encode("pcx");
await Deno.writeFile("output.pcx", pcx);
```

## Format Conversion Examples

### PNG to JPEG

```ts
import { Image } from "@cross/image";

const pngData = await Deno.readFile("input.png");
const image = await Image.decode(pngData);

const jpegData = await image.encode("jpeg", { quality: 90 });
await Deno.writeFile("output.jpg", jpegData);
```

### JPEG to WebP

```ts
import { Image } from "@cross/image";

const jpegData = await Deno.readFile("photo.jpg");
const image = await Image.decode(jpegData);

// Convert to WebP with quality setting
const webpData = await image.encode("webp", { quality: 85 });
await Deno.writeFile("photo.webp", webpData);
```

### Any Format to PNG

```ts
import { Image } from "@cross/image";

// Works with any supported input format
const data = await Deno.readFile("input.webp");
const image = await Image.decode(data);

const pngData = await image.encode("png");
await Deno.writeFile("output.png", pngData);
```

## Batch Conversion

### Convert Multiple Images

```ts
import { Image } from "@cross/image";

const inputFiles = ["photo1.jpg", "photo2.jpg", "photo3.jpg"];

for (const inputFile of inputFiles) {
  const data = await Deno.readFile(inputFile);
  const image = await Image.decode(data);

  // Convert to WebP
  const webp = await image.encode("webp", { quality: 85 });
  const outputFile = inputFile.replace(".jpg", ".webp");
  await Deno.writeFile(outputFile, webp);

  console.log(`Converted ${inputFile} -> ${outputFile}`);
}
```

### Create Multiple Sizes

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("original.jpg");

const sizes = [
  { width: 1920, height: 1080, name: "large" },
  { width: 1280, height: 720, name: "medium" },
  { width: 640, height: 360, name: "small" },
  { width: 320, height: 180, name: "thumb" },
];

for (const size of sizes) {
  const image = await Image.decode(data);
  image.resize({ width: size.width, height: size.height });

  const output = await image.encode("jpeg", { quality: 85 });
  await Deno.writeFile(`${size.name}.jpg`, output);

  console.log(`Created ${size.name}: ${size.width}x${size.height}`);
}
```

## Node.js Examples

### PNG to JPEG in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "@cross/image";

const pngData = await readFile("input.png");
const image = await Image.decode(pngData);

const jpegData = await image.encode("jpeg", { quality: 90 });
await writeFile("output.jpg", jpegData);
```

### WebP Conversion in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "@cross/image";

const jpegData = await readFile("photo.jpg");
const image = await Image.decode(jpegData);

const webpData = await image.encode("webp", { quality: 85 });
await writeFile("photo.webp", webpData);
```

## Bun Examples

### Format Conversion in Bun

```ts
import { Image } from "@cross/image";

const input = Bun.file("input.png");
const data = new Uint8Array(await input.arrayBuffer());
const image = await Image.decode(data);

const output = await image.encode("jpeg", { quality: 90 });
await Bun.write("output.jpg", output);
```
