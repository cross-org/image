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
