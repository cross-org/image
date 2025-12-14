---
title: "Using Filters"
parent: "Examples"
---

# Using Filters

Practical examples of using filters for blur, sharpening, and noise reduction.

## Basic Filter Usage

### Simple Blur

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Apply fast box blur
image.blur(2);

await Deno.writeFile("blurred.png", await image.encode("png"));
```

### Gaussian Blur

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// High-quality Gaussian blur
image.gaussianBlur(3);

await Deno.writeFile("gaussian.png", await image.encode("png"));
```

### Sharpening

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("soft-photo.jpg");
const image = await Image.decode(data);

// Sharpen the image
image.sharpen(0.6);

await Deno.writeFile("sharp.png", await image.encode("png"));
```

### Median Filter for Noise Removal

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("noisy-photo.jpg");
const image = await Image.decode(data);

// Remove noise with median filter
image.medianFilter(2);

await Deno.writeFile("denoised.png", await image.encode("png"));
```

## Filter Workflows

### Denoise and Sharpen

Clean up noisy images and restore sharpness:

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("noisy-photo.jpg");
const image = await Image.decode(data);

// First remove noise, then restore sharpness
image.medianFilter(1).sharpen(0.6);

await Deno.writeFile("cleaned.png", await image.encode("png"));
```

### Soft Focus Effect

Create dreamy soft focus:

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("portrait.jpg");
const image = await Image.decode(data);

// Blur then sharpen for soft focus
image.gaussianBlur(3).sharpen(0.4);

await Deno.writeFile("soft-focus.png", await image.encode("png"));
```

### Aggressive Smoothing

Multiple blur passes for extreme smoothing:

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Multiple passes for smooth skin effect
image.blur(2).blur(2).blur(2);

await Deno.writeFile("smooth.png", await image.encode("png"));
```

## Portrait Enhancement

### Skin Smoothing

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("portrait.jpg");
const image = await Image.decode(data);

// Denoise, smooth, then restore some detail
image
  .medianFilter(1) // Remove sensor noise
  .gaussianBlur(2) // Smooth skin
  .sharpen(0.3); // Restore facial features

await Deno.writeFile("enhanced-portrait.png", await image.encode("png"));
```

### Professional Portrait

Complete portrait enhancement workflow:

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("portrait.jpg");
const image = await Image.decode(data);

image
  .medianFilter(1) // Clean noise
  .gaussianBlur(1) // Subtle smoothing
  .sharpen(0.4) // Restore detail
  .brightness(0.05) // Slight brighten
  .contrast(0.1) // Add punch
  .saturation(0.15); // Enhance colors

await Deno.writeFile("professional.png", await image.encode("png"));
```

## Landscape Enhancement

### Sharpen Landscapes

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("landscape.jpg");
const image = await Image.decode(data);

// Strong sharpening for landscapes
image
  .gaussianBlur(1) // Slight smooth first
  .sharpen(0.7); // Aggressive sharpen

await Deno.writeFile("sharp-landscape.png", await image.encode("png"));
```

### Enhance Details

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("landscape.jpg");
const image = await Image.decode(data);

image
  .sharpen(0.6)
  .contrast(0.3)
  .saturation(0.4);

await Deno.writeFile("enhanced-landscape.png", await image.encode("png"));
```

## Creative Effects

### Motion Blur Simulation

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("action.jpg");
const image = await Image.decode(data);

// Heavy blur for motion effect
image.blur(10);

await Deno.writeFile("motion-blur.png", await image.encode("png"));
```

### Dreamy Effect

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("romantic.jpg");
const image = await Image.decode(data);

image
  .gaussianBlur(5)
  .brightness(0.15)
  .saturation(0.2);

await Deno.writeFile("dreamy.png", await image.encode("png"));
```

### High Contrast Sharp

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

image
  .sharpen(0.8)
  .contrast(0.4);

await Deno.writeFile("high-contrast.png", await image.encode("png"));
```

## Noise Reduction Examples

### Light Noise Removal

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("slightly-noisy.jpg");
const image = await Image.decode(data);

// Gentle denoising
image.medianFilter(1).sharpen(0.5);

