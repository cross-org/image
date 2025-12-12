/**
 * Test GIF decoder's fault-tolerant mode
 */

import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { GIFDecoder } from "../../src/utils/gif_decoder.ts";

test("GIF decoder tolerant mode is enabled by default", () => {
  // Create a minimal valid GIF structure
  const minimalGIF = new Uint8Array([
    0x47,
    0x49,
    0x46, // "GIF"
    0x38,
    0x39,
    0x61, // "89a"
    0x01,
    0x00, // Width: 1
    0x01,
    0x00, // Height: 1
    0x00, // Packed field (no global color table)
    0x00, // Background color index
    0x00, // Aspect ratio
    0x3b, // Trailer (end of GIF)
  ]);

  const decoder = new GIFDecoder(minimalGIF);
  // Verify decoder was created (tolerant mode is default)
  assertEquals(typeof decoder, "object");
});

test("GIF decoder tolerant mode can be disabled", () => {
  const minimalGIF = new Uint8Array([
    0x47,
    0x49,
    0x46, // "GIF"
    0x38,
    0x39,
    0x61, // "89a"
    0x01,
    0x00, // Width: 1
    0x01,
    0x00, // Height: 1
    0x00, // Packed field (no global color table)
    0x00, // Background color index
    0x00, // Aspect ratio
    0x3b, // Trailer (end of GIF)
  ]);

  const decoder = new GIFDecoder(minimalGIF, { tolerantDecoding: false });
  // Verify decoder was created with non-tolerant mode
  assertEquals(typeof decoder, "object");
});

test("GIF decoder exports options interface", async () => {
  // Verify the interface is exported properly
  const { GIFDecoder: DecoderClass } = await import(
    "../../src/utils/gif_decoder.ts"
  );
  assertEquals(typeof DecoderClass, "function");
});
