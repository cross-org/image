---
title: "Color Adjustments"
parent: "Image Processing"
---

# Color Adjustments

Color adjustment operations modify pixel colors to achieve effects like brightening, increasing
contrast, adjusting saturation, and converting to grayscale.

## Brightness

Adjust the overall brightness of an image by adding or subtracting from all RGB channels.

### Signature

```ts
brightness(amount: number): this
```

### Parameters

- `amount` - Brightness adjustment from -1 to 1
  - `-1.0` - Maximum darkening (black)
  - `0.0` - No change
  - `1.0` - Maximum brightening (white)

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Brighten by 20%
image.brightness(0.2);

// Darken by 30%
image.brightness(-0.3);

// Subtle brightening
image.brightness(0.1);

const output = await image.encode("png");
await Deno.writeFile("adjusted.png", output);
```

### Use Cases

- Correcting underexposed photos
- Reducing overexposure
- Creating mood effects
- Preparing images for display

### Tips

- Use small increments (0.1-0.2) for natural results
- Combine with contrast for better results
- Extreme values (±0.8+) lose detail

## Contrast

Adjust the difference between light and dark areas by scaling RGB values around midpoint.

### Signature

```ts
contrast(amount: number): this
```

### Parameters

- `amount` - Contrast adjustment from -1 to 1
  - `-1.0` - Minimum contrast (gray)
  - `0.0` - No change
  - `1.0` - Maximum contrast

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Increase contrast by 30%
image.contrast(0.3);

// Decrease contrast (flatten)
image.contrast(-0.2);

// High contrast look
image.contrast(0.5);

const output = await image.encode("png");
await Deno.writeFile("contrast.png", output);
```

### Use Cases

- Enhancing flat images
- Creating dramatic effects
- Improving readability
- Correcting washed-out photos

### Tips

- Positive values increase contrast
- Negative values reduce contrast
- Works well with brightness adjustments

### Common Combinations

```ts
// Punch up a dull photo
image.brightness(0.1).contrast(0.3);

// Flatten for vintage look
image.brightness(-0.1).contrast(-0.2);
```

## Saturation

Adjust color intensity while preserving luminance.

### Signature

```ts
saturation(amount: number): this
```

### Parameters

- `amount` - Saturation adjustment from -1 to 1
  - `-1.0` - Full desaturation (grayscale)
  - `0.0` - No change
  - `1.0` - Maximum saturation

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Boost saturation by 30%
image.saturation(0.3);

// Reduce saturation (faded look)
image.saturation(-0.5);

// Fully desaturate (equivalent to grayscale)
image.saturation(-1.0);

const output = await image.encode("png");
await Deno.writeFile("saturated.png", output);
```

### Use Cases

- Enhancing vibrant scenes
- Creating muted vintage looks
- Correcting oversaturated images
- Preparing for grayscale conversion

### Tips

- Saturation affects only colors, not brightness
- Works in HSL color space internally
- Values near -1 create near-grayscale

## Hue

Rotate the color wheel to shift all hues in the image. This changes the overall color cast while
preserving saturation and luminance relationships.

### Signature

```ts
hue(degrees: number): this
```

### Parameters

- `degrees` - Hue rotation in degrees (can be any value, wraps around at 360)
  - `0` - No change
  - `30` - Shift reds towards orange
  - `60` - Shift reds towards yellow
  - `120` - Shift reds to greens, greens to blues, blues to reds
  - `180` - Full inversion (reds become cyan, greens become magenta, etc.)
  - `-60` - Shift colors backwards (reds towards purple)

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Warm up the image (shift towards yellow/orange)
image.hue(15);

// Cool down the image (shift towards blue/cyan)
image.hue(-15);

// Create a surreal color effect
image.hue(120);

// Make grass look autumn-like
image.hue(30);

const output = await image.encode("png");
await Deno.writeFile("hue-adjusted.png", output);
```

### Use Cases

- Color correction and white balance fixes
- Creative color grading (cinematic looks)
- Seasonal color shifts (autumn, spring effects)
- Adjusting skin tones
- Making skies more blue or sunsets more golden
- Creating stylized or surreal color schemes

### Tips

- Hue rotation works in HSL color space
- Grayscale pixels (no saturation) are unaffected
- Small adjustments (±15°) are ideal for color correction
- Large adjustments (±60° to ±180°) create dramatic effects
- Combine with saturation for complete color control

