import { CurrentRuntime, Runtime } from "@cross/runtime";

/**
 * Deflate compression/decompression for TIFF
 * Uses native JavaScript CompressionStream/DecompressionStream APIs with fallbacks
 * Compression code: 8 (Adobe-style Deflate)
 */

/**
 * Compress data using Deflate
 * Falls back to Bun's native zlib or Node.js zlib when CompressionStream is unavailable
 * @param data Uncompressed data
 * @returns Compressed data
 */
export async function deflateCompress(data: Uint8Array): Promise<Uint8Array> {
  // Prefer Web CompressionStream API (works in Deno, browsers, Node.js 18+)
  if (typeof CompressionStream !== "undefined") {
    const stream = new Response(data as unknown as BodyInit).body!
      .pipeThrough(new CompressionStream("deflate"));
    const compressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(compressed);
  }

  // Fall back to Bun's native compression if available
  if (CurrentRuntime === Runtime.Bun) {
    const bun = (globalThis as { Bun?: { deflateSync?: (data: Uint8Array) => Uint8Array } }).Bun;
    if (bun?.deflateSync) {
      return bun.deflateSync(data);
    }
  }

  // Fall back to Node.js zlib (for older Node.js versions)
  if (CurrentRuntime === Runtime.Node) {
    const { deflateSync } = await import("node:zlib");
    const result = deflateSync(data);
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  }

  throw new Error(
    "Compression not available. Requires CompressionStream API, Bun.deflateSync, or Node.js zlib",
  );
}

/**
 * Decompress Deflate data
 * Falls back to Bun's native zlib or Node.js zlib when DecompressionStream is unavailable
 * @param data Compressed data
 * @returns Decompressed data
 */
export async function deflateDecompress(
  data: Uint8Array,
): Promise<Uint8Array> {
  // Prefer Web DecompressionStream API (works in Deno, browsers, Node.js 18+)
  if (typeof DecompressionStream !== "undefined") {
    const stream = new Response(data as unknown as BodyInit).body!
      .pipeThrough(new DecompressionStream("deflate"));
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  }

  // Fall back to Bun's native decompression if available
  if (CurrentRuntime === Runtime.Bun) {
    const bun = (globalThis as { Bun?: { inflateSync?: (data: Uint8Array) => Uint8Array } }).Bun;
    if (bun?.inflateSync) {
      return bun.inflateSync(data);
    }
  }

  // Fall back to Node.js zlib (for older Node.js versions)
  if (CurrentRuntime === Runtime.Node) {
    const { inflateSync } = await import("node:zlib");
    const result = inflateSync(data);
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  }

  throw new Error(
    "Decompression not available. Requires DecompressionStream API, Bun.inflateSync, or Node.js zlib",
  );
}
