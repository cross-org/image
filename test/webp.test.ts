import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
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

test("WebP: encode/decode 100x100 red image", async () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    // @ts-ignore: Force pure-JS path for testing
    globalThis.OffscreenCanvas = undefined;

    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 4);

    // Fill with red
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 255; // R
      data[i * 4 + 1] = 0; // G
      data[i * 4 + 2] = 0; // B
      data[i * 4 + 3] = 255; // A
    }

    const encoded = await webpFormat.encode({ width, height, data }, {
      lossless: true,
    });

    // Basic checks on encoded data
    assertEquals(webpFormat.canDecode(encoded), true);

    // Decode back
    const decoded = await webpFormat.decode(encoded);

    assertEquals(decoded.width, width);
    assertEquals(decoded.height, height);

    // Check a few pixels
    // Top-left
    assertEquals(decoded.data[0], 255);
    assertEquals(decoded.data[1], 0);
    assertEquals(decoded.data[2], 0);
    assertEquals(decoded.data[3], 255);

    // Center
    const centerIdx = (50 * width + 50) * 4;
    assertEquals(decoded.data[centerIdx], 255);
    assertEquals(decoded.data[centerIdx + 1], 0);
    assertEquals(decoded.data[centerIdx + 2], 0);
    assertEquals(decoded.data[centerIdx + 3], 255);

    // Bottom-right
    const lastIdx = (width * height - 1) * 4;
    assertEquals(decoded.data[lastIdx], 255);
    assertEquals(decoded.data[lastIdx + 1], 0);
    assertEquals(decoded.data[lastIdx + 2], 0);
    assertEquals(decoded.data[lastIdx + 3], 255);
  } finally {
    // @ts-ignore: Restore
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});

test("WebP: encode/decode random noise (Complex Huffman)", async () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    // @ts-ignore: Force pure-JS path for testing
    globalThis.OffscreenCanvas = undefined;

    const width = 50;
    const height = 50;
    const data = new Uint8Array(width * height * 4);

    // Fill with random noise
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = Math.floor(Math.random() * 256); // R
      data[i * 4 + 1] = Math.floor(Math.random() * 256); // G
      data[i * 4 + 2] = Math.floor(Math.random() * 256); // B
      data[i * 4 + 3] = 255; // A
    }

    const encoded = await webpFormat.encode({ width, height, data }, {
      lossless: true,
    });

    // Basic checks
    assertEquals(webpFormat.canDecode(encoded), true);

    // Decode back
    const decoded = await webpFormat.decode(encoded);

    assertEquals(decoded.width, width);
    assertEquals(decoded.height, height);

    // Check pixel data
    for (let i = 0; i < data.length; i++) {
      assertEquals(decoded.data[i], data[i], `Mismatch at index ${i}`);
    }
  } finally {
    // @ts-ignore: Restore
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});
