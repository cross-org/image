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

## Border

Add a uniform or custom border around an image.

### Signature

```ts
border(width: number, r?: number, g?: number, b?: number, a?: number): this
borderSides(top: number, right: number, bottom: number, left: number, r?: number, g?: number, b?: number, a?: number): this
```

### Parameters

- `width` - Border width in pixels (all sides) for `border()`
- `top`, `right`, `bottom`, `left` - Border widths per side for `borderSides()`
- `r` - Red component (0-255, default: 0)
- `g` - Green component (0-255, default: 0)
- `b` - Blue component (0-255, default: 0)
- `a` - Alpha component (0-255, default: 255)

### Example

```ts
import { Image } from "@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Add a 10-pixel black border
image.border(10);

// Add a 5-pixel white border
image.border(5, 255, 255, 255);

// Add a 20-pixel semi-transparent blue border
image.border(20, 0, 0, 255, 128);

// Add different borders per side (top=10, right=5, bottom=10, left=5)
image.borderSides(10, 5, 10, 5, 0, 0, 0, 255);

const output = await image.encode("png");
await Deno.writeFile("bordered.png", output);
```

### Use Cases

- Creating framed thumbnails
- Adding spacing around images
- Creating polaroid-style effects
- Preparing images for display with consistent padding
- Adding decorative borders

### Tips

- Border increases image dimensions by `2 * width` (or sum of sides)
- Use transparent borders (a=0) for padding without visible border
- Chain with other operations: `image.border(10).resize(...)`
- Metadata (DPI, physical dimensions) is preserved and updated

## Draw Line

Draw a straight line between two points using Bresenham's algorithm.

### Signature

```ts
drawLine(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a?: number): this
```

### Parameters

- `x0`, `y0` - Starting coordinates
- `x1`, `y1` - Ending coordinates
- `r` - Red component (0-255)
- `g` - Green component (0-255)
- `b` - Blue component (0-255)
- `a` - Alpha component (0-255, default: 255)

### Example

```ts
import { Image } from "@cross/image";

// Create a blank canvas
const canvas = Image.create(400, 400, 255, 255, 255);

// Draw a red horizontal line
canvas.drawLine(50, 200, 350, 200, 255, 0, 0);

// Draw a blue vertical line
canvas.drawLine(200, 50, 200, 350, 0, 0, 255);

// Draw a green diagonal line
canvas.drawLine(50, 50, 350, 350, 0, 255, 0);

// Draw a semi-transparent yellow line
canvas.drawLine(50, 350, 350, 50, 255, 255, 0, 128);

const output = await canvas.encode("png");
await Deno.writeFile("lines.png", output);
```

### Use Cases

- Creating grid overlays
- Drawing coordinate axes
- Adding guidelines or annotations
- Creating geometric patterns
- Technical drawings

### Tips

- Lines are drawn with pixel precision using Bresenham's algorithm
- Coordinates are automatically clipped to image bounds
- Supports any angle (horizontal, vertical, diagonal)
- Can be chained with other operations
- Use alpha channel for semi-transparent lines

## Draw Circle

Draw a circle (outline or filled) at a specified position.

### Signature

```ts
drawCircle(centerX: number, centerY: number, radius: number, r: number, g: number, b: number, a?: number, filled?: boolean): this
```

### Parameters

- `centerX`, `centerY` - Circle center coordinates
- `radius` - Circle radius in pixels
- `r` - Red component (0-255)
- `g` - Green component (0-255)
- `b` - Blue component (0-255)
- `a` - Alpha component (0-255, default: 255)
- `filled` - Whether to fill the circle (default: false, outline only)

### Example

```ts
import { Image } from "@cross/image";

// Create a blank canvas
const canvas = Image.create(400, 400, 255, 255, 255);

// Draw a red circle outline
canvas.drawCircle(100, 100, 50, 255, 0, 0);

// Draw a filled blue circle
canvas.drawCircle(300, 100, 50, 0, 0, 255, 255, true);

// Draw a filled semi-transparent green circle
canvas.drawCircle(200, 300, 75, 0, 255, 0, 128, true);

// Draw multiple concentric circles
for (let r = 10; r <= 100; r += 20) {
  canvas.drawCircle(200, 200, r, 0, 0, 0);
}

const output = await canvas.encode("png");
await Deno.writeFile("circles.png", output);
```

### Use Cases

- Creating dot markers or indicators
- Drawing targets or focus areas
- Creating geometric patterns
- Adding decorative elements
- Highlighting regions of interest

### Tips

- Use `filled: false` for circle outline (default)
- Use `filled: true` for solid filled circle
- Circle is automatically clipped to image bounds
- Outline uses midpoint circle algorithm for efficiency
- Can be chained with other operations

## Drawing Workflow Examples

### Creating a Simple Chart

```ts
const chart = Image.create(400, 300, 255, 255, 255);

// Draw axes
chart.drawLine(50, 250, 350, 250, 0, 0, 0); // X-axis
chart.drawLine(50, 50, 50, 250, 0, 0, 0); // Y-axis

// Plot data points
const data = [100, 150, 120, 200, 180];
for (let i = 0; i < data.length; i++) {
  const x = 80 + i * 60;
  const y = 250 - data[i];
  chart.drawCircle(x, y, 5, 255, 0, 0, 255, true);
}

// Connect points with lines
for (let i = 0; i < data.length - 1; i++) {
  const x0 = 80 + i * 60;
  const y0 = 250 - data[i];
  const x1 = 80 + (i + 1) * 60;
  const y1 = 250 - data[i + 1];
  chart.drawLine(x0, y0, x1, y1, 0, 0, 255);
}

await Deno.writeFile("chart.png", await chart.encode("png"));
```

### Creating a Frame Effect

```ts
const image = await Image.decode(await Deno.readFile("photo.jpg"));

// Add a white border
image.border(20, 255, 255, 255);

// Draw decorative corners
const w = image.width;
const h = image.height;
const len = 30;

// Top-left corner
image.drawLine(0, 0, len, 0, 200, 150, 0, 255);
image.drawLine(0, 0, 0, len, 200, 150, 0, 255);

// Top-right corner
image.drawLine(w - 1, 0, w - len - 1, 0, 200, 150, 0, 255);
image.drawLine(w - 1, 0, w - 1, len, 200, 150, 0, 255);

// Bottom-left corner
image.drawLine(0, h - 1, len, h - 1, 200, 150, 0, 255);
image.drawLine(0, h - 1, 0, h - len - 1, 200, 150, 0, 255);

// Bottom-right corner
image.drawLine(w - 1, h - 1, w - len - 1, h - 1, 200, 150, 0, 255);
image.drawLine(w - 1, h - 1, w - 1, h - len - 1, 200, 150, 0, 255);

await Deno.writeFile("framed.png", await image.encode("png"));
```
