import { assertEquals, assertExists } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Image: create blank image", () => {
  const image = Image.create(10, 10);

  assertEquals(image.width, 10);
  assertEquals(image.height, 10);
  assertEquals(image.data.length, 400); // 10x10x4

  // Check that all pixels are black with full alpha by default
  for (let i = 0; i < image.data.length; i += 4) {
    assertEquals(image.data[i], 0); // R
    assertEquals(image.data[i + 1], 0); // G
    assertEquals(image.data[i + 2], 0); // B
    assertEquals(image.data[i + 3], 255); // A
  }
});

test("Image: create with custom color", () => {
  const image = Image.create(5, 5, 255, 128, 64, 200);

  assertEquals(image.width, 5);
  assertEquals(image.height, 5);

  // Check first pixel
  assertEquals(image.data[0], 255); // R
  assertEquals(image.data[1], 128); // G
  assertEquals(image.data[2], 64); // B
  assertEquals(image.data[3], 200); // A
});

test("Image: composite - basic overlay", () => {
  // Create a blue base image (10x10)
  const base = Image.create(10, 10, 0, 0, 255, 255);

  // Create a red overlay (5x5)
  const overlay = Image.create(5, 5, 255, 0, 0, 255);

  // Composite at position (2, 2)
  base.composite(overlay, 2, 2);

  // Check that overlay area is red
  const pixel = base.getPixel(3, 3);
  assertExists(pixel);
  assertEquals(pixel.r, 255);
  assertEquals(pixel.g, 0);
  assertEquals(pixel.b, 0);

  // Check that outside area is still blue
  const outsidePixel = base.getPixel(0, 0);
  assertExists(outsidePixel);
  assertEquals(outsidePixel.r, 0);
  assertEquals(outsidePixel.g, 0);
  assertEquals(outsidePixel.b, 255);
});

test("Image: composite - with opacity", () => {
  // Create a white base
  const base = Image.create(10, 10, 255, 255, 255, 255);

  // Create a black overlay
  const overlay = Image.create(5, 5, 0, 0, 0, 255);

  // Composite with 50% opacity
  base.composite(overlay, 0, 0, 0.5);

  // Check that the result is gray (blend of white and black at 50%)
  const pixel = base.getPixel(2, 2);
  assertExists(pixel);
  // Should be around 127-128 (50% blend)
  assertEquals(pixel.r >= 120 && pixel.r <= 135, true);
  assertEquals(pixel.g >= 120 && pixel.g <= 135, true);
  assertEquals(pixel.b >= 120 && pixel.b <= 135, true);
});

test("Image: composite - negative position", () => {
  const base = Image.create(10, 10, 0, 0, 255, 255);
  const overlay = Image.create(5, 5, 255, 0, 0, 255);

  // Composite at negative position (only part should be visible)
  base.composite(overlay, -2, -2);

  // Top-left should have red
  const pixel = base.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.r, 255);
  assertEquals(pixel.g, 0);
  assertEquals(pixel.b, 0);

  // Bottom-right should still be blue
  const farPixel = base.getPixel(9, 9);
  assertExists(farPixel);
  assertEquals(farPixel.r, 0);
  assertEquals(farPixel.g, 0);
  assertEquals(farPixel.b, 255);
});

test("Image: brightness - increase", () => {
  const image = Image.create(5, 5, 100, 100, 100, 255);

  image.brightness(0.5);

  // Should be brighter
  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.r > 100, true);
  assertEquals(pixel.g > 100, true);
  assertEquals(pixel.b > 100, true);
});

test("Image: brightness - decrease", () => {
  const image = Image.create(5, 5, 150, 150, 150, 255);

  image.brightness(-0.3);

  // Should be darker
  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.r < 150, true);
  assertEquals(pixel.g < 150, true);
  assertEquals(pixel.b < 150, true);
});

test("Image: contrast - increase", () => {
  // Create an image with gray pixels
  const image = Image.create(5, 5, 128, 128, 128, 255);

  image.contrast(0.5);

  // Contrast should push values away from middle gray (128)
  // but for a perfectly gray image, it should stay around the same
  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.a, 255); // Alpha unchanged
});

test("Image: exposure - increase", () => {
  const image = Image.create(5, 5, 100, 100, 100, 255);

  image.exposure(1); // +1 stop = 2x brighter

  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.r, 200); // 100 * 2
  assertEquals(pixel.g, 200);
  assertEquals(pixel.b, 200);
});

test("Image: exposure - decrease", () => {
  const image = Image.create(5, 5, 200, 200, 200, 255);

  image.exposure(-1); // -1 stop = 0.5x brightness

  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.r, 100); // 200 * 0.5
  assertEquals(pixel.g, 100);
  assertEquals(pixel.b, 100);
});

test("Image: saturation - desaturate", () => {
  const image = Image.create(5, 5, 255, 0, 0, 255); // Red

  image.saturation(-1); // Fully desaturate

  // Should become gray
  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  // All channels should be similar (gray)
  const diff = Math.abs(pixel.r - pixel.g);
  assertEquals(diff < 5, true); // Allow small rounding differences
});

test("Image: saturation - increase", () => {
  // Start with a slightly desaturated red
  const image = Image.create(5, 5, 200, 100, 100, 255);

  image.saturation(0.5);

  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  // Red channel should increase relative to others
  assertEquals(pixel.r > 200, true);
});

test("Image: invert colors", () => {
  const image = Image.create(5, 5, 255, 0, 128, 255);

  image.invert();

  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.r, 0); // 255 -> 0
  assertEquals(pixel.g, 255); // 0 -> 255
  assertEquals(pixel.b, 127); // 128 -> 127
  assertEquals(pixel.a, 255); // Alpha unchanged
});

