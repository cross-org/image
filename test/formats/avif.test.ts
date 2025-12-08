import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { AVIFFormat } from "../../src/formats/avif.ts";

const avifFormat = new AVIFFormat();

test("AVIF: canDecode - valid AVIF signature (still image)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x61,
    0x76,
    0x69,
    0x66, // "avif" major brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(avifFormat.canDecode(data), true);
});

test("AVIF: canDecode - valid AVIF signature (sequence)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x61,
    0x76,
    0x69,
    0x73, // "avis" major brand (sequence)
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(avifFormat.canDecode(data), true);
});

test("AVIF: canDecode - invalid signature (wrong ftyp)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x68,
    0x65,
    0x69,
    0x63, // "heic" (not avif)
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(avifFormat.canDecode(data), false);
});

test("AVIF: canDecode - invalid signature (no ftyp)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18,
    0x6d,
    0x64,
    0x61,
    0x74, // "mdat" instead of "ftyp"
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  assertEquals(avifFormat.canDecode(data), false);
});

test("AVIF: canDecode - too short", () => {
  const data = new Uint8Array([0x66, 0x74, 0x79, 0x70]);
  assertEquals(avifFormat.canDecode(data), false);
});

test("AVIF: decode - invalid data throws", async () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  await assertRejects(
    async () => await avifFormat.decode(data),
    Error,
    "Invalid AVIF signature",
  );
});

test("AVIF: properties", () => {
  assertEquals(avifFormat.name, "avif");
  assertEquals(avifFormat.mimeType, "image/avif");
});

// Note: The following tests for encode/decode roundtrip would require
// native API support (ImageDecoder/OffscreenCanvas with AVIF support).
// These tests will pass in Deno 2.x, Node.js 20+, and Bun, but may fail
// in environments without AVIF support in the native APIs.

test("AVIF: encode/decode roundtrip - skipped if native APIs unavailable", async () => {
  // Check if native APIs are available and support AVIF
  if (
    typeof OffscreenCanvas === "undefined" ||
    typeof ImageDecoder === "undefined"
  ) {
    // Skip test if APIs aren't available
    console.log("Skipping AVIF roundtrip test - native APIs not available");
    return;
  }

  try {
    // Create a simple test image
    const width = 2;
    const height = 2;
    const data = new Uint8Array(width * height * 4);

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
    // White pixel
    data[12] = 255;
    data[13] = 255;
    data[14] = 255;
    data[15] = 255;

    // Encode to AVIF
    const encoded = await avifFormat.encode({ width, height, data });

    // Verify it's a valid AVIF (check signature)
    assertEquals(avifFormat.canDecode(encoded), true);

    // Decode it back
    const decoded = await avifFormat.decode(encoded);

    // Check dimensions
    assertEquals(decoded.width, width);
    assertEquals(decoded.height, height);

    // Note: Due to lossy compression in AVIF, exact pixel values may differ
    // We just verify the image decoded successfully with correct dimensions
  } catch (error) {
    // If AVIF isn't supported by the native APIs, skip the test
    if (
      error instanceof Error &&
      (error.message.includes("not available") ||
        error.message.includes("not supported"))
    ) {
      console.log(
        "Skipping AVIF roundtrip test - AVIF not supported in this runtime",
      );
      return;
    }
    throw error;
  }
});
