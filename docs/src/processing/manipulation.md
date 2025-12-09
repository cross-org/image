---
title: "Manipulation"
parent: "Image Processing"
---

# Image Manipulation

Image manipulation operations transform the geometry and structure of images,
including resizing, cropping, layering, and drawing.

## Resize

Scale an image to new dimensions with interpolation methods to maintain quality.

### Signature

```ts
resize(options: ResizeOptions): this

interface ResizeOptions {
  width: number;
  height: number;
  method?: "bilinear" | "nearest";
}
```

### Parameters

- `width` - Target width in pixels
- `height` - Target height in pixels
- `method` - Interpolation method (default: "bilinear")
  - `"bilinear"` - Smooth, high-quality scaling (slower)
  - `"nearest"` - Fast, pixelated scaling (faster)

### Example

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// High-quality resize (default)
image.resize({ width: 800, height: 600 });

// Fast pixelated resize
image.resize({ width: 400, height: 300, method: "nearest" });

// Create thumbnail
image.resize({ width: 150, height: 150 });

const output = await image.encode("png");
await Deno.writeFile("resized.png", output);
```

### Use Cases

- Creating thumbnails
- Responsive image generation
- Retina display optimization
- Pixel art scaling

### Aspect Ratio

`resize()` always scales to exact dimensions. To maintain aspect ratio, you must
calculate dimensions yourself:

```ts
const image = await Image.decode(data);
const aspectRatio = image.width / image.height;

// Resize to width, maintain aspect ratio
const targetWidth = 800;
const targetHeight = Math.round(targetWidth / aspectRatio);
image.resize({ width: targetWidth, height: targetHeight });
```

### Performance

- Bilinear interpolation: Good quality, moderate speed
- Nearest neighbor: Lower quality, very fast
- Scaling down is faster than scaling up

## Crop

Extract a rectangular region from an image.

### Signature

```ts
crop(x: number, y: number, width: number, height: number): this
```

### Parameters

- `x` - Starting X coordinate (left edge)
- `y` - Starting Y coordinate (top edge)
- `width` - Width of crop region
- `height` - Height of crop region

### Example

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Crop to center square
const size = Math.min(image.width, image.height);
const x = (image.width - size) / 2;
const y = (image.height - size) / 2;
image.crop(x, y, size, size);

// Extract top-left corner
image.crop(0, 0, 200, 200);

// Extract bottom-right
image.crop(image.width - 300, image.height - 300, 300, 300);

const output = await image.encode("png");
await Deno.writeFile("cropped.png", output);
```

### Use Cases

- Creating square thumbnails
- Removing borders
- Extracting regions of interest
- Preparing for fixed-size layouts

### Tips

- Crop coordinates are in pixels from top-left (0,0)
- For best quality, crop before resizing in your operation chain
- Out of bounds coordinates are clamped automatically

## Composite

Layer one image on top of another with alpha blending and positioning.

### Signature

```ts
composite(overlay: Image, x: number, y: number, opacity?: number): this
```

### Parameters

- `overlay` - Image to composite on top
- `x` - X position for overlay (can be negative)
- `y` - Y position for overlay (can be negative)
- `opacity` - Overlay opacity from 0 to 1 (default: 1)
  - `0.0` - Fully transparent (invisible)
  - `0.5` - Half transparent
  - `1.0` - Fully opaque

### Example

```ts
import { Image } from "@cross/image";

// Load base image
const baseData = await Deno.readFile("background.jpg");
const base = await Image.decode(baseData);

// Load overlay
const logoData = await Deno.readFile("logo.png");
const logo = await Image.decode(logoData);

// Composite at top-left corner
base.composite(logo, 10, 10);

// Composite with 50% opacity
base.composite(logo, 100, 100, 0.5);

// Composite centered
const x = (base.width - logo.width) / 2;
const y = (base.height - logo.height) / 2;
base.composite(logo, x, y, 0.8);

const output = await base.encode("png");
await Deno.writeFile("composited.png", output);
```

### Use Cases

