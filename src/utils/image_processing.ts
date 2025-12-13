/**
 * Image processing utilities for common operations like compositing,
 * level adjustments, and color manipulations.
 */

import { clamp, clampRgb } from "./byte_utils.ts";

/**
 * Composite one image on top of another at a specified position
 * @param base Base image data (RGBA)
 * @param baseWidth Base image width
 * @param baseHeight Base image height
 * @param overlay Overlay image data (RGBA)
 * @param overlayWidth Overlay image width
 * @param overlayHeight Overlay image height
 * @param x X position to place overlay (can be negative)
 * @param y Y position to place overlay (can be negative)
 * @param opacity Opacity of overlay (0-1, default: 1)
 * @returns New image data with overlay composited on base
 */
export function composite(
  base: Uint8Array,
  baseWidth: number,
  baseHeight: number,
  overlay: Uint8Array,
  overlayWidth: number,
  overlayHeight: number,
  x: number,
  y: number,
  opacity = 1,
): Uint8Array {
  const result = new Uint8Array(base);

  // Clamp opacity to valid range
  const finalOpacity = clamp(opacity, 0, 1);

  // Calculate the region to composite
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(baseWidth, x + overlayWidth);
  const endY = Math.min(baseHeight, y + overlayHeight);

  // Iterate over the overlapping region
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      // Calculate indices
      const baseIdx = (py * baseWidth + px) * 4;
      const overlayX = px - x;
      const overlayY = py - y;
      const overlayIdx = (overlayY * overlayWidth + overlayX) * 4;

      // Get overlay pixel with opacity
      const overlayR = overlay[overlayIdx];
      const overlayG = overlay[overlayIdx + 1];
      const overlayB = overlay[overlayIdx + 2];
      const overlayA = (overlay[overlayIdx + 3] / 255) * finalOpacity;

      // Get base pixel
      const baseR = result[baseIdx];
      const baseG = result[baseIdx + 1];
      const baseB = result[baseIdx + 2];
      const baseA = result[baseIdx + 3] / 255;

      // Alpha compositing using "over" operation
      const outA = overlayA + baseA * (1 - overlayA);

      if (outA > 0) {
        result[baseIdx] = Math.round(
          (overlayR * overlayA + baseR * baseA * (1 - overlayA)) / outA,
        );
        result[baseIdx + 1] = Math.round(
          (overlayG * overlayA + baseG * baseA * (1 - overlayA)) / outA,
        );
        result[baseIdx + 2] = Math.round(
          (overlayB * overlayA + baseB * baseA * (1 - overlayA)) / outA,
        );
        result[baseIdx + 3] = Math.round(outA * 255);
      }
    }
  }

  return result;
}

/**
 * Adjust brightness of an image
 * @param data Image data (RGBA)
 * @param amount Brightness adjustment (-1 to 1, where 0 is no change)
 * @returns New image data with adjusted brightness
 */
export function adjustBrightness(
  data: Uint8Array,
  amount: number,
): Uint8Array {
  const result = new Uint8Array(data.length);
  const adjust = clamp(amount, -1, 1) * 255;

  for (let i = 0; i < data.length; i += 4) {
    result[i] = clampRgb(data[i] + adjust); // R
    result[i + 1] = clampRgb(data[i + 1] + adjust); // G
    result[i + 2] = clampRgb(data[i + 2] + adjust); // B
    result[i + 3] = data[i + 3]; // A
  }

  return result;
}

/**
 * Adjust contrast of an image
 * @param data Image data (RGBA)
 * @param amount Contrast adjustment (-1 to 1, where 0 is no change)
 * @returns New image data with adjusted contrast
 */
export function adjustContrast(data: Uint8Array, amount: number): Uint8Array {
  const result = new Uint8Array(data.length);
  const contrast = clamp(amount, -1, 1);
  const factor = (259 * (contrast * 255 + 255)) /
    (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    result[i] = clampRgb(factor * (data[i] - 128) + 128); // R
    result[i + 1] = clampRgb(factor * (data[i + 1] - 128) + 128); // G
    result[i + 2] = clampRgb(factor * (data[i + 2] - 128) + 128); // B
    result[i + 3] = data[i + 3]; // A
  }

  return result;
}

/**
 * Adjust exposure of an image
 * @param data Image data (RGBA)
 * @param amount Exposure adjustment in stops (-3 to 3, where 0 is no change)
 * @returns New image data with adjusted exposure
 */
