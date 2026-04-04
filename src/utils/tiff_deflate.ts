/**
 * Deflate compression/decompression for TIFF
 * Compression code: 8 (Adobe-style Deflate)
 */

/**
 * Collect all chunks from a ReadableStream<Uint8Array> into a single Uint8Array.
 * Using ReadableStream directly (instead of new Response(data).body) avoids a hang
 * in certain Bun versions when feeding Uint8Array data into CompressionStream/
 * DecompressionStream via the Response body wrapper.
 */
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
 * Compress data using Deflate
 * @param data Uncompressed data
 * @returns Compressed data
 */
export function deflateCompress(data: Uint8Array): Promise<Uint8Array> {
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
 * Decompress Deflate data
 * @param data Compressed data
 * @returns Decompressed data
 */
export function deflateDecompress(
  data: Uint8Array,
): Promise<Uint8Array> {
  return readStream(
    new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }).pipeThrough(new DecompressionStream("deflate")),
  );
}
