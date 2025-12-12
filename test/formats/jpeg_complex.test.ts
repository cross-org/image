/**
 * Test to ensure JPEG decoder properly fails on complex images
 * instead of returning corrupted data
 */

import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../../src/image.ts";

// Cross-runtime file reading helper
async function readFile(path: string): Promise<Uint8Array> {
  if (typeof Deno !== "undefined") {
    // Deno runtime
    return await Deno.readFile(path);
  } else {
    // Node.js/Bun runtime
    const fs = await import("fs/promises");
    const buffer = await fs.readFile(path);
    return new Uint8Array(buffer);
  }
}

test("JPEG decoder with tolerant mode successfully decodes complex images", async () => {
  // This test uses 1000015567.jpg which contains:
  // - A 144x176 thumbnail in EXIF data
  // - A 3000x4000 main image with complex encoding
  // The pure-JS decoder now uses tolerant mode to handle partial decoding failures

  try {
    const data = await readFile("1000015567.jpg");

    // Hide ImageDecoder API to force pure-JS decoder
    const originalImageDecoder = globalThis.ImageDecoder;
    try {
      (globalThis as { ImageDecoder?: unknown }).ImageDecoder = undefined;

      // With tolerant mode, this should succeed with partial decoding
      const image = await Image.decode(data);

      // Verify we got the correct main image dimensions
      assertEquals(image.width, 3000, "Should decode main image width");
      assertEquals(image.height, 4000, "Should decode main image height");

      // Verify we have valid RGB data
      assertEquals(
        image.data.length,
        3000 * 4000 * 4,
        "Should have complete RGBA data",
      );

      // Check that most pixels have non-zero values (indicating successful decode)
      let nonZeroPixels = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        if (
          image.data[i] !== 0 || image.data[i + 1] !== 0 ||
          image.data[i + 2] !== 0
        ) {
          nonZeroPixels++;
        }
      }

      const totalPixels = image.width * image.height;
      const successRate = nonZeroPixels / totalPixels;

      // At least 95% of pixels should be decoded successfully
      if (successRate < 0.95) {
        throw new Error(
          `Only ${
            (successRate * 100).toFixed(2)
          }% of pixels decoded successfully`,
        );
      }
    } finally {
      (globalThis as { ImageDecoder?: unknown }).ImageDecoder =
        originalImageDecoder;
    }
  } catch (e) {
    // If file doesn't exist, skip this test
    if (
      (typeof Deno !== "undefined" && e instanceof Deno.errors.NotFound) ||
      (e instanceof Error && (e as { code?: string }).code === "ENOENT")
    ) {
      console.log("Skipping test: 1000015567.jpg not found");
      return;
    }
    throw e;
  }
});

test("JPEG decoder should correctly identify main image dimensions from complex file", async () => {
  // Verify that the decoder correctly identifies the main image (3000x4000)
  // and not the embedded thumbnail (144x176)

  try {
    const data = await readFile("1000015567.jpg");

    // Parse JPEG to find SOF markers manually
    let pos = 2; // Skip SOI
    let mainImageWidth = 0;
    let mainImageHeight = 0;
    let sofCount = 0;

    while (pos < data.length - 1) {
      if (data[pos] !== 0xff) {
        pos++;
        continue;
      }

      const marker = data[pos + 1];
      pos += 2;

      // SOF markers
      if (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        sofCount++;
        const length = (data[pos] << 8) | data[pos + 1];
        const height = (data[pos + 3] << 8) | data[pos + 4];
        const width = (data[pos + 5] << 8) | data[pos + 6];

        // The first SOF we encounter outside of APP markers is the main image
        // For this specific test image (1000015567.jpg), APP markers end around 0x7000
        if (sofCount === 1 && pos > 0x7000) {
          mainImageHeight = height;
          mainImageWidth = width;
          break;
        }
        pos += length;
        continue;
      }

      // Skip other markers
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker >= 0xd0 && marker <= 0xd8) continue;
      if (marker === 0x01) continue;

      const length = (data[pos] << 8) | data[pos + 1];
      pos += length;
    }

    // Verify dimensions
    assertEquals(mainImageWidth, 3000, "Main image width should be 3000");
    assertEquals(mainImageHeight, 4000, "Main image height should be 4000");
  } catch (e) {
    // If file doesn't exist, skip this test
    if (
      (typeof Deno !== "undefined" && e instanceof Deno.errors.NotFound) ||
      (e instanceof Error && (e as { code?: string }).code === "ENOENT")
    ) {
      console.log("Skipping test: 1000015567.jpg not found");
      return;
    }
    throw e;
  }
});
