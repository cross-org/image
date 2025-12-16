---
title: "Image Processing"
nav_order: 4
---

# Image Processing

@cross/image provides a comprehensive set of chainable image processing
operations. All methods modify the image in-place and return `this`, allowing
you to chain multiple operations together.

## Processing Categories

### [Filters](filters.md)

Apply various filters to enhance or modify images:

- **Blur** - Fast box blur for smoothing
- **Gaussian Blur** - High-quality blur with configurable sigma
- **Median Filter** - Strong noise reduction
- **Sharpen** - Enhance image details

### [Manipulation](manipulation.md)

Transform and modify image geometry:

- **Resize** - Scale images with bilinear or nearest neighbor interpolation
- **Crop** - Extract rectangular regions
- **Composite** - Layer images with alpha blending
- **Fill Rectangle** - Draw solid or semi-transparent rectangles

### [Color Adjustments](color-adjustments.md)

Adjust colors and tones:

- **Brightness** - Lighten or darken
- **Contrast** - Increase or decrease contrast
- **Saturation** - Adjust color intensity
- **Exposure** - Photographic exposure adjustment
- **Grayscale** - Convert to grayscale
- **Invert** - Invert all colors
- **Sepia** - Apply sepia tone

## Chaining Operations

All processing methods return `this`, allowing elegant method chaining:

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Chain multiple operations
image
  .resize({ width: 1920, height: 1080 })
  .brightness(0.1)
  .contrast(0.2)
  .gaussianBlur(1)
  .sharpen(0.5)
  .saturation(-0.2);

const output = await image.encode("png");
await Deno.writeFile("processed.png", output);
```

## Performance Considerations

- **Order Matters**: Apply resize operations early to process fewer pixels
- **Filter Radius**: Larger radii increase processing time significantly
- **Method Selection**: Nearest neighbor resize is faster but lower quality than
  bilinear

### Optimal Processing Order

```ts
image
  .resize({ width: 800, height: 600 }) // Reduce pixels first
  .brightness(0.1) // Fast color adjustments
  .contrast(0.2)
  .gaussianBlur(2) // Expensive filters last
  .sharpen(0.5);
```
