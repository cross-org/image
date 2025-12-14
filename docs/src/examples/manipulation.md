---
title: "Manipulation"
parent: "Examples"
---

# Image Manipulation Examples

Practical examples of resizing, cropping, compositing, and drawing operations.

## Resizing Examples

### Basic Resize

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Resize to exact dimensions
image.resize({ width: 800, height: 600 });

await Deno.writeFile("resized.png", await image.encode("png"));
```

### Maintain Aspect Ratio

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Easy way: Use fit mode to maintain aspect ratio
image.resize({ width: 800, height: 600, fit: "fit" });

await Deno.writeFile("fitted.png", await image.encode("png"));
```

### Maintain Aspect Ratio (Manual Calculation)

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

const aspectRatio = image.width / image.height;

// Resize to width, calculate height
const targetWidth = 800;
const targetHeight = Math.round(targetWidth / aspectRatio);
image.resize({ width: targetWidth, height: targetHeight });

await Deno.writeFile("aspect-ratio.png", await image.encode("png"));
```

### Cover Mode (Fill with Crop)

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

// Fill dimensions maintaining aspect ratio (center crop if needed)
image.resize({ width: 800, height: 600, fit: "cover" });

await Deno.writeFile("covered.png", await image.encode("png"));
```

### High-Quality Resize (Bicubic)

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Use bicubic interpolation for best quality
image.resize({ width: 800, height: 600, method: "bicubic" });

await Deno.writeFile("high-quality.jpg", await image.encode("jpeg"));
```

### Create Thumbnails

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Small thumbnail
image.resize({ width: 150, height: 150 });

await Deno.writeFile("thumb.jpg", await image.encode("jpeg", { quality: 85 }));
```

### Pixel Art Scaling

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("sprite.png");
const image = await Image.decode(data);

// Use nearest neighbor for sharp pixel art
image.resize({ width: 320, height: 240, method: "nearest" });

await Deno.writeFile("scaled-sprite.png", await image.encode("png"));
```

### Responsive Image Sizes

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("original.jpg");

const sizes = [
  { name: "large", width: 1920 },
  { name: "medium", width: 1280 },
  { name: "small", width: 640 },
  { name: "thumb", width: 320 },
];

for (const size of sizes) {
  const image = await Image.decode(data);
  const aspectRatio = image.width / image.height;
  const height = Math.round(size.width / aspectRatio);

  image.resize({ width: size.width, height });

  await Deno.writeFile(
    `${size.name}.jpg`,
    await image.encode("jpeg", { quality: 85 }),
  );

  console.log(`Created ${size.name}: ${size.width}x${height}`);
}
```

## Cropping Examples

### Center Crop to Square

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Crop to center square
const size = Math.min(image.width, image.height);
const x = (image.width - size) / 2;
const y = (image.height - size) / 2;
image.crop(x, y, size, size);

await Deno.writeFile("square.png", await image.encode("png"));
```

### Extract Region

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Extract top-left 400x400 region
image.crop(0, 0, 400, 400);

await Deno.writeFile("region.png", await image.encode("png"));
```

### Crop and Resize

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// First crop to center square
const size = Math.min(image.width, image.height);
image.crop(
  (image.width - size) / 2,
  (image.height - size) / 2,
  size,
  size,
);

// Then resize to final dimensions
image.resize({ width: 512, height: 512 });

await Deno.writeFile("cropped-resized.png", await image.encode("png"));
```

### Remove Borders

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("bordered.jpg");
const image = await Image.decode(data);

// Remove 20px border on all sides
const border = 20;
image.crop(
  border,
  border,
  image.width - border * 2,
  image.height - border * 2,
);

await Deno.writeFile("no-border.png", await image.encode("png"));
```

## Compositing Examples

### Add Watermark

```ts
import { Image } from "jsr:@cross/image";

// Load base image
const photoData = await Deno.readFile("photo.jpg");
const photo = await Image.decode(photoData);

// Load watermark
const watermarkData = await Deno.readFile("watermark.png");
const watermark = await Image.decode(watermarkData);

// Place in bottom-right corner with padding
const padding = 20;
photo.composite(
  watermark,
  photo.width - watermark.width - padding,
  photo.height - watermark.height - padding,
  0.7, // 70% opacity
);

await Deno.writeFile("watermarked.jpg", await photo.encode("jpeg"));
```

### Picture-in-Picture

