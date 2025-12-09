import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Image: rotate90 - basic rotation", async () => {
  // Create a 2x3 image with distinct colors
  const data = new Uint8Array([
    // Row 0
    255, 0, 0, 255, // red
    0, 255, 0, 255, // green
    // Row 1
    0, 0, 255, 255, // blue
    255, 255, 0, 255, // yellow
    // Row 2
    255, 0, 255, 255, // magenta
    0, 255, 255, 255, // cyan
  ]);

  const image = Image.fromRGBA(2, 3, data);
  image.rotate90();

  // Dimensions should swap
  assertEquals(image.width, 3);
  assertEquals(image.height, 2);

  // Test that it encodes successfully
  const encoded = await image.encode("png");
  assertEquals(encoded.length > 0, true);
});

test("Image: rotate180 - basic rotation", () => {
  const data = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (0,1) blue
    255, 255, 0, 255, // (1,1) yellow
  ]);

  const image = Image.fromRGBA(2, 2, data);
  image.rotate180();

  // Dimensions remain the same
  assertEquals(image.width, 2);
  assertEquals(image.height, 2);

  // Check that corner pixels have moved
  assertEquals(image.data[0], 255); // yellow (was at 1,1)
  assertEquals(image.data[1], 255);
  assertEquals(image.data[2], 0);
});

test("Image: rotate270 - basic rotation", async () => {
  const data = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (2,0) blue
    255, 255, 0, 255, // (0,1) yellow
    255, 0, 255, 255, // (1,1) magenta
    0, 255, 255, 255, // (2,1) cyan
  ]);

  const image = Image.fromRGBA(3, 2, data);
  image.rotate270();

  // Dimensions should swap
  assertEquals(image.width, 2);
  assertEquals(image.height, 3);

  // Test that it encodes successfully
  const encoded = await image.encode("png");
  assertEquals(encoded.length > 0, true);
});

test("Image: flipHorizontal - basic flip", () => {
  const data = new Uint8Array([
    255, 0, 0, 255, // left: red
    0, 255, 0, 255, // right: green
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.flipHorizontal();

  // Dimensions remain the same
  assertEquals(image.width, 2);
  assertEquals(image.height, 1);

  // Left pixel should now be green (was right)
  assertEquals(image.data[0], 0);
  assertEquals(image.data[1], 255);
  assertEquals(image.data[2], 0);

  // Right pixel should now be red (was left)
  assertEquals(image.data[4], 255);
  assertEquals(image.data[5], 0);
  assertEquals(image.data[6], 0);
});

test("Image: flipVertical - basic flip", () => {
  const data = new Uint8Array([
    255, 0, 0, 255, // top: red
    0, 255, 0, 255, // bottom: green
  ]);

  const image = Image.fromRGBA(1, 2, data);
  image.flipVertical();

  // Dimensions remain the same
  assertEquals(image.width, 1);
  assertEquals(image.height, 2);

  // Top pixel should now be green (was bottom)
  assertEquals(image.data[0], 0);
  assertEquals(image.data[1], 255);
  assertEquals(image.data[2], 0);

  // Bottom pixel should now be red (was top)
  assertEquals(image.data[4], 255);
  assertEquals(image.data[5], 0);
  assertEquals(image.data[6], 0);
});

test("Image: rotation methods are chainable", () => {
  const data = new Uint8Array([
    255, 0, 0, 255,
    0, 255, 0, 255,
  ]);

  const image = Image.fromRGBA(2, 1, data);

  // Chain multiple rotations
  image.rotate90().rotate90().rotate90().rotate90();

  // After 4x90° rotations, should be back to original state
  assertEquals(image.width, 2);
  assertEquals(image.height, 1);
});

test("Image: flip methods are chainable", () => {
  const data = new Uint8Array([
    255, 0, 0, 255,
    0, 255, 0, 255,
  ]);

  const image = Image.fromRGBA(2, 1, data);

  // Chain flip operations
  image.flipHorizontal().flipVertical().flipHorizontal();

  // Should work without errors
  assertEquals(image.width, 2);
  assertEquals(image.height, 1);
});

test("Image: rotation and flip can be combined", () => {
  const data = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (0,1) blue
    255, 255, 0, 255, // (1,1) yellow
  ]);

  const image = Image.fromRGBA(2, 2, data);

  // Rotate and flip
  image.rotate90().flipHorizontal();

  assertEquals(image.width, 2);
  assertEquals(image.height, 2);
});

test("Image: rotation preserves metadata", () => {
  const data = new Uint8Array([
    255, 0, 0, 255,
    0, 255, 0, 255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.setMetadata({ title: "Test Image", author: "Test Author" });

  image.rotate90();

  // Metadata should be preserved
  assertEquals(image.metadata?.title, "Test Image");
  assertEquals(image.metadata?.author, "Test Author");
});

test("Image: rotation updates DPI correctly", () => {
  const data = new Uint8Array([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 0, 255,
  ]);

  const image = Image.fromRGBA(2, 2, data);
  image.setDPI(100, 200); // Different DPI for x and y

  image.rotate90();

  // DPI should swap after rotation
  assertEquals(image.metadata?.dpiX, 200);
  assertEquals(image.metadata?.dpiY, 100);
});

test("Image: rotate90 encodes and decodes correctly", async () => {
  const data = new Uint8Array([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 0, 255,
  ]);

  const image = Image.fromRGBA(2, 2, data);
  image.rotate90();

  // Encode
  const encoded = await image.encode("png");

  // Decode
  const decoded = await Image.decode(encoded);

  // Should maintain rotated dimensions
  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
});
