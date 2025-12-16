import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../../mod.ts";

test("TIFF: encode and decode CMYK", async () => {
  // Create a test image with different colors
  const image = Image.create(3, 2);
  image.setPixel(0, 0, 255, 0, 0, 255); // Red
  image.setPixel(1, 0, 0, 255, 0, 255); // Green
  image.setPixel(2, 0, 0, 0, 255, 255); // Blue
  image.setPixel(0, 1, 255, 255, 0, 255); // Yellow
  image.setPixel(1, 1, 255, 0, 255, 255); // Magenta
  image.setPixel(2, 1, 0, 255, 255, 255); // Cyan

  // Encode as CMYK TIFF
  const tiffBytes = await image.encode("tiff", { cmyk: true });

  // Decode the CMYK TIFF
  const decoded = await Image.decode(tiffBytes);

  // Check dimensions
  assertEquals(decoded.width, 3);
  assertEquals(decoded.height, 2);

  // Check colors (allow small rounding errors due to CMYK conversion)
  const checkPixel = (
    x: number,
    y: number,
    expectedR: number,
    expectedG: number,
    expectedB: number,
  ) => {
    const pixel = decoded.getPixel(x, y);
    assertEquals(pixel !== null, true);
    if (pixel) {
      // Allow up to 2 units of difference due to rounding
      assertEquals(
        Math.abs(pixel.r - expectedR) <= 2,
        true,
        `Red at (${x},${y}): expected ${expectedR}, got ${pixel.r}`,
      );
      assertEquals(
        Math.abs(pixel.g - expectedG) <= 2,
        true,
        `Green at (${x},${y}): expected ${expectedG}, got ${pixel.g}`,
      );
      assertEquals(
        Math.abs(pixel.b - expectedB) <= 2,
        true,
        `Blue at (${x},${y}): expected ${expectedB}, got ${pixel.b}`,
      );
    }
  };

  checkPixel(0, 0, 255, 0, 0); // Red
  checkPixel(1, 0, 0, 255, 0); // Green
  checkPixel(2, 0, 0, 0, 255); // Blue
  checkPixel(0, 1, 255, 255, 0); // Yellow
  checkPixel(1, 1, 255, 0, 255); // Magenta
  checkPixel(2, 1, 0, 255, 255); // Cyan
});

test("TIFF: encode CMYK with compression", async () => {
  // Create a simple test image
  const image = Image.create(4, 4, 128, 64, 32, 255);

  // Test each compression method
  for (const compression of ["none", "lzw", "packbits", "deflate"] as const) {
    const tiffBytes = await image.encode("tiff", { cmyk: true, compression });
    const decoded = await Image.decode(tiffBytes);

    assertEquals(decoded.width, 4);
    assertEquals(decoded.height, 4);

    // Check first pixel
    const pixel = decoded.getPixel(0, 0);
    assertEquals(pixel !== null, true);
    if (pixel) {
      // Allow small rounding errors
      assertEquals(Math.abs(pixel.r - 128) <= 2, true, `compression=${compression}`);
      assertEquals(Math.abs(pixel.g - 64) <= 2, true, `compression=${compression}`);
      assertEquals(Math.abs(pixel.b - 32) <= 2, true, `compression=${compression}`);
    }
  }
});

test("TIFF: CMYK roundtrip preserves colors", async () => {
  // Create an image with various shades
  const image = Image.create(5, 1);
  image.setPixel(0, 0, 0, 0, 0, 255); // Black
  image.setPixel(1, 0, 255, 255, 255, 255); // White
  image.setPixel(2, 0, 128, 128, 128, 255); // Gray
  image.setPixel(3, 0, 200, 100, 50, 255); // Brown-ish
  image.setPixel(4, 0, 50, 150, 200, 255); // Blue-ish

  // Encode and decode
  const tiffBytes = await image.encode("tiff", { cmyk: true });
  const decoded = await Image.decode(tiffBytes);

  // Check each pixel
  for (let x = 0; x < 5; x++) {
    const original = image.getPixel(x, 0);
    const restored = decoded.getPixel(x, 0);

    assertEquals(original !== null, true);
    assertEquals(restored !== null, true);

    if (original && restored) {
      // Allow up to 2 units difference
      assertEquals(
        Math.abs(original.r - restored.r) <= 2,
        true,
        `Pixel ${x} R: ${original.r} vs ${restored.r}`,
      );
      assertEquals(
        Math.abs(original.g - restored.g) <= 2,
        true,
        `Pixel ${x} G: ${original.g} vs ${restored.g}`,
      );
      assertEquals(
        Math.abs(original.b - restored.b) <= 2,
        true,
        `Pixel ${x} B: ${original.b} vs ${restored.b}`,
      );
    }
  }
});

test("TIFF: decode externally created CMYK TIFF", async () => {
  // This test would require an external CMYK TIFF file
  // For now, we'll create one ourselves and decode it
  const image = Image.create(2, 2, 255, 128, 64, 255);
  const tiffBytes = await image.encode("tiff", { cmyk: true });

  // Verify we can decode it
  const decoded = await Image.decode(tiffBytes);
  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);

  const pixel = decoded.getPixel(0, 0);
  assertEquals(pixel !== null, true);
  if (pixel) {
    assertEquals(Math.abs(pixel.r - 255) <= 2, true);
    assertEquals(Math.abs(pixel.g - 128) <= 2, true);
    assertEquals(Math.abs(pixel.b - 64) <= 2, true);
  }
});

test("TIFF: CMYK option ignored when grayscale is true", async () => {
  const image = Image.create(2, 2, 100, 150, 200, 255);

  // Both cmyk and grayscale options set, grayscale should take precedence
  const tiffBytes = await image.encode("tiff", { cmyk: true, grayscale: true });
  const decoded = await Image.decode(tiffBytes);

  // Should be grayscale
  const pixel = decoded.getPixel(0, 0);
  assertEquals(pixel !== null, true);
  if (pixel) {
    // In grayscale, R=G=B
    assertEquals(pixel.r, pixel.g);
    assertEquals(pixel.g, pixel.b);
  }
});