```ts
import { Image } from "jsr:@cross/image";

const mainData = await Deno.readFile("main.jpg");
const main = await Image.decode(mainData);

const pipData = await Deno.readFile("pip.jpg");
const pip = await Image.decode(pipData);

// Resize PIP to 25% of main
pip.resize({
  width: Math.round(main.width * 0.25),
  height: Math.round(main.height * 0.25),
});

// Position in bottom-right
const padding = 20;
main.composite(
  pip,
  main.width - pip.width - padding,
  main.height - pip.height - padding,
  0.9,
);

await Deno.writeFile("pip-result.jpg", await main.encode("jpeg"));
```

### Layer Multiple Images

```ts
import { Image } from "jsr:@cross/image";

// Create canvas
const canvas = Image.create(1920, 1080, 255, 255, 255);

// Load and composite layers
const layer1Data = await Deno.readFile("background.jpg");
const layer1 = await Image.decode(layer1Data);
canvas.composite(layer1, 0, 0);

const layer2Data = await Deno.readFile("middle.png");
const layer2 = await Image.decode(layer2Data);
canvas.composite(layer2, 100, 100, 0.8);

const layer3Data = await Deno.readFile("top.png");
const layer3 = await Image.decode(layer3Data);
canvas.composite(layer3, 200, 200, 0.9);

await Deno.writeFile("layered.png", await canvas.encode("png"));
```

### Centered Logo

```ts
import { Image } from "jsr:@cross/image";

const bgData = await Deno.readFile("background.jpg");
const bg = await Image.decode(bgData);

const logoData = await Deno.readFile("logo.png");
const logo = await Image.decode(logoData);

// Center the logo
const x = (bg.width - logo.width) / 2;
const y = (bg.height - logo.height) / 2;
bg.composite(logo, x, y);

await Deno.writeFile("centered-logo.png", await bg.encode("png"));
```

## Drawing Examples

### Draw Rectangles

```ts
import { Image } from "jsr:@cross/image";

// Create white canvas
const canvas = Image.create(800, 600, 255, 255, 255);

// Draw solid red rectangle
canvas.fillRect(100, 100, 200, 150, 255, 0, 0);

// Draw semi-transparent blue rectangle
canvas.fillRect(250, 200, 300, 200, 0, 0, 255, 128);

await Deno.writeFile("rectangles.png", await canvas.encode("png"));
```

### Create Border

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Create bordered canvas
const borderWidth = 20;
const bordered = Image.create(
  image.width + borderWidth * 2,
  image.height + borderWidth * 2,
  0,
  0,
  0, // Black border
);

// Composite image in center
bordered.composite(image, borderWidth, borderWidth);

await Deno.writeFile("bordered.png", await bordered.encode("png"));
```

### Color Blocks

```ts
import { Image } from "jsr:@cross/image";

const canvas = Image.create(600, 400, 255, 255, 255);

// Draw color grid
const colors = [
  [255, 0, 0], // Red
  [0, 255, 0], // Green
  [0, 0, 255], // Blue
  [255, 255, 0], // Yellow
];

for (let i = 0; i < colors.length; i++) {
  const [r, g, b] = colors[i];
  canvas.fillRect(i * 150, 100, 150, 200, r, g, b);
}

await Deno.writeFile("color-blocks.png", await canvas.encode("png"));
```

### Semi-Transparent Overlay

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Add semi-transparent black overlay
image.fillRect(0, 0, image.width, image.height, 0, 0, 0, 100);

await Deno.writeFile("darkened.png", await image.encode("png"));
```

## Complex Examples

### Thumbnail with Border

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Resize to thumbnail
image.resize({ width: 200, height: 200 });

// Create bordered canvas
const border = 5;
const bordered = Image.create(
  image.width + border * 2,
  image.height + border * 2,
  255,
  255,
  255,
);

// Composite thumbnail in center
bordered.composite(image, border, border);

await Deno.writeFile("thumb-bordered.png", await bordered.encode("png"));
```

### Photo Collage

```ts
import { Image } from "jsr:@cross/image";

// Create canvas
const canvas = Image.create(1200, 800, 240, 240, 240);

// Load photos
const photo1 = await Image.decode(await Deno.readFile("photo1.jpg"));
const photo2 = await Image.decode(await Deno.readFile("photo2.jpg"));
const photo3 = await Image.decode(await Deno.readFile("photo3.jpg"));

// Resize all to same size
const size = { width: 380, height: 380 };
photo1.resize(size);
photo2.resize(size);
photo3.resize(size);

