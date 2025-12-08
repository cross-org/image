/**
 * Image processing utilities for common operations like compositing,
 * level adjustments, and color manipulations.
 */

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
  const finalOpacity = Math.max(0, Math.min(1, opacity));

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
  const adjust = Math.max(-1, Math.min(1, amount)) * 255;

  for (let i = 0; i < data.length; i += 4) {
    result[i] = Math.max(0, Math.min(255, data[i] + adjust)); // R
    result[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjust)); // G
    result[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjust)); // B
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
  const contrast = Math.max(-1, Math.min(1, amount));
  const factor = (259 * (contrast * 255 + 255)) /
    (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    result[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128)); // R
    result[i + 1] = Math.max(
      0,
      Math.min(255, factor * (data[i + 1] - 128) + 128),
    ); // G
    result[i + 2] = Math.max(
      0,
      Math.min(255, factor * (data[i + 2] - 128) + 128),
    ); // B
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
  const stops = Math.max(-3, Math.min(3, amount));
  const multiplier = Math.pow(2, stops);

  for (let i = 0; i < data.length; i += 4) {
    result[i] = Math.max(0, Math.min(255, data[i] * multiplier)); // R
    result[i + 1] = Math.max(0, Math.min(255, data[i + 1] * multiplier)); // G
    result[i + 2] = Math.max(0, Math.min(255, data[i + 2] * multiplier)); // B
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
  const sat = Math.max(-1, Math.min(1, amount)) + 1; // Convert to 0-2 range

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calculate grayscale value using luminosity method
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Interpolate between gray and original color based on saturation
    result[i] = Math.max(0, Math.min(255, gray + (r - gray) * sat));
    result[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * sat));
    result[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * sat));
    result[i + 3] = data[i + 3];
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