export function adjustExposure(data: Uint8Array, amount: number): Uint8Array {
  const result = new Uint8Array(data.length);
  const stops = clamp(amount, -3, 3);
  const multiplier = Math.pow(2, stops);

  for (let i = 0; i < data.length; i += 4) {
    result[i] = clampRgb(data[i] * multiplier); // R
    result[i + 1] = clampRgb(data[i + 1] * multiplier); // G
    result[i + 2] = clampRgb(data[i + 2] * multiplier); // B
    result[i + 3] = data[i + 3]; // A
  }

  return result;
}

/**
 * Adjust saturation of an image
 * @param data Image data (RGBA)
 * @param amount Saturation adjustment (-1 to 1, where 0 is no change)
 * @returns New image data with adjusted saturation
 */
export function adjustSaturation(
  data: Uint8Array,
  amount: number,
): Uint8Array {
  const result = new Uint8Array(data.length);
  const sat = clamp(amount, -1, 1) + 1; // Convert to 0-2 range

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calculate grayscale value using luminosity method
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Interpolate between gray and original color based on saturation
    result[i] = clampRgb(gray + (r - gray) * sat);
    result[i + 1] = clampRgb(gray + (g - gray) * sat);
    result[i + 2] = clampRgb(gray + (b - gray) * sat);
    result[i + 3] = data[i + 3];
  }

  return result;
}

/**
 * Convert RGB to HSL color space
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns HSL values: [h (0-360), s (0-1), l (0-1)]
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }
  }

  return [h * 360, s, l];
}

/**
 * Convert HSL to RGB color space
 * @param h Hue (0-360)
 * @param s Saturation (0-1)
 * @param l Lightness (0-1)
 * @returns RGB values: [r (0-255), g (0-255), b (0-255)]
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // Achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Adjust hue of an image by rotating the hue wheel
 * @param data Image data (RGBA)
 * @param degrees Hue rotation in degrees (any value accepted, wraps at 360)
 * @returns New image data with adjusted hue
 */
export function adjustHue(data: Uint8Array, degrees: number): Uint8Array {
  const result = new Uint8Array(data.length);
  // Normalize rotation to -180 to 180 range
  const rotation = ((degrees % 360) + 360) % 360;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Convert to HSL
    const [h, s, l] = rgbToHsl(r, g, b);

    // Rotate hue
    const newH = (h + rotation) % 360;

    // Convert back to RGB
    const [newR, newG, newB] = hslToRgb(newH, s, l);

    result[i] = newR;
    result[i + 1] = newG;
    result[i + 2] = newB;
    result[i + 3] = data[i + 3]; // Preserve alpha
  }

  return result;
}

/**
 * Invert colors of an image
 * @param data Image data (RGBA)
 * @returns New image data with inverted colors
 */
export function invert(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 4) {
    result[i] = 255 - data[i]; // R
    result[i + 1] = 255 - data[i + 1]; // G
    result[i + 2] = 255 - data[i + 2]; // B
    result[i + 3] = data[i + 3]; // A
  }

  return result;
}

/**
 * Convert image to grayscale
 * @param data Image data (RGBA)
 * @returns New image data in grayscale
 */
export function grayscale(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 4) {
    // Using luminosity method for grayscale conversion
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    result[i] = gray; // R
    result[i + 1] = gray; // G
    result[i + 2] = gray; // B
    result[i + 3] = data[i + 3]; // A
  }

  return result;
}

/**
 * Fill a rectangular region with a color
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @param x Starting X position
 * @param y Starting Y position
 * @param fillWidth Width of the fill region
 * @param fillHeight Height of the fill region
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @param a Alpha component (0-255)
 * @returns Modified image data
 */
export function fillRect(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  fillWidth: number,
  fillHeight: number,
  r: number,
  g: number,
  b: number,
  a: number,
): Uint8Array {
  const result = new Uint8Array(data);

  // Calculate bounds
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(width, x + fillWidth);
  const endY = Math.min(height, y + fillHeight);

  // Fill the region
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const idx = (py * width + px) * 4;
      result[idx] = r;
      result[idx + 1] = g;
      result[idx + 2] = b;
      result[idx + 3] = a;
    }
  }

  return result;
}

/**
 * Crop an image to a rectangular region
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @param x Starting X position
 * @param y Starting Y position
 * @param cropWidth Width of the crop region
 * @param cropHeight Height of the crop region
 * @returns Cropped image data and dimensions
 */
