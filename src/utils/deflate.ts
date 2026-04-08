/**
 * Cross-runtime deflate / inflate helpers.
 *
 * Uses the standard Web Streams `CompressionStream` / `DecompressionStream` APIs
 * everywhere, **except** in Bun where we fall back to synchronous `node:zlib`.
 *
 * Bun workaround: `CompressionStream` / `DecompressionStream` hang indefinitely
 * in certain Bun versions (observed in CI with Bun ≥ 1.2). Using `node:zlib`
 * `deflateSync` / `inflateSync` avoids the stream pipeline entirely.
 */

// deno-lint-ignore no-explicit-any
const isBun = typeof (globalThis as any).Bun !== "undefined";

/** Minimal subset of the `node:zlib` module used by the Bun fallback. */
type NodeZlib = {
  deflateSync(buf: Uint8Array): Uint8Array;
  inflateSync(buf: Uint8Array): Uint8Array;
};

let _zlib: NodeZlib | null | undefined;

async function getBunZlib(): Promise<NodeZlib | null> {
  if (!isBun) return null;
  if (_zlib !== undefined) return _zlib;
  try {
    const m = await import("node:zlib");
    _zlib = m as unknown as NodeZlib;
  } catch {
    _zlib = null;
  }
  return _zlib;
}

/**
 * Compress data with the "deflate" algorithm.
 * Falls back to synchronous `node:zlib` in Bun to work around CompressionStream hangs.
 */
export async function deflateData(data: Uint8Array): Promise<Uint8Array> {
  const zlib = await getBunZlib();
  if (zlib) {
    const result = zlib.deflateSync(data);
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  }
  const stream = new Response(data as unknown as BodyInit).body!
    .pipeThrough(new CompressionStream("deflate"));
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

/**
 * Decompress "deflate"-compressed data.
 * Falls back to synchronous `node:zlib` in Bun to work around DecompressionStream hangs.
 */
export async function inflateData(data: Uint8Array): Promise<Uint8Array> {
  const zlib = await getBunZlib();
  if (zlib) {
    const result = zlib.inflateSync(data);
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  }
  const stream = new Response(data as unknown as BodyInit).body!
    .pipeThrough(new DecompressionStream("deflate"));
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
}
