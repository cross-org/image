---
title: API Reference
order: 1
---

# API Reference

## `Image`

The main class for working with images.

### Static Methods

#### `Image.read(data: Uint8Array, format?: string): Promise<Image>`

Read an image from bytes. Automatically detects format if not specified.

```ts
const data = await Deno.readFile("input.png");
const image = await Image.read(data);
```

#### `Image.readFrames(data: Uint8Array, format?: string): Promise<MultiFrameImageData>`

Read all frames from a multi-frame image (animated GIF or multi-page TIFF).

```ts
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.readFrames(gifData);
console.log(`Number of frames: ${multiFrame.frames.length}`);
```

#### `Image.saveFrames(format: string, imageData: MultiFrameImageData, options?: unknown): Promise<Uint8Array>`

Save multi-frame image data to bytes in the specified format.

```ts
const tiffData = await Image.saveFrames("tiff", multiPageTiff, {
  compression: "lzw",
});
```

#### `Image.fromRGBA(width: number, height: number, data: Uint8Array): Image`

Create an image from raw RGBA data.

```ts
const data = new Uint8Array(100 * 100 * 4); // 100x100 red square
for (let i = 0; i < data.length; i += 4) {
  data[i] = 255; // R
  data[i + 3] = 255; // A
}
const image = Image.fromRGBA(100, 100, data);
```

#### `Image.registerFormat(format: ImageFormat): void`

Register a custom format handler.

```ts
Image.registerFormat(new MyCustomFormat());
```

#### `Image.getFormats(): readonly ImageFormat[]`

Get all registered format handlers.

### Instance Properties

#### `width: number` (read-only)

Image width in pixels.

#### `height: number` (read-only)

Image height in pixels.

#### `data: Uint8Array` (read-only)

Raw RGBA pixel data (4 bytes per pixel).

### Instance Methods

#### `resize(options: ResizeOptions): this`

Resize the image. Returns `this` for chaining.

```ts
image.resize({ width: 800, height: 600 });
// or
image.resize({ width: 400, height: 300, method: "nearest" });
```

#### `save(format: string, options?: unknown): Promise<Uint8Array>`

Save to bytes in specified format with optional format-specific options.

```ts
const png = await image.save("png");
const jpeg = await image.save("jpeg", { quality: 90 });
```

#### `clone(): Image`

Create a copy of the image.

```ts
const copy = image.clone();
```

## Types

### `ResizeOptions`

```ts
interface ResizeOptions {
  width: number; // Target width
  height: number; // Target height
  method?: "nearest" | "bilinear"; // Resize algorithm (default: "bilinear")
}
```

### `ASCIIOptions`

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

### `WebPEncodeOptions`

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
- `1-29`: Low quality with very heavy quantization

### `TIFFEncodeOptions`

```ts
interface TIFFEncodeOptions {
  compression?: "none" | "lzw"; // Compression method (default: "none")
}
```

**Compression methods:**

- `none`: Uncompressed TIFF - larger file size, fastest encoding
- `lzw`: LZW compression - smaller file size for most images, lossless

### `ImageData`

```ts
interface ImageData {
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  data: Uint8Array; // Raw RGBA data (4 bytes per pixel)
  metadata?: ImageMetadata; // Optional metadata
}
```

### `MultiFrameImageData`

```ts
interface MultiFrameImageData {
  width: number; // Canvas width in pixels
  height: number; // Canvas height in pixels
  frames: ImageFrame[]; // Array of frames
  metadata?: ImageMetadata; // Optional global metadata
}
```

### `ImageFrame`

```ts
interface ImageFrame {
  width: number; // Frame width in pixels
  height: number; // Frame height in pixels
  data: Uint8Array; // Raw RGBA data (4 bytes per pixel)
  frameMetadata?: FrameMetadata; // Optional frame-specific metadata
}
```

### `FrameMetadata`

```ts
interface FrameMetadata {
  delay?: number; // Frame delay in milliseconds (for animations)
  disposal?: "none" | "background" | "previous"; // Frame disposal method
  left?: number; // X offset of frame within canvas
  top?: number; // Y offset of frame within canvas
}
```

### `ImageFormat`

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

## Examples

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

### Working with Multi-Frame Images

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
}
```

### Extending with Custom Formats

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