test("Image: grayscale conversion", () => {
  const image = Image.create(5, 5, 255, 0, 0, 255); // Red

  image.grayscale();

  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  // All RGB channels should be equal
  assertEquals(pixel.r, pixel.g);
  assertEquals(pixel.g, pixel.b);
  assertEquals(pixel.a, 255); // Alpha unchanged
});

test("Image: fillRect - basic", () => {
  const image = Image.create(10, 10, 0, 0, 0, 255);

  // Fill a 5x5 region with red
  image.fillRect(2, 2, 5, 5, 255, 0, 0, 255);

  // Check inside the filled region
  const insidePixel = image.getPixel(4, 4);
  assertExists(insidePixel);
  assertEquals(insidePixel.r, 255);
  assertEquals(insidePixel.g, 0);
  assertEquals(insidePixel.b, 0);

  // Check outside the filled region
  const outsidePixel = image.getPixel(0, 0);
  assertExists(outsidePixel);
  assertEquals(outsidePixel.r, 0);
  assertEquals(outsidePixel.g, 0);
  assertEquals(outsidePixel.b, 0);
});

test("Image: fillRect - partial (clipping)", () => {
  const image = Image.create(10, 10, 0, 0, 0, 255);

  // Fill extending beyond image bounds
  image.fillRect(8, 8, 5, 5, 255, 0, 0, 255);

  // Check corner pixel (should be filled)
  const pixel = image.getPixel(9, 9);
  assertExists(pixel);
  assertEquals(pixel.r, 255);
  assertEquals(pixel.g, 0);
  assertEquals(pixel.b, 0);
});

test("Image: crop - basic", () => {
  const image = Image.create(10, 10, 255, 0, 0, 255);

  // Fill a small region with blue
  image.fillRect(2, 2, 3, 3, 0, 0, 255, 255);

  // Crop to just the blue region
  image.crop(2, 2, 3, 3);

  assertEquals(image.width, 3);
  assertEquals(image.height, 3);

  // All pixels should be blue
  const pixel = image.getPixel(0, 0);
  assertExists(pixel);
  assertEquals(pixel.r, 0);
  assertEquals(pixel.g, 0);
  assertEquals(pixel.b, 255);
});

test("Image: crop - with clipping", () => {
  const image = Image.create(10, 10, 255, 0, 0, 255);

  // Crop extending beyond bounds
  image.crop(8, 8, 5, 5);

  // Should be clipped to 2x2
  assertEquals(image.width, 2);
  assertEquals(image.height, 2);
});

test("Image: getPixel - valid position", () => {
  const image = Image.create(5, 5, 100, 150, 200, 250);

  const pixel = image.getPixel(2, 2);

  assertExists(pixel);
  assertEquals(pixel.r, 100);
  assertEquals(pixel.g, 150);
  assertEquals(pixel.b, 200);
  assertEquals(pixel.a, 250);
});

test("Image: getPixel - out of bounds", () => {
  const image = Image.create(5, 5, 255, 0, 0, 255);

  assertEquals(image.getPixel(-1, 0), undefined);
  assertEquals(image.getPixel(0, -1), undefined);
  assertEquals(image.getPixel(5, 0), undefined);
  assertEquals(image.getPixel(0, 5), undefined);
});

test("Image: setPixel - valid position", () => {
  const image = Image.create(5, 5, 0, 0, 0, 255);

  image.setPixel(2, 2, 255, 128, 64, 200);

  const pixel = image.getPixel(2, 2);
  assertExists(pixel);
  assertEquals(pixel.r, 255);
  assertEquals(pixel.g, 128);
  assertEquals(pixel.b, 64);
  assertEquals(pixel.a, 200);
});

test("Image: setPixel - out of bounds", () => {
  const image = Image.create(5, 5, 0, 0, 0, 255);

  // Should not throw, just ignore
  image.setPixel(-1, 0, 255, 0, 0, 255);
  image.setPixel(10, 10, 255, 0, 0, 255);

  // Image should be unchanged
  assertEquals(image.width, 5);
  assertEquals(image.height, 5);
});

test("Image: chaining operations", () => {
  const image = Image.create(10, 10, 128, 128, 128, 255);

  // Chain multiple operations
  image
    .brightness(0.2)
    .contrast(0.1)
    .saturation(-0.5)
    .fillRect(0, 0, 5, 5, 255, 0, 0, 255);

  assertEquals(image.width, 10);
  assertEquals(image.height, 10);

  // Check that fillRect worked
  const pixel = image.getPixel(2, 2);
  assertExists(pixel);
  assertEquals(pixel.r, 255);
});

test("Image: composite and save", async () => {
  const base = Image.create(20, 20, 0, 0, 255, 255);
  const overlay = Image.create(10, 10, 255, 0, 0, 255);

  base.composite(overlay, 5, 5);

  // Should be able to encode
  const encoded = await base.encode("png");
  assertEquals(encoded.length > 0, true);

  // Should be able to decode back
  const decoded = await Image.decode(encoded);
  assertEquals(decoded.width, 20);
  assertEquals(decoded.height, 20);
});

test("Image: processing pipeline", async () => {
  // Create an image
  const image = Image.create(50, 50, 200, 100, 50, 255);

  // Apply multiple effects
  image
    .brightness(-0.1)
    .contrast(0.2)
    .saturation(-0.3);

  // Crop a portion
  image.crop(10, 10, 30, 30);

  assertEquals(image.width, 30);
  assertEquals(image.height, 30);

  // Create an overlay
  const overlay = Image.create(10, 10, 255, 255, 0, 200);

  // Composite it
  image.composite(overlay, 10, 10, 0.7);

  // Save result
  const encoded = await image.encode("png");
  assertEquals(encoded.length > 0, true);
});