### Combining with Other Adjustments

```ts
// Professional color grading
image
  .hue(10) // Warm tones
  .saturation(0.2) // Boost colors
  .contrast(0.1) // Add depth
  .brightness(0.05); // Slight lift

// Create vintage look
image
  .hue(-10) // Cool shift
  .saturation(-0.3) // Desaturate
  .contrast(-0.1); // Soften

// Enhance landscape
image
  .hue(5) // Warmer greens
  .saturation(0.3) // Vibrant colors
  .contrast(0.15); // Crisp details
```

## Exposure

Photographic exposure adjustment simulating camera exposure compensation. Applies exponential
scaling to mimic real exposure.

### Signature

```ts
exposure(amount: number): this
```

### Parameters

- `amount` - Exposure adjustment in stops from -3 to 3
  - `-3.0` - Darken by 3 stops (1/8 intensity)
  - `0.0` - No change
  - `1.0` - Brighten by 1 stop (2× intensity)
  - `3.0` - Brighten by 3 stops (8× intensity)

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Increase exposure by 1 stop
image.exposure(1.0);

// Decrease exposure by 1.5 stops
image.exposure(-1.5);

// Subtle exposure boost
image.exposure(0.5);

const output = await image.encode("png");
await Deno.writeFile("exposed.png", output);
```

### Use Cases

- Simulating camera exposure compensation
- HDR-style adjustments
- Correcting exposure errors
- Creating high-key/low-key effects

### Exposure vs. Brightness

- **Exposure**: Exponential scaling (photographic, preserves ratios)
- **Brightness**: Linear addition (simple, uniform change)

```ts
// Photographic exposure adjustment
image.exposure(1.0); // Doubles intensity

// Simple brightness adjustment
image.brightness(0.5); // Adds 50% to each channel
```

## Grayscale

Convert image to grayscale using luminance-preserving formula.

### Signature

```ts
grayscale(): this
```

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Convert to grayscale
image.grayscale();

const output = await image.encode("png");
await Deno.writeFile("grayscale.png", output);
```

### Use Cases

- Black and white photography
- Preparing images for printing
- Reducing file size
- Creating dramatic effects

### Implementation

Uses perceptually weighted formula (ITU-R BT.601 standard):

```
L = 0.299R + 0.587G + 0.114B
```

This preserves perceived brightness better than simple averaging. Note that modern displays may use
different coefficients (like ITU-R BT.709), but this standard provides good results for general use.

### Alternatives

```ts
// Grayscale via saturation
image.saturation(-1.0); // Same visual result

// Grayscale preserving exposure
image.grayscale().exposure(0.2);
```

## Invert

Invert all RGB color channels (negative effect).

### Signature

```ts
invert(): this
```

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Create negative
image.invert();

const output = await image.encode("png");
await Deno.writeFile("inverted.png", output);
```

### Use Cases

- Creating negatives
- Artistic effects
- Improving readability (dark mode)
- Special visual effects

### Note

Alpha channel is preserved (not inverted).

## Sepia

Apply warm sepia tone for vintage photograph effect.

### Signature

```ts
sepia(): this
```

### Example

```ts
import { Image } from "jsr:@cross/image";

const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Apply sepia tone
image.sepia();

const output = await image.encode("png");
await Deno.writeFile("sepia.png", output);
```

### Use Cases

- Vintage photograph effects
- Warm nostalgic look
- Artistic portraits
- Historical photo simulation

### Implementation

Applies classic sepia transformation matrix:

```
R' = 0.393R + 0.769G + 0.189B
G' = 0.349R + 0.686G + 0.168B
B' = 0.272R + 0.534G + 0.131B
```

### Variations

```ts
// Subtle sepia with reduced saturation
image.sepia().saturation(-0.3);

// Aged photo look
image.sepia().brightness(-0.1).contrast(0.2);
```

## Complex Color Workflows

Combine adjustments for professional results:

### Portrait Enhancement

```ts
const image = await Image.decode(data);

image
  .brightness(0.05) // Slight brighten
  .contrast(0.1) // Subtle contrast
  .saturation(0.15); // Boost colors

await Deno.writeFile("portrait.png", await image.encode("png"));
```

### Landscape Enhancement

```ts
const image = await Image.decode(data);

image
  .exposure(0.3) // Brighten highlights
  .contrast(0.3) // Dramatic contrast
  .saturation(0.4); // Vibrant colors