export function crop(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  cropWidth: number,
  cropHeight: number,
): { data: Uint8Array; width: number; height: number } {
  // Clamp crop region to image bounds
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(width, x + cropWidth);
  const endY = Math.min(height, y + cropHeight);

  const actualWidth = endX - startX;
  const actualHeight = endY - startY;

  const result = new Uint8Array(actualWidth * actualHeight * 4);

  for (let py = 0; py < actualHeight; py++) {
    for (let px = 0; px < actualWidth; px++) {
      const srcIdx = ((startY + py) * width + (startX + px)) * 4;
      const dstIdx = (py * actualWidth + px) * 4;

      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return { data: result, width: actualWidth, height: actualHeight };
}

/**
 * Apply a box blur filter to an image
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @param radius Blur radius (default: 1)
 * @returns New image data with box blur applied
 */
export function boxBlur(
  data: Uint8Array,
  width: number,
  height: number,
  radius = 1,
): Uint8Array {
  const result = new Uint8Array(data.length);
  const clampedRadius = Math.max(1, Math.floor(radius));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let count = 0;

      // Iterate over kernel
      for (let ky = -clampedRadius; ky <= clampedRadius; ky++) {
        for (let kx = -clampedRadius; kx <= clampedRadius; kx++) {
          const px = x + kx;
          const py = y + ky;

          // Check bounds
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            a += data[idx + 3];
            count++;
          }
        }
      }

      const outIdx = (y * width + x) * 4;
      result[outIdx] = Math.round(r / count);
      result[outIdx + 1] = Math.round(g / count);
      result[outIdx + 2] = Math.round(b / count);
      result[outIdx + 3] = Math.round(a / count);
    }
  }

  return result;
}

/**
 * Generate a Gaussian kernel for blur
 * @param radius Kernel radius
 * @param sigma Standard deviation (if not provided, calculated from radius)
 * @returns Gaussian kernel as 1D array
 */
function generateGaussianKernel(radius: number, sigma?: number): number[] {
  const size = radius * 2 + 1;
  const kernel: number[] = new Array(size);
  const s = sigma ?? radius / 3;
  const s2 = 2 * s * s;
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / s2);
    sum += kernel[i];
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Apply Gaussian blur to an image
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @param radius Blur radius (default: 1)
 * @param sigma Optional standard deviation (if not provided, calculated from radius)
 * @returns New image data with Gaussian blur applied
 */
export function gaussianBlur(
  data: Uint8Array,
  width: number,
  height: number,
  radius = 1,
  sigma?: number,
): Uint8Array {
  const clampedRadius = Math.max(1, Math.floor(radius));
  const kernel = generateGaussianKernel(clampedRadius, sigma);

  // Apply horizontal pass
  const temp = new Uint8Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let kx = -clampedRadius; kx <= clampedRadius; kx++) {
        const px = clamp(x + kx, 0, width - 1);
        const idx = (y * width + px) * 4;
        const weight = kernel[kx + clampedRadius];

        r += data[idx] * weight;
        g += data[idx + 1] * weight;
        b += data[idx + 2] * weight;
        a += data[idx + 3] * weight;
      }

      const outIdx = (y * width + x) * 4;
      temp[outIdx] = Math.round(r);
      temp[outIdx + 1] = Math.round(g);
      temp[outIdx + 2] = Math.round(b);
      temp[outIdx + 3] = Math.round(a);
    }
  }

  // Apply vertical pass
  const result = new Uint8Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let ky = -clampedRadius; ky <= clampedRadius; ky++) {
        const py = clamp(y + ky, 0, height - 1);
        const idx = (py * width + x) * 4;
        const weight = kernel[ky + clampedRadius];

        r += temp[idx] * weight;
        g += temp[idx + 1] * weight;
        b += temp[idx + 2] * weight;
        a += temp[idx + 3] * weight;
      }

      const outIdx = (y * width + x) * 4;
      result[outIdx] = Math.round(r);
      result[outIdx + 1] = Math.round(g);
      result[outIdx + 2] = Math.round(b);
      result[outIdx + 3] = Math.round(a);
    }
  }

  return result;
}

/**
 * Apply sharpen filter to an image
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @param amount Sharpening amount (0-1, default: 0.5)
 * @returns New image data with sharpening applied
 */
