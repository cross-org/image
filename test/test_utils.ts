/**
 * Test utilities for format testing
 */

/**
 * Cross-runtime file reading helper
 * Works with Deno, Node.js, and Bun
 */
export async function readFile(path: string): Promise<Uint8Array> {
  if (typeof Deno !== "undefined") {
    // Deno runtime
    return await Deno.readFile(path);
  } else {
    // Node.js/Bun runtime
    const fs = await import("fs/promises");
    const buffer = await fs.readFile(path);
    return new Uint8Array(buffer);
  }
}

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