await Deno.writeFile("landscape.png", await image.encode("png"));
```

### Vintage Film Look

```ts
const image = await Image.decode(data);

image
  .brightness(-0.05) // Slightly darker
  .contrast(-0.1) // Reduced contrast
  .saturation(-0.3) // Muted colors
  .sepia(); // Warm tone

await Deno.writeFile("vintage.png", await image.encode("png"));
```

### High-Key Portrait

```ts
const image = await Image.decode(data);

image
  .exposure(0.5) // Bright exposure
  .contrast(-0.2) // Soft contrast
  .saturation(-0.1); // Subtle colors

await Deno.writeFile("highkey.png", await image.encode("png"));
```

### Low-Key Drama

```ts
const image = await Image.decode(data);

image
  .exposure(-0.5) // Dark exposure
  .contrast(0.5) // Strong contrast
  .saturation(0.2); // Rich colors

await Deno.writeFile("lowkey.png", await image.encode("png"));
```

### Black and White with Contrast

```ts
const image = await Image.decode(data);

image
  .grayscale()
  .contrast(0.3) // Strong contrast
  .brightness(0.1); // Slight lift

await Deno.writeFile("bw.png", await image.encode("png"));
```

## Color Space Notes

All color adjustments work in RGB color space. For saturation, the library temporarily converts to
HSL, adjusts, and converts back to RGB.

## CMYK Color Space Conversion

Convert between RGB and CMYK (Cyan, Magenta, Yellow, Key/Black) color spaces for professional
printing and color manipulation workflows.

### Converting Individual Colors

```ts
import { cmykToRgb, rgbToCmyk } from "jsr:@cross/image";

// Convert RGB to CMYK
const [c, m, y, k] = rgbToCmyk(255, 0, 0); // Red
console.log({ c, m, y, k }); // { c: 0, m: 1, y: 1, k: 0 }

// Convert CMYK back to RGB
const [r, g, b] = cmykToRgb(c, m, y, k);
console.log({ r, g, b }); // { r: 255, g: 0, b: 0 }
```

### Converting Full Images

```ts
import { Image } from "jsr:@cross/image";

// Load an image
const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Convert to CMYK representation
const cmykData = image.toCMYK(); // Float32Array with 4 values per pixel

// Create image from CMYK data
const restored = Image.fromCMYK(cmykData, image.width, image.height);

await Deno.writeFile("output.png", await restored.encode("png"));
```

### Batch Array Conversion

```ts
import { cmykToRgba, rgbaToCmyk } from "jsr:@cross/image";

// Convert entire RGBA buffer to CMYK
const rgbaData = new Uint8Array([255, 0, 0, 255]); // Red pixel
const cmykData = rgbaToCmyk(rgbaData); // Float32Array

// Convert CMYK buffer back to RGBA
const rgbaRestored = cmykToRgba(cmykData); // Uint8Array
```

### Use Cases

- **Pre-press workflows** - Prepare images for professional printing
- **Color separation** - Generate CMYK plates for printing presses
- **Print simulation** - Preview how images will appear in CMYK gamut
- **Color analysis** - Analyze color composition in print color space
- **Educational tools** - Teach color theory and printing concepts

### CMYK Color Space Details

CMYK is a subtractive color model used in printing:

- **C (Cyan)**: Absorbs red light (0-1)
- **M (Magenta)**: Absorbs green light (0-1)
- **Y (Yellow)**: Absorbs blue light (0-1)
- **K (Key/Black)**: Adds depth and saves ink (0-1)

### Conversion Formulas

**RGB to CMYK:**

```
K = 1 - max(R, G, B)
C = (1 - R - K) / (1 - K)
M = (1 - G - K) / (1 - K)
Y = (1 - B - K) / (1 - K)
```

**CMYK to RGB:**

```
R = 255 × (1 - C) × (1 - K)
G = 255 × (1 - M) × (1 - K)
B = 255 × (1 - Y) × (1 - K)
```

### Notes

- CMYK has a smaller color gamut than RGB
- Round-trip conversion (RGB → CMYK → RGB) preserves colors within CMYK gamut
- Black (K) calculation uses the maximum RGB component
- Pure black in RGB (0,0,0) converts to K=1, C=M=Y=0

### Performance

All color adjustments are fast operations that process pixels in a single pass. Order doesn't
significantly affect performance.
