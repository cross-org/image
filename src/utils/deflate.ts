/**
 * Cross-runtime deflate / inflate helpers.
 *
 * Strategy:
 *   1. Try `node:zlib` (synchronous, available in Node.js, Bun, and Deno ≥ 1.28).
 *      This avoids the `CompressionStream` hang observed in certain Bun CI versions.
 *   2. Fall back to the Web Streams `CompressionStream` / `DecompressionStream` APIs
 *      when `node:zlib` is not available (e.g. browser environments).
 *
 * The availability check is performed once and the result is cached.
 */

/** Minimal subset of the `node:zlib` module that we rely on. */
type NodeZlib = {
  deflateSync(buf: Uint8Array): Uint8Array;
  inflateSync(buf: Uint8Array): Uint8Array;
};

// undefined = not yet probed, null = unavailable (browser / restricted environment)
let _zlib: NodeZlib | null | undefined;

async function getZlib(): Promise<NodeZlib | null> {
  if (_zlib !== undefined) return _zlib;
  try {
    const m = await import("node:zlib");
    // `node:zlib` functions return `Buffer` which extends `Uint8Array`, so the
    // cast is safe at runtime.
    _zlib = m as unknown as NodeZlib;
  } catch {
    _zlib = null;
  }
  return _zlib;
}

/** Collect all chunks from a ReadableStream into a single Uint8Array (browser fallback). */
async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Compress data with the "deflate" algorithm.
 * Uses `node:zlib` on Node / Bun / Deno; falls back to `CompressionStream` in browsers.
 */
export async function deflateData(data: Uint8Array): Promise<Uint8Array> {
  const zlib = await getZlib();
  if (zlib) {
    const result = zlib.deflateSync(data);
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  }
  return readStream(
    new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }).pipeThrough(new CompressionStream("deflate")),
  );
}

/**
 * Decompress "deflate"-compressed data.
 * Uses `node:zlib` on Node / Bun / Deno; falls back to `DecompressionStream` in browsers.
 */
export async function inflateData(data: Uint8Array): Promise<Uint8Array> {
  const zlib = await getZlib();
  if (zlib) {
    const result = zlib.inflateSync(data);
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  }
  return readStream(
    new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }).pipeThrough(new DecompressionStream("deflate")),
  );
}