// Position in grid with spacing
const spacing = 20;
canvas.composite(photo1, spacing, spacing);
canvas.composite(photo2, spacing * 2 + 380, spacing);
canvas.composite(photo3, spacing * 3 + 760, spacing);

await Deno.writeFile("collage.png", await canvas.encode("png"));
```

### Profile Picture Generator

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("face.jpg");
const image = await Image.decode(data);

// Center crop to square
const size = Math.min(image.width, image.height);
image.crop(
  (image.width - size) / 2,
  (image.height - size) / 2,
  size,
  size,
);

// Resize to profile size
image.resize({ width: 256, height: 256 });

// Add subtle border
const border = 2;
const bordered = Image.create(260, 260, 255, 255, 255);
bordered.composite(image, border, border);

await Deno.writeFile("profile.png", await bordered.encode("png"));
```

## Batch Processing

### Batch Resize

```ts
import { Image } from "jsr:@cross/image";

const files = ["photo1.jpg", "photo2.jpg", "photo3.jpg"];

for (const file of files) {
  const data = await Deno.readFile(file);
  const image = await Image.decode(data);

  image.resize({ width: 800, height: 600 });

  const output = file.replace(".jpg", "-resized.jpg");
  await Deno.writeFile(output, await image.encode("jpeg", { quality: 85 }));

  console.log(`Resized ${file}`);
}
```

### Batch Watermark

```ts
import { Image } from "jsr:@cross/image";

const watermarkData = await Deno.readFile("watermark.png");
const watermark = await Image.decode(watermarkData);

const files = ["photo1.jpg", "photo2.jpg", "photo3.jpg"];

for (const file of files) {
  const data = await Deno.readFile(file);
  const image = await Image.decode(data);

  const padding = 20;
  image.composite(
    watermark,
    image.width - watermark.width - padding,
    image.height - watermark.height - padding,
    0.7,
  );

  const output = file.replace(".jpg", "-watermarked.jpg");
  await Deno.writeFile(output, await image.encode("jpeg", { quality: 90 }));

  console.log(`Watermarked ${file}`);
}
```

## Rotation and Flipping

### Rotate Image

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Rotate 90 degrees clockwise
image.rotate(90);

await Deno.writeFile("rotated.jpg", await image.encode("jpeg"));
```

### Flip Image

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Create horizontal mirror
image.flipHorizontal();

await Deno.writeFile("flipped.jpg", await image.encode("jpeg"));
```

### EXIF Orientation Correction

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Apply EXIF orientation to pixel data
const orientation = image.metadata?.orientation;
if (orientation === 3) {
  image.rotate180();
} else if (orientation === 6) {
  image.rotate90();
} else if (orientation === 8) {
  image.rotate270();
}

await Deno.writeFile("corrected.jpg", await image.encode("jpeg"));
```

### Create Kaleidoscope Effect

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Crop to square
const size = Math.min(image.width, image.height);
image.crop(0, 0, size, size);

// Create quadrants
const half = size / 2;
const tl = image.clone().crop(0, 0, half, half);
const tr = tl.clone().flipHorizontal();
const bl = tl.clone().flipVertical();
const br = tl.clone().flipHorizontal().flipVertical();

// Combine into kaleidoscope on transparent canvas
const canvas = Image.create(size, size, 0, 0, 0, 0);
canvas.composite(tl, 0, 0);
canvas.composite(tr, half, 0);
canvas.composite(bl, 0, half);
canvas.composite(br, half, half);

await Deno.writeFile("kaleidoscope.jpg", await canvas.encode("jpeg"));
```

## Node.js Examples

### Resize in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "cross-image";

const data = await readFile("photo.jpg");
const image = await Image.decode(data);

image.resize({ width: 800, height: 600 });

const output = await image.encode("jpeg", { quality: 85 });
await writeFile("resized.jpg", output);
```

### Composite in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "cross-image";

const baseData = await readFile("base.jpg");
const base = await Image.decode(baseData);

const logoData = await readFile("logo.png");
const logo = await Image.decode(logoData);

base.composite(logo, 50, 50, 0.8);

const output = await base.encode("png");
await writeFile("composited.png", output);
```

## Bun Examples

### Resize in Bun

```ts
import { Image } from "cross-image";

const file = Bun.file("photo.jpg");
const data = new Uint8Array(await file.arrayBuffer());
const image = await Image.decode(data);

image.resize({ width: 800, height: 600 });

const output = await image.encode("jpeg", { quality: 85 });
await Bun.write("resized.jpg", output);
```
