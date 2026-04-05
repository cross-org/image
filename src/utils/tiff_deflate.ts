/**
 * Deflate compression/decompression for TIFF
 * Compression code: 8 (Adobe-style Deflate)
 */
import { deflateSync, inflateSync } from "node:zlib";

/**
 * Compress data using Deflate
 * @param data Uncompressed data
 * @returns Compressed data
 */
export function deflateCompress(data: Uint8Array): Promise<Uint8Array> {
  const result = deflateSync(data);
  return Promise.resolve(result instanceof Uint8Array ? result : new Uint8Array(result));
}

/**
 * Decompress Deflate data
 * @param data Compressed data
 * @returns Decompressed data
 */
export function deflateDecompress(
  data: Uint8Array,
): Promise<Uint8Array> {
  const result = inflateSync(data);
  return Promise.resolve(result instanceof Uint8Array ? result : new Uint8Array(result));
}
