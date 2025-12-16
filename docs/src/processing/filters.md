---
title: "Filters"
parent: "Image Processing"
---

# Filters

Filters are image processing operations that modify pixel values based on their neighbors to achieve
effects like blurring, sharpening, and noise reduction.

## Blur

Fast box blur for smoothing images. Uses a simple averaging algorithm.

### Signature

```ts
blur(radius?: number): this
```

### Parameters

- `radius` - Blur radius in pixels (default: 1). Larger values create stronger blur

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Subtle blur
image.blur(1);

// Stronger blur
image.blur(5);

const output = await image.encode("png");
await Deno.writeFile("blurred.png", output);
```

### Use Cases

- Quick background blur
- Noise reduction
- Soft focus effects

### Performance

Box blur is fast but produces square-ish artifacts at high radii. For higher-quality blur, use
`gaussianBlur()`.

## Gaussian Blur

High-quality blur with smooth falloff. More computationally expensive than box blur but produces
superior results.

### Signature

```ts
gaussianBlur(radius?: number, sigma?: number): this
```

### Parameters

- `radius` - Blur radius in pixels (default: 1)
- `sigma` - Standard deviation for Gaussian distribution (optional). If omitted, calculated as
  `radius / 3` (captures ~99.7% of the Gaussian distribution)

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Gaussian blur with automatic sigma
image.gaussianBlur(3);

// Gaussian blur with custom sigma for tighter control
image.gaussianBlur(5, 2.0);

// Strong blur
image.gaussianBlur(10);

const output = await image.encode("png");
await Deno.writeFile("gaussian-blur.png", output);
```

### Use Cases

- Professional background blur
- Depth of field simulation
- High-quality smoothing
- Bokeh effects

### Performance

Gaussian blur is slower than box blur, especially at large radii. Processing time increases with
radius squared.

## Median Filter

Non-linear filter that replaces each pixel with the median value of its neighbors. Excellent for
removing "salt and pepper" noise while preserving edges.

### Signature

```ts
medianFilter(radius?: number): this
```

### Parameters

- `radius` - Filter radius in pixels (default: 1). Creates a `(2*radius+1) × (2*radius+1)` window

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("noisy-photo.jpg");
const image = await Image.decode(data);

// Light denoising
image.medianFilter(1);

// Stronger denoising
image.medianFilter(2);

// Aggressive denoising (may soften edges)
image.medianFilter(3);

const output = await image.encode("png");
await Deno.writeFile("denoised.png", output);
```

### Use Cases

- Removing sensor noise
- Cleaning up compression artifacts
- Salt and pepper noise removal
- Edge-preserving smoothing

### Performance

Median filter is computationally expensive, especially at large radii. Each pixel requires sorting
`(2*radius+1)²` values. Use the smallest radius that achieves your goal.

## Sharpen

Enhance image details and edges by accentuating differences between adjacent pixels.

### Signature

```ts
sharpen(amount?: number): this
```

### Parameters

- `amount` - Sharpening strength from 0 to 1 (default: 0.5)
  - `0.0` - No effect
  - `0.5` - Moderate sharpening
  - `1.0` - Maximum sharpening

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("soft-photo.jpg");
const image = await Image.decode(data);

// Subtle sharpening
image.sharpen(0.3);

// Standard sharpening
image.sharpen(0.5);

// Aggressive sharpening
image.sharpen(0.8);

const output = await image.encode("png");
await Deno.writeFile("sharp.png", output);
```

### Use Cases

- Enhancing details in soft images
- Correcting slight blur
- Improving perceived sharpness
- Making text more readable

### Performance

Sharpen is a fast operation based on unsharp mask principles.

### Tips

- Don't over-sharpen - values above 0.7 often create halos
- Sharpen after resizing to restore detail
- Combine with subtle blur for creative effects

## Combining Filters

Filters can be chained together for complex effects:

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Denoise then sharpen workflow
image.medianFilter(1).sharpen(0.6);

// Blur and sharpen for soft focus effect
image.gaussianBlur(3).sharpen(0.4);

// Multiple blur passes for extreme smoothing
image.blur(2).blur(2).blur(2);

const output = await image.encode("png");
await Deno.writeFile("filtered.png", output);
```

### Recommended Combinations

**Portrait Enhancement**

```ts
image
  .medianFilter(1) // Remove sensor noise
  .gaussianBlur(2) // Soft skin
  .sharpen(0.3); // Restore detail
```

**Landscape Enhancement**

```ts
image
  .gaussianBlur(1) // Slight smoothing
  .sharpen(0.7); // Strong details
```

**Noise Reduction**

```ts
image
  .medianFilter(2) // Remove noise
  .gaussianBlur(1) // Smooth
  .sharpen(0.5); // Restore some detail
```
