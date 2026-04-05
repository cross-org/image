import { describe, expect, test } from "bun:test";
import { deflateSync, inflateSync } from "node:zlib";

/** Collect all chunks from a ReadableStream into a single Uint8Array. */
async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Build a deterministic test payload (64 KiB). */
function makePayload(size = 65_536): Uint8Array {
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; i++) buf[i] = i & 0xff;
  return buf;
}

describe("CompressionStream / DecompressionStream", () => {
  const original = makePayload();

  // ── Baseline: node:zlib (synchronous) ─────────────────────────────
  test("deflateSync / inflateSync roundtrip (baseline)", () => {
    const compressed = deflateSync(original);
    const decompressed = inflateSync(compressed);
    expect(new Uint8Array(decompressed)).toEqual(original);
  });

  // ── Web Streams: CompressionStream ────────────────────────────────
  test("CompressionStream roundtrip", async () => {
    const compressed = await readAll(
      new ReadableStream({
        start(controller) {
          controller.enqueue(original);
          controller.close();
        },
      }).pipeThrough(new CompressionStream("deflate")),
    );
    // Verify by decompressing with node:zlib
    const result = new Uint8Array(inflateSync(compressed));
    expect(result).toEqual(original);
  });

  // ── Web Streams: DecompressionStream ──────────────────────────────
  test("DecompressionStream roundtrip", async () => {
    // Compress with node:zlib, decompress with DecompressionStream
    const compressed = deflateSync(original);
    const decompressed = await readAll(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(compressed));
          controller.close();
        },
      }).pipeThrough(new DecompressionStream("deflate")),
    );
    expect(decompressed).toEqual(original);
  });

  // ── Web Streams: full pipe chain ──────────────────────────────────
  test("pipeThrough deflate + inflate roundtrip", async () => {
    const result = await readAll(
      new ReadableStream({
        start(controller) {
          controller.enqueue(original);
          controller.close();
        },
      })
        .pipeThrough(new CompressionStream("deflate"))
        .pipeThrough(new DecompressionStream("deflate")),
    );
    expect(result).toEqual(original);
  });

  // ── Alternative: new Response().body feed ─────────────────────────
  test("new Response().body.pipeThrough (alternative feed)", async () => {
    const body = new Response(original).body!;
    const compressed = await readAll(
      body.pipeThrough(new CompressionStream("deflate")),
    );
    const result = new Uint8Array(inflateSync(compressed));
    expect(result).toEqual(original);
  });
});