- Adding watermarks
- Creating thumbnails with borders
- Layering multiple images
- Building image compositions
- Picture-in-picture effects

### Alpha Blending

Composite uses proper "over" alpha compositing:

```ts
// Semi-transparent overlay on semi-transparent base
const canvas = Image.create(400, 300, 255, 255, 255, 200);
const overlay = Image.create(200, 150, 255, 0, 0, 150);
canvas.composite(overlay, 50, 50, 0.7);
```

### Tips

- Negative positions partially clip the overlay
- Overlay alpha is multiplied by opacity parameter
- Use PNG format for overlay images with transparency

## Fill Rectangle

Draw solid or semi-transparent rectangles on the image.

### Signature

```ts
fillRect(
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a?: number
): this
```

### Parameters

- `x` - Starting X coordinate
- `y` - Starting Y coordinate
- `width` - Rectangle width
- `height` - Rectangle height
- `r` - Red component (0-255)
- `g` - Green component (0-255)
- `b` - Blue component (0-255)
- `a` - Alpha component (0-255, default: 255)

### Example

```ts
import { Image } from "@cross/image";

// Create white canvas
const canvas = Image.create(800, 600, 255, 255, 255);

// Draw solid red rectangle
canvas.fillRect(100, 100, 200, 150, 255, 0, 0);

// Draw semi-transparent blue rectangle
canvas.fillRect(250, 200, 300, 200, 0, 0, 255, 128);

// Draw black border (4 rectangles)
const borderWidth = 10;
canvas.fillRect(0, 0, canvas.width, borderWidth, 0, 0, 0); // Top
canvas.fillRect(
  0,
  canvas.height - borderWidth,
  canvas.width,
  borderWidth,
  0,
  0,
  0,
); // Bottom
canvas.fillRect(0, 0, borderWidth, canvas.height, 0, 0, 0); // Left
canvas.fillRect(
  canvas.width - borderWidth,
  0,
  borderWidth,
  canvas.height,
  0,
  0,
  0,
); // Right

const output = await canvas.encode("png");
await Deno.writeFile("rectangles.png", output);
```

### Use Cases

- Drawing borders
- Creating color blocks
- Adding overlays
- Redacting content
- Creating patterns

### Alpha Compositing

Rectangles use proper alpha blending with existing pixels:

```ts
// Layer semi-transparent rectangles
canvas.fillRect(100, 100, 200, 200, 255, 0, 0, 100); // Red
canvas.fillRect(150, 150, 200, 200, 0, 0, 255, 100); // Blue
// Overlapping area will be blended
```

## Complex Manipulations

Combine operations for advanced effects:

### Creating Thumbnails with Borders

```ts
const image = await Image.decode(data);

// Resize to thumbnail
image.resize({ width: 200, height: 200 });

// Add white border
const border = 5;
const bordered = Image.create(
  image.width + border * 2,
  image.height + border * 2,
  255,
  255,
  255,
);
bordered.composite(image, border, border);

await Deno.writeFile("thumb.png", await bordered.encode("png"));
```

### Picture-in-Picture

```ts
const main = await Image.decode(await Deno.readFile("main.jpg"));
const pip = await Image.decode(await Deno.readFile("pip.jpg"));

// Resize pip to 25% of main
pip.resize({
  width: Math.round(main.width * 0.25),
  height: Math.round(main.height * 0.25),
});

// Position in bottom-right with padding
const padding = 20;
main.composite(
  pip,
  main.width - pip.width - padding,
  main.height - pip.height - padding,
  0.9,
);

await Deno.writeFile("pip-result.jpg", await main.encode("jpeg"));
```

### Cropping and Resizing Workflow

```ts
const image = await Image.decode(data);

// Center crop to square
const size = Math.min(image.width, image.height);
image.crop(
  (image.width - size) / 2,
  (image.height - size) / 2,
  size,
  size,
);

// Resize to final dimensions
image.resize({ width: 512, height: 512 });

await Deno.writeFile("square.png", await image.encode("png"));
```
