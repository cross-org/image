/**
 * Deflate compression/decompression for TIFF
 * Compression code: 8 (Adobe-style Deflate)
 */
import { deflateData, inflateData } from "./deflate.ts";

/**
 * Compress data using Deflate
 * @param data Uncompressed data
 * @returns Compressed data
 */
export function deflateCompress(data: Uint8Array): Promise<Uint8Array> {
  return deflateData(data);
}

/**
 * Decompress Deflate data
 * @param data Compressed data
 * @returns Decompressed data
 */
export function deflateDecompress(
  data: Uint8Array,
): Promise<Uint8Array> {
  return inflateData(data);
}
