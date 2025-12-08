/**
 * Test utilities for format testing
 */

/**
 * Helper to temporarily disable OffscreenCanvas and ImageDecoder APIs
 * to force pure-JS encoder/decoder paths
 */
export function withoutOffscreenCanvas<T>(
  fn: () => T | Promise<T>,
): T | Promise<T> {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  const originalImageDecoder = globalThis.ImageDecoder;
  try {
    (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas =
      undefined;
    (globalThis as unknown as { ImageDecoder?: unknown }).ImageDecoder =
      undefined;
    return fn();
  } finally {
    (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas =
      originalOffscreenCanvas;
    (globalThis as unknown as { ImageDecoder?: unknown }).ImageDecoder =
      originalImageDecoder;
  }
}
