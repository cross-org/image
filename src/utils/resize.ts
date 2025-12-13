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
  const srcWidthMinus1 = srcWidth - 1;
  const srcHeightMinus1 = srcHeight - 1;

  for (let y = 0; y < dstHeight; y++) {
    const srcY = y * yRatio;
    const y1 = srcY | 0; // Fast floor
    const y2 = y1 < srcHeightMinus1 ? y1 + 1 : srcHeightMinus1;
    const dy = srcY - y1;
    const dyInv = 1 - dy;
    const dstRowOffset = y * dstWidth * 4;

    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * xRatio;
      const x1 = srcX | 0; // Fast floor
      const x2 = x1 < srcWidthMinus1 ? x1 + 1 : srcWidthMinus1;
      const dx = srcX - x1;
      const dxInv = 1 - dx;

      const idx1 = (y1 * srcWidth + x1) * 4;
      const idx2 = (y1 * srcWidth + x2) * 4;
      const idx3 = (y2 * srcWidth + x1) * 4;
      const idx4 = (y2 * srcWidth + x2) * 4;
      const dstIdx = dstRowOffset + x * 4;

      // Unroll channel loop for better performance
      const p1_r = src[idx1];
      const p2_r = src[idx2];
      const p3_r = src[idx3];
      const p4_r = src[idx4];
      const v1_r = p1_r * dxInv + p2_r * dx;
      const v2_r = p3_r * dxInv + p4_r * dx;
      dst[dstIdx] = (v1_r * dyInv + v2_r * dy + 0.5) | 0;

      const p1_g = src[idx1 + 1];
      const p2_g = src[idx2 + 1];
      const p3_g = src[idx3 + 1];
      const p4_g = src[idx4 + 1];
      const v1_g = p1_g * dxInv + p2_g * dx;
      const v2_g = p3_g * dxInv + p4_g * dx;
      dst[dstIdx + 1] = (v1_g * dyInv + v2_g * dy + 0.5) | 0;

      const p1_b = src[idx1 + 2];
      const p2_b = src[idx2 + 2];
      const p3_b = src[idx3 + 2];
      const p4_b = src[idx4 + 2];
      const v1_b = p1_b * dxInv + p2_b * dx;
      const v2_b = p3_b * dxInv + p4_b * dx;
      dst[dstIdx + 2] = (v1_b * dyInv + v2_b * dy + 0.5) | 0;

      const p1_a = src[idx1 + 3];
      const p2_a = src[idx2 + 3];
      const p3_a = src[idx3 + 3];
      const p4_a = src[idx4 + 3];
      const v1_a = p1_a * dxInv + p2_a * dx;
      const v2_a = p3_a * dxInv + p4_a * dx;
      dst[dstIdx + 3] = (v1_a * dyInv + v2_a * dy + 0.5) | 0;
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
    const srcY = (y * yRatio) | 0; // Use bitwise OR for fast floor
    const srcRowOffset = srcY * srcWidth;
    const dstRowOffset = y * dstWidth;

    for (let x = 0; x < dstWidth; x++) {
      const srcX = (x * xRatio) | 0; // Use bitwise OR for fast floor
      const srcIdx = (srcRowOffset + srcX) * 4;
      const dstIdx = (dstRowOffset + x) * 4;

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
