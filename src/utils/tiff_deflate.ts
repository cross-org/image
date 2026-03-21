/**
 * Deflate compression/decompression for TIFF
 * Compression code: 8 (Adobe-style Deflate)
 */

/**
 * Compress data using Deflate
 * @param data Uncompressed data
 * @returns Compressed data
 */
export async function deflateCompress(data: Uint8Array): Promise<Uint8Array> {
  // Bun's CompressionStream("deflate") hangs; use node:zlib as fallback
  // deno-lint-ignore no-explicit-any
  if (typeof (globalThis as any).Bun !== "undefined") {
    const { deflateSync } = await import("node:zlib");
    return new Uint8Array(deflateSync(data));
  }
  const stream = new Response(data as unknown as BodyInit).body!
    .pipeThrough(new CompressionStream("deflate"));
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

/**
 * Decompress Deflate data
 * @param data Compressed data
 * @returns Decompressed data
 */
export async function deflateDecompress(
  data: Uint8Array,
): Promise<Uint8Array> {
  // Bun's DecompressionStream("deflate") hangs; use node:zlib as fallback
  // deno-lint-ignore no-explicit-any
  if (typeof (globalThis as any).Bun !== "undefined") {
    const { inflateSync } = await import("node:zlib");
    return new Uint8Array(inflateSync(data));
  }
  const stream = new Response(data as unknown as BodyInit).body!
    .pipeThrough(new DecompressionStream("deflate"));
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
}
