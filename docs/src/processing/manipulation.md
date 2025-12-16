---
title: "Manipulation"
parent: "Image Processing"
---

# Image Manipulation

Image manipulation operations transform the geometry and structure of images, including resizing,
cropping, layering, and drawing.

## Resize

Scale an image to new dimensions with interpolation methods to maintain quality.

### Signature

```ts
resize(options: ResizeOptions): this

interface ResizeOptions {
  width: number;
  height: number;
  method?: "bilinear" | "nearest" | "bicubic";
  fit?: "stretch" | "fit" | "fill" | "cover" | "contain";
}
```

### Parameters

- `width` - Target width in pixels
- `height` - Target height in pixels
- `method` - Interpolation method (default: "bilinear")
  - `"bilinear"` - Smooth, high-quality scaling (default)
  - `"nearest"` - Fast, pixelated scaling (faster)
  - `"bicubic"` - Highest quality cubic interpolation (slowest)
- `fit` - Fitting mode (default: "stretch")
  - `"stretch"` - Stretch image to fill dimensions (may distort)
  - `"fit"` / `"contain"` - Fit within dimensions maintaining aspect ratio (letterbox)
  - `"fill"` / `"cover"` - Fill dimensions maintaining aspect ratio (crop)

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// High-quality resize (default)
image.resize({ width: 800, height: 600 });

// Best quality cubic interpolation
image.resize({ width: 800, height: 600, method: "bicubic" });

// Fast pixelated resize
image.resize({ width: 400, height: 300, method: "nearest" });

// Fit within dimensions (maintain aspect ratio with letterboxing)
image.resize({ width: 800, height: 600, fit: "fit" });

// Fill dimensions (maintain aspect ratio, crop if needed)
image.resize({ width: 800, height: 600, fit: "cover" });

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

With the `fit` parameter, you can easily maintain aspect ratio:

```ts
const image = await Image.decode(data);

// Fit within 800x600 maintaining aspect ratio (letterbox if needed)
image.resize({ width: 800, height: 600, fit: "fit" });

// Fill 800x600 maintaining aspect ratio (crop if needed)
image.resize({ width: 800, height: 600, fit: "cover" });
```

Or calculate dimensions manually for exact control:

```ts
const image = await Image.decode(data);
const aspectRatio = image.width / image.height;

// Resize to width, maintain aspect ratio
const targetWidth = 800;
const targetHeight = Math.round(targetWidth / aspectRatio);
image.resize({ width: targetWidth, height: targetHeight });
```

### Performance

- Bilinear interpolation: Good quality, moderate speed (default)
- Bicubic interpolation: Best quality, slowest
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
import { Image } from "jsr:@cross/image";

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
import { Image } from "jsr:@cross/image";

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
import { Image } from "jsr:@cross/image";

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

## Rotation and Flipping

Rotate and flip images for orientation correction and creative effects.

### Rotate by Degrees

Rotate an image by a specified angle in degrees (rounded to nearest 90°).

#### Signature

```ts
rotate(degrees: number): this
```

#### Parameters

- `degrees` - Rotation angle in degrees (positive = clockwise, negative = counter-clockwise)

#### Example

```ts
import { Image } from "jsr:@cross/image";

const image = await Image.decode(await Deno.readFile("photo.jpg"));

// Rotate 90° clockwise
image.rotate(90);

// Rotate 90° counter-clockwise
image.rotate(-90);

// Rotate 180°
image.rotate(180);

// Rotations are rounded to nearest 90°
image.rotate(45); // Rounds to 0° (nearest)
image.rotate(135); // Rounds to 180°

await Deno.writeFile("rotated.jpg", await image.encode("jpeg"));
```

### Rotate 90° Increments

For precise control, use specific rotation methods.

#### Signature

```ts
rotate90(): this   // 90° clockwise
rotate180(): this  // 180°
rotate270(): this  // 270° clockwise (90° counter-clockwise)
```

#### Example

```ts
const image = await Image.decode(await Deno.readFile("photo.jpg"));

// Precise rotation
image.rotate90(); // 90° clockwise
// image.rotate180();  // 180°
// image.rotate270();  // 270° clockwise

await Deno.writeFile("rotated.jpg", await image.encode("jpeg"));
```

### Flip Horizontal/Vertical

Mirror or flip images.

#### Signature

```ts
flipHorizontal(): this  // Mirror left-right
flipVertical(): this    // Flip top-bottom
```

#### Example

```ts
const image = await Image.decode(await Deno.readFile("photo.jpg"));

// Create mirror effect
image.flipHorizontal();

// Or flip upside down
// image.flipVertical();

await Deno.writeFile("flipped.jpg", await image.encode("jpeg"));
```

### Use Cases

- **Orientation correction** - Fix images from cameras with incorrect orientation
- **EXIF orientation** - Apply orientation metadata to pixel data
- **Creative effects** - Kaleidoscope patterns, reflections
- **Mirroring** - Create symmetrical designs
- **Upside-down text** - Artistic effects

### Performance

- All rotation and flip operations are optimized for speed
- Dimensions swap for 90° and 270° rotations
- Dimensions remain the same for 180° rotations and flips
- No quality loss (pixel-perfect transformations)

### Combining Operations

```ts
const image = await Image.decode(await Deno.readFile("photo.jpg"));

// Rotate and flip for complex transformations
image.rotate90().flipHorizontal();

// EXIF orientation correction example
// Note: Always check metadata exists before accessing orientation
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