await Deno.writeFile("cleaned-light.png", await image.encode("png"));
```

### Heavy Noise Removal

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("very-noisy.jpg");
const image = await Image.decode(data);

// Aggressive denoising
image
  .medianFilter(3) // Strong denoising
  .gaussianBlur(1) // Additional smoothing
  .sharpen(0.5); // Restore some detail

await Deno.writeFile("cleaned-heavy.png", await image.encode("png"));
```

### JPEG Artifact Reduction

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("compressed.jpg");
const image = await Image.decode(data);

// Reduce compression artifacts
image
  .medianFilter(2)
  .gaussianBlur(1);

await Deno.writeFile("artifact-reduced.png", await image.encode("png"));
```

## Batch Processing

### Sharpen All Photos

```ts
import { Image } from "jsr:@cross/image";

const files = ["photo1.jpg", "photo2.jpg", "photo3.jpg"];

for (const file of files) {
  const data = await Deno.readFile(file);
  const image = await Image.decode(data);

  image.sharpen(0.6);

  const output = file.replace(".jpg", "-sharp.jpg");
  await Deno.writeFile(output, await image.encode("jpeg", { quality: 90 }));

  console.log(`Sharpened ${file}`);
}
```

### Apply Consistent Smoothing

```ts
import { Image } from "jsr:@cross/image";

const files = ["photo1.jpg", "photo2.jpg", "photo3.jpg"];

for (const file of files) {
  const data = await Deno.readFile(file);
  const image = await Image.decode(data);

  // Consistent smoothing workflow
  image.medianFilter(1).gaussianBlur(2).sharpen(0.3);

  const output = file.replace(".jpg", "-smooth.jpg");
  await Deno.writeFile(output, await image.encode("jpeg", { quality: 90 }));

  console.log(`Smoothed ${file}`);
}
```

## Filter Radius Comparison

### Testing Different Blur Radii

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");

const radii = [1, 2, 3, 5, 10];

for (const radius of radii) {
  const image = await Image.decode(data);
  image.gaussianBlur(radius);

  await Deno.writeFile(
    `blur-radius-${radius}.png`,
    await image.encode("png"),
  );

  console.log(`Created blur with radius ${radius}`);
}
```

### Testing Different Sharpen Amounts

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");

const amounts = [0.2, 0.4, 0.6, 0.8, 1.0];

for (const amount of amounts) {
  const image = await Image.decode(data);
  image.sharpen(amount);

  await Deno.writeFile(
    `sharpen-${amount}.png`,
    await image.encode("png"),
  );

  console.log(`Created sharpen with amount ${amount}`);
}
```

## Combining with Color Adjustments

### Filtered Portrait

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("portrait.jpg");
const image = await Image.decode(data);

image
  .medianFilter(1) // Denoise
  .gaussianBlur(2) // Smooth
  .sharpen(0.4) // Detail
  .brightness(0.1) // Brighten
  .saturation(0.2); // Enhance colors

await Deno.writeFile("filtered-portrait.png", await image.encode("png"));
```

### Filtered Landscape

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("landscape.jpg");
const image = await Image.decode(data);

image
  .gaussianBlur(1) // Slight smooth
  .sharpen(0.7) // Strong detail
  .contrast(0.3) // Dramatic
  .saturation(0.4); // Vibrant

await Deno.writeFile("filtered-landscape.png", await image.encode("png"));
```

## Node.js Examples

### Sharpen in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "cross-image";

const data = await readFile("photo.jpg");
const image = await Image.decode(data);

image.sharpen(0.6);

const output = await image.encode("jpeg", { quality: 90 });
await writeFile("sharp.jpg", output);
```

### Denoise in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "cross-image";

const data = await readFile("noisy.jpg");
const image = await Image.decode(data);

image.medianFilter(2).sharpen(0.5);

const output = await image.encode("jpeg", { quality: 90 });
await writeFile("clean.jpg", output);
```

## Bun Examples

### Blur in Bun

```ts
import { Image } from "cross-image";

const file = Bun.file("photo.jpg");
const data = new Uint8Array(await file.arrayBuffer());
const image = await Image.decode(data);

image.gaussianBlur(3);

const output = await image.encode("png");
await Bun.write("blurred.png", output);
```