export function sharpen(
  data: Uint8Array,
  width: number,
  height: number,
  amount = 0.5,
): Uint8Array {
  const result = new Uint8Array(data.length);
  const clampedAmount = clamp(amount, 0, 1);

  // Sharpen kernel (Laplacian-based)
  // Center weight is 1 + 4*amount, neighbors are -amount
  const center = 1 + 4 * clampedAmount;
  const neighbor = -clampedAmount;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      let r = data[idx] * center;
      let g = data[idx + 1] * center;
      let b = data[idx + 2] * center;

      // Apply kernel to neighbors (4-connected)
      const neighbors = [
        { dx: 0, dy: -1 }, // top
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: 0 }, // right
        { dx: 0, dy: 1 }, // bottom
      ];

      for (const { dx, dy } of neighbors) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 4;
          r += data[nIdx] * neighbor;
          g += data[nIdx + 1] * neighbor;
          b += data[nIdx + 2] * neighbor;
        }
      }

      result[idx] = clampRgb(Math.round(r));
      result[idx + 1] = clampRgb(Math.round(g));
      result[idx + 2] = clampRgb(Math.round(b));
      result[idx + 3] = data[idx + 3]; // Alpha unchanged
    }
  }

  return result;
}

/**
 * Apply sepia tone effect to an image
 * @param data Image data (RGBA)
 * @returns New image data with sepia tone applied
 */
export function sepia(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Sepia transformation matrix
    result[i] = Math.min(255, Math.round(r * 0.393 + g * 0.769 + b * 0.189));
    result[i + 1] = Math.min(
      255,
      Math.round(r * 0.349 + g * 0.686 + b * 0.168),
    );
    result[i + 2] = Math.min(
      255,
      Math.round(r * 0.272 + g * 0.534 + b * 0.131),
    );
    result[i + 3] = data[i + 3]; // Alpha unchanged
  }

  return result;
}

/**
 * Apply median filter to reduce noise
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @param radius Filter radius (default: 1)
 * @returns New image data with median filter applied
 */
export function medianFilter(
  data: Uint8Array,
  width: number,
  height: number,
  radius = 1,
): Uint8Array {
  const result = new Uint8Array(data.length);
  const clampedRadius = Math.max(1, Math.floor(radius));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rValues: number[] = [];
      const gValues: number[] = [];
      const bValues: number[] = [];
      const aValues: number[] = [];

      // Collect values in kernel window
      for (let ky = -clampedRadius; ky <= clampedRadius; ky++) {
        for (let kx = -clampedRadius; kx <= clampedRadius; kx++) {
          const px = x + kx;
          const py = y + ky;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            rValues.push(data[idx]);
            gValues.push(data[idx + 1]);
            bValues.push(data[idx + 2]);
            aValues.push(data[idx + 3]);
          }
        }
      }

      // Sort and get median
      rValues.sort((a, b) => a - b);
      gValues.sort((a, b) => a - b);
      bValues.sort((a, b) => a - b);
      aValues.sort((a, b) => a - b);

      const mid = Math.floor(rValues.length / 2);
      const outIdx = (y * width + x) * 4;

      result[outIdx] = rValues[mid];
      result[outIdx + 1] = gValues[mid];
      result[outIdx + 2] = bValues[mid];
      result[outIdx + 3] = aValues[mid];
    }
  }

  return result;
}

/**
 * Rotate image 90 degrees clockwise
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @returns Rotated image data with swapped dimensions
 */
export function rotate90(
  data: Uint8Array,
  width: number,
  height: number,
): { data: Uint8Array; width: number; height: number } {
  const result = new Uint8Array(data.length);
  const newWidth = height;
  const newHeight = width;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstX = height - 1 - y;
      const dstY = x;
      const dstIdx = (dstY * newWidth + dstX) * 4;

      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return { data: result, width: newWidth, height: newHeight };
}

/**
 * Rotate image 180 degrees
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @returns Rotated image data with same dimensions
 */
export function rotate180(
  data: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstX = width - 1 - x;
      const dstY = height - 1 - y;
      const dstIdx = (dstY * width + dstX) * 4;

      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return result;
}

/**
 * Rotate image 270 degrees clockwise (or 90 degrees counter-clockwise)
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @returns Rotated image data with swapped dimensions
 */
export function rotate270(
  data: Uint8Array,
  width: number,
  height: number,
): { data: Uint8Array; width: number; height: number } {
  const result = new Uint8Array(data.length);
  const newWidth = height;
  const newHeight = width;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstX = y;
      const dstY = width - 1 - x;
      const dstIdx = (dstY * newWidth + dstX) * 4;

      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return { data: result, width: newWidth, height: newHeight };
}

/**
 * Flip image horizontally (mirror)
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @returns Flipped image data
 */
export function flipHorizontal(
  data: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstX = width - 1 - x;
      const dstIdx = (y * width + dstX) * 4;

      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return result;
}

/**
 * Flip image vertically
 * @param data Image data (RGBA)
 * @param width Image width
 * @param height Image height
 * @returns Flipped image data
 */
export function flipVertical(
  data: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstY = height - 1 - y;
      const dstIdx = (dstY * width + x) * 4;

      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return result;
}
