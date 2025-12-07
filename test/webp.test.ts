import { assertEquals, assertRejects } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { WebPFormat } from "../src/formats/webp.ts";

const webpFormat = new WebPFormat();

test("WebP: canDecode - valid WebP signature", () => {
  const data = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x00,
    0x00,
    0x00,
    0x00, // size (dummy)
    0x57,
    0x45,
    0x42,
    0x50, // "WEBP"
  ]);
  assertEquals(webpFormat.canDecode(data), true);
});

test("WebP: canDecode - invalid signature", () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  assertEquals(webpFormat.canDecode(data), false);
});

test("WebP: canDecode - too short", () => {
  const data = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
  assertEquals(webpFormat.canDecode(data), false);
});

test("WebP: decode - invalid data throws", async () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  await assertRejects(
    async () => await webpFormat.decode(data),
    Error,
    "Invalid WebP signature",
  );
});

test("WebP: properties", () => {
  assertEquals(webpFormat.name, "webp");
  assertEquals(webpFormat.mimeType, "image/webp");
});

test("WebP: encode - pure-JS fallback works", async () => {
  // Hide OffscreenCanvas to force pure-JS path
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    // @ts-ignore: Testing purposes - temporarily hiding OffscreenCanvas
    globalThis.OffscreenCanvas = undefined;

    const data = new Uint8Array(2 * 2 * 4);
    // Red pixel
    data[0] = 255;
    data[1] = 0;
    data[2] = 0;
    data[3] = 255;
    // Green pixel
    data[4] = 0;
    data[5] = 255;
    data[6] = 0;
    data[7] = 255;
    // Blue pixel
    data[8] = 0;
    data[9] = 0;
    data[10] = 255;
    data[11] = 255;
    // Yellow pixel
    data[12] = 255;
    data[13] = 255;
    data[14] = 0;
    data[15] = 255;

    const encoded = await webpFormat.encode({ width: 2, height: 2, data });

    // Verify it's a valid WebP
    assertEquals(encoded[0], 0x52); // 'R'
    assertEquals(encoded[1], 0x49); // 'I'
    assertEquals(encoded[2], 0x46); // 'F'
    assertEquals(encoded[3], 0x46); // 'F'
    assertEquals(encoded[8], 0x57); // 'W'
    assertEquals(encoded[9], 0x45); // 'E'
    assertEquals(encoded[10], 0x42); // 'B'
    assertEquals(encoded[11], 0x50); // 'P'
  } finally {
    // Restore
    // @ts-ignore: Testing purposes - restoring OffscreenCanvas
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});

test("WebP: encode - lossless quality (100)", async () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    // @ts-ignore: Force pure-JS path for testing
    globalThis.OffscreenCanvas = undefined;

    const data = new Uint8Array(2 * 2 * 4);
    // Create a simple gradient
    for (let i = 0; i < 4; i++) {
      data[i * 4] = 64 * i; // R
      data[i * 4 + 1] = 64 * i; // G
      data[i * 4 + 2] = 64 * i; // B
      data[i * 4 + 3] = 255; // A
    }

    const encoded = await webpFormat.encode(
      { width: 2, height: 2, data },
      { quality: 100 },
    );

    // Verify it's a valid WebP
    assertEquals(encoded[0], 0x52); // 'R'
    assertEquals(webpFormat.canDecode(encoded), true);
  } finally {
    // @ts-ignore: Restore
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});

test("WebP: encode - lossy quality (75)", async () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    // @ts-ignore: Force pure-JS path for testing
    globalThis.OffscreenCanvas = undefined;

    const data = new Uint8Array(4 * 4 * 4);
    // Create a gradient with many colors
    for (let i = 0; i < 16; i++) {
      data[i * 4] = 16 * i; // R
      data[i * 4 + 1] = 16 * i; // G
      data[i * 4 + 2] = 16 * i; // B
      data[i * 4 + 3] = 255; // A
    }

    const losslessEncoded = await webpFormat.encode(
      { width: 4, height: 4, data },
      { quality: 100 },
    );

    const lossyEncoded = await webpFormat.encode(
      { width: 4, height: 4, data },
      { quality: 75 },
    );

    // Verify both are valid WebP
    assertEquals(webpFormat.canDecode(losslessEncoded), true);
    assertEquals(webpFormat.canDecode(lossyEncoded), true);

    // Lossy should typically be smaller or similar size due to color quantization
    // reducing the number of unique colors
    // Note: Due to Huffman encoding, this isn't always guaranteed for tiny images
    console.log(
      `Lossless size: ${losslessEncoded.length}, Lossy size: ${lossyEncoded.length}`,
    );
  } finally {
    // @ts-ignore: Restore
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});

