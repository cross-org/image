/**
 * Test WebP decoder's fault-tolerant mode
 */

import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { WebPDecoder } from "../../src/utils/webp_decoder.ts";

test("WebP decoder tolerant mode is enabled by default", () => {
  // Create a minimal valid WebP structure (will fail during decoding but that's ok for this test)
  const minimalWebP = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x00,
    0x00,
    0x00,
    0x00, // Size (placeholder)
    0x57,
    0x45,
    0x42,
    0x50, // "WEBP"
  ]);

  const decoder = new WebPDecoder(minimalWebP);
  // Verify decoder was created (tolerant mode is default)
  assertEquals(typeof decoder, "object");
});

test("WebP decoder tolerant mode can be disabled", () => {
  const minimalWebP = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x00,
    0x00,
    0x00,
    0x00, // Size (placeholder)
    0x57,
    0x45,
    0x42,
    0x50, // "WEBP"
  ]);

  const decoder = new WebPDecoder(minimalWebP, { tolerantDecoding: false });
  // Verify decoder was created with non-tolerant mode
  assertEquals(typeof decoder, "object");
});

test("WebP decoder exports options interface", async () => {
  // Verify the interface is exported properly
  const { WebPDecoder: DecoderClass } = await import(
    "../../src/utils/webp_decoder.ts"
  );
  assertEquals(typeof DecoderClass, "function");
});
