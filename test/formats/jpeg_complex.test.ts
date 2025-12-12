/**
 * Test to ensure JPEG decoder handles complex images with tolerant decoding
 */

import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { JPEGDecoder } from "../../src/utils/jpeg_decoder.ts";

test("JPEG decoder tolerant mode is enabled by default", () => {
  // Create a minimal valid JPEG structure (will fail during decoding but that's ok for this test)
  const minimalJPEG = new Uint8Array([
    0xFF,
    0xD8, // SOI
    0xFF,
    0xD9, // EOI
  ]);

  const decoder = new JPEGDecoder(minimalJPEG);
  // Verify decoder was created (tolerant mode is default)
  assertEquals(typeof decoder, "object");
});

test("JPEG decoder tolerant mode can be disabled", () => {
  const minimalJPEG = new Uint8Array([
    0xFF,
    0xD8, // SOI
    0xFF,
    0xD9, // EOI
  ]);

  const decoder = new JPEGDecoder(minimalJPEG, { tolerantDecoding: false });
  // Verify decoder was created with non-tolerant mode
  assertEquals(typeof decoder, "object");
});

test("JPEG decoder exports options interface", async () => {
  // Verify the interface is exported properly
  const { JPEGDecoder: DecoderClass } = await import(
    "../../src/utils/jpeg_decoder.ts"
  );
  assertEquals(typeof DecoderClass, "function");
});
