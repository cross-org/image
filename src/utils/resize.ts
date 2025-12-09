/**
 * Bilinear interpolation resize
 */
export function resizeBilinear(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8Array {
  const dst = new Uint8Array(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      const x1 = Math.floor(srcX);
      const y1 = Math.floor(srcY);
      const x2 = Math.min(x1 + 1, srcWidth - 1);
      const y2 = Math.min(y1 + 1, srcHeight - 1);
      const dx = srcX - x1;
      const dy = srcY - y1;

      for (let c = 0; c < 4; c++) {
        const p1 = src[(y1 * srcWidth + x1) * 4 + c];
        const p2 = src[(y1 * srcWidth + x2) * 4 + c];
        const p3 = src[(y2 * srcWidth + x1) * 4 + c];
        const p4 = src[(y2 * srcWidth + x2) * 4 + c];

        const v1 = p1 * (1 - dx) + p2 * dx;
        const v2 = p3 * (1 - dx) + p4 * dx;
        const v = v1 * (1 - dy) + v2 * dy;

        dst[(y * dstWidth + x) * 4 + c] = Math.round(v);
      }
    }
  }

  return dst;
}

/**
 * Nearest neighbor resize
 */
export function resizeNearest(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8Array {
  const dst = new Uint8Array(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * srcWidth + srcX) * 4;
      const dstIdx = (y * dstWidth + x) * 4;

      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return dst;
}

/**
 * Cubic interpolation kernel (Catmull-Rom)
 *
 * The Catmull-Rom spline provides smooth interpolation through control points.
 * It's a special case of the cubic Hermite spline with specific tangent values.
 *
 * @param x Distance from the sample point
 * @returns Weight for the sample at distance x
 */
function cubicKernel(x: number): number {
  const absX = Math.abs(x);
  if (absX <= 1) {
    return 1.5 * absX * absX * absX - 2.5 * absX * absX + 1;
  } else if (absX < 2) {
    return -0.5 * absX * absX * absX + 2.5 * absX * absX - 4 * absX + 2;
  }
  return 0;
}

/**
 * Get pixel value with bounds checking
 *
 * Clamps coordinates to valid image bounds to prevent out-of-bounds access.
 * This ensures that edge pixels are repeated when sampling outside the image.
 *
 * @param src Source image data
 * @param x X coordinate (may be outside bounds)
 * @param y Y coordinate (may be outside bounds)
 * @param width Image width
 * @param height Image height
 * @param channel Channel index (0=R, 1=G, 2=B, 3=A)
 * @returns Pixel value at the clamped coordinates
 */
function getPixel(
  src: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  channel: number,
): number {
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  return src[(clampedY * width + clampedX) * 4 + channel];
}

/**
 * Bicubic interpolation resize (Catmull-Rom)
 */
export function resizeBicubic(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8Array {
  const dst = new Uint8Array(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const dx = srcX - x0;
      const dy = srcY - y0;

      // Process each channel separately
      for (let c = 0; c < 4; c++) {
        let value = 0;

        // Sample 4x4 neighborhood
        for (let j = -1; j <= 2; j++) {
          for (let i = -1; i <= 2; i++) {
            const px = x0 + i;
            const py = y0 + j;
            const pixelValue = getPixel(src, px, py, srcWidth, srcHeight, c);
            const weight = cubicKernel(i - dx) * cubicKernel(j - dy);
            value += pixelValue * weight;
          }
        }

        // Clamp to valid range
        const dstIdx = (y * dstWidth + x) * 4 + c;
        dst[dstIdx] = Math.max(0, Math.min(255, Math.round(value)));
      }
    }
  }

  return dst;
}