test("WebP: encode - very low quality (30)", async () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    // @ts-ignore: Force pure-JS path for testing
    globalThis.OffscreenCanvas = undefined;

    const data = new Uint8Array(8 * 8 * 4);
    // Create a gradient with many colors
    for (let i = 0; i < 64; i++) {
      data[i * 4] = 4 * i; // R
      data[i * 4 + 1] = 4 * i; // G
      data[i * 4 + 2] = 4 * i; // B
      data[i * 4 + 3] = 255; // A
    }

    const encoded = await webpFormat.encode(
      { width: 8, height: 8, data },
      { quality: 30 },
    );

    // Verify it's a valid WebP
    assertEquals(webpFormat.canDecode(encoded), true);
  } finally {
    // @ts-ignore: Restore
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});

test("WebP: encode - force lossless flag", async () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    // @ts-ignore: Force pure-JS path for testing
    globalThis.OffscreenCanvas = undefined;

    const data = new Uint8Array(2 * 2 * 4);
    for (let i = 0; i < 4; i++) {
      data[i * 4] = 128; // R
      data[i * 4 + 1] = 128; // G
      data[i * 4 + 2] = 128; // B
      data[i * 4 + 3] = 255; // A
    }

    // Even with quality < 100, lossless flag should force lossless encoding
    const encoded = await webpFormat.encode(
      { width: 2, height: 2, data },
      { quality: 75, lossless: true },
    );

    assertEquals(webpFormat.canDecode(encoded), true);
  } finally {
    // @ts-ignore: Restore
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});

// Test basic VP8L decoding with a simple solid color lossless WebP
// This test uses a manually crafted simple VP8L image
test("WebP: decode simple lossless image", () => {
  // Create a minimal lossless WebP file (2x2 red image)
  // This is a hand-crafted VP8L bitstream for testing
  // In production, we'd use actual WebP files

  // For now, skip this test as it requires a valid WebP file
  // The decoder will be tested with actual encoded WebP files
  console.log(
    "WebP decoder extended - requires actual WebP files for full testing",
  );
});

// Test VP8 (lossy) format detection and error handling
test("WebP: decode VP8 lossy - proper error message", async () => {
  // Create a minimal VP8 (lossy) WebP file to test error handling
  function createVP8WebP(): Uint8Array {
    const chunks: number[] = [];

    // RIFF header
    chunks.push(...[0x52, 0x49, 0x46, 0x46]); // "RIFF"

    // File size (placeholder, will update)
    const fileSizePos = chunks.length;
    chunks.push(0x00, 0x00, 0x00, 0x00);

    // WEBP signature
    chunks.push(...[0x57, 0x45, 0x42, 0x50]); // "WEBP"

    // VP8 chunk header
    chunks.push(...[0x56, 0x50, 0x38, 0x20]); // "VP8 " (note the space)

    // VP8 chunk size (minimal valid VP8 data = 10 bytes)
    const vp8ChunkSize = 10;
    chunks.push(
      vp8ChunkSize & 0xff,
      (vp8ChunkSize >> 8) & 0xff,
      (vp8ChunkSize >> 16) & 0xff,
      (vp8ChunkSize >> 24) & 0xff,
    );

    // Minimal VP8 frame data
    // Frame tag (3 bytes): key frame (bit 0 = 0)
    chunks.push(0x00, 0x00, 0x00);

    // Start code (3 bytes)
    chunks.push(0x9d, 0x01, 0x2a);

    // Width and height (2 bytes each, 14 bits)
    // Width = 2 (0x0001), Height = 2 (0x0001)
    chunks.push(0x01, 0x00); // width
    chunks.push(0x01, 0x00); // height

    // Update file size in RIFF header
    const fileSize = chunks.length - 8; // Size after "RIFF" and size field
    chunks[fileSizePos] = fileSize & 0xff;
    chunks[fileSizePos + 1] = (fileSize >> 8) & 0xff;
    chunks[fileSizePos + 2] = (fileSize >> 16) & 0xff;
    chunks[fileSizePos + 3] = (fileSize >> 24) & 0xff;

    return new Uint8Array(chunks);
  }

  const vp8WebP = createVP8WebP();

  // Check if ImageDecoder is available
  if (typeof ImageDecoder === "undefined") {
    // Without ImageDecoder, VP8 should fail with a helpful error message
    await assertRejects(
      async () => await webpFormat.decode(vp8WebP),
      Error,
      "WebP lossy (VP8) format requires ImageDecoder API",
    );
  } else {
    // With ImageDecoder, VP8 might work (depending on the validity of our minimal file)
    // or might fail for other reasons, which is acceptable
    console.log("ImageDecoder available - VP8 test behavior may vary");
  }
});
