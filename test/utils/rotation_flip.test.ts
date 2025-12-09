import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import {
  flipHorizontal,
  flipVertical,
  rotate90,
  rotate180,
  rotate270,
} from "../../src/utils/image_processing.ts";

test("rotate90: 2x3 image rotates correctly", () => {
  // Create a 2x3 image with distinct colors
  const src = new Uint8Array([
    // Row 0
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    // Row 1
    0, 0, 255, 255, // (0,1) blue
    255, 255, 0, 255, // (1,1) yellow
    // Row 2
    255, 0, 255, 255, // (0,2) magenta
    0, 255, 255, 255, // (1,2) cyan
  ]);

  const result = rotate90(src, 2, 3);

  // After 90° CW rotation, dimensions swap: 2x3 -> 3x2
  assertEquals(result.width, 3);
  assertEquals(result.height, 2);

  // Check rotated pixels
  // (0,0) red should move to (2,0)
  assertEquals(result.data[8], 255); // R at (2,0)
  assertEquals(result.data[9], 0); // G at (2,0)
  assertEquals(result.data[10], 0); // B at (2,0)

  // (1,0) green should move to (2,1)
  assertEquals(result.data[20], 0); // R at (2,1)
  assertEquals(result.data[21], 255); // G at (2,1)
  assertEquals(result.data[22], 0); // B at (2,1)
});

test("rotate90: 1x1 image remains unchanged", () => {
  const src = new Uint8Array([128, 64, 32, 255]);
  const result = rotate90(src, 1, 1);

  assertEquals(result.width, 1);
  assertEquals(result.height, 1);
  assertEquals(result.data[0], 128);
  assertEquals(result.data[1], 64);
  assertEquals(result.data[2], 32);
  assertEquals(result.data[3], 255);
});

test("rotate180: 2x2 image rotates correctly", () => {
  const src = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (0,1) blue
    255, 255, 0, 255, // (1,1) yellow
  ]);

  const result = rotate180(src, 2, 2);

  // After 180° rotation, (0,0) moves to (1,1)
  assertEquals(result[12], 255); // R at (1,1)
  assertEquals(result[13], 0); // G at (1,1)
  assertEquals(result[14], 0); // B at (1,1)

  // (1,1) moves to (0,0)
  assertEquals(result[0], 255); // R at (0,0)
  assertEquals(result[1], 255); // G at (0,0)
  assertEquals(result[2], 0); // B at (0,0)
});

test("rotate270: 3x2 image rotates correctly", () => {
  // Create a 3x2 image
  const src = new Uint8Array([
    // Row 0
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (2,0) blue
    // Row 1
    255, 255, 0, 255, // (0,1) yellow
    255, 0, 255, 255, // (1,1) magenta
    0, 255, 255, 255, // (2,1) cyan
  ]);

  const result = rotate270(src, 3, 2);

  // After 270° CW rotation (90° CCW), dimensions swap: 3x2 -> 2x3
  assertEquals(result.width, 2);
  assertEquals(result.height, 3);

  // Check specific pixels
  // (0,0) red should move to (0,2)
  assertEquals(result.data[16], 255); // R at (0,2)
  assertEquals(result.data[17], 0); // G at (0,2)
  assertEquals(result.data[18], 0); // B at (0,2)
});

test("flipHorizontal: 2x2 image flips correctly", () => {
  const src = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (0,1) blue
    255, 255, 0, 255, // (1,1) yellow
  ]);

  const result = flipHorizontal(src, 2, 2);

  // After horizontal flip, (0,0) becomes (1,0)
  assertEquals(result[4], 255); // R at (1,0) should be red
  assertEquals(result[5], 0); // G
  assertEquals(result[6], 0); // B

  // (1,0) becomes (0,0)
  assertEquals(result[0], 0); // R at (0,0) should be green
  assertEquals(result[1], 255); // G
  assertEquals(result[2], 0); // B
});

test("flipHorizontal: 3x1 image flips correctly", () => {
  const src = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (2,0) blue
  ]);

  const result = flipHorizontal(src, 3, 1);

  // First pixel should become last
  assertEquals(result[8], 255); // R at (2,0) should be red
  assertEquals(result[9], 0); // G
  assertEquals(result[10], 0); // B

  // Last pixel should become first
  assertEquals(result[0], 0); // R at (0,0) should be blue
  assertEquals(result[1], 0); // G
  assertEquals(result[2], 255); // B
});

test("flipVertical: 2x2 image flips correctly", () => {
  const src = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (0,1) blue
    255, 255, 0, 255, // (1,1) yellow
  ]);

  const result = flipVertical(src, 2, 2);

  // After vertical flip, (0,0) becomes (0,1)
  assertEquals(result[8], 255); // R at (0,1) should be red
  assertEquals(result[9], 0); // G
  assertEquals(result[10], 0); // B

  // (0,1) becomes (0,0)
  assertEquals(result[0], 0); // R at (0,0) should be blue
  assertEquals(result[1], 0); // G
  assertEquals(result[2], 255); // B
});

test("flipVertical: 1x3 image flips correctly", () => {
  const src = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (0,1) green
    0, 0, 255, 255, // (0,2) blue
  ]);

  const result = flipVertical(src, 1, 3);

  // Top pixel should become bottom
  assertEquals(result[8], 255); // R at (0,2) should be red
  assertEquals(result[9], 0); // G
  assertEquals(result[10], 0); // B

  // Bottom pixel should become top
  assertEquals(result[0], 0); // R at (0,0) should be blue
  assertEquals(result[1], 0); // G
  assertEquals(result[2], 255); // B
});

test("rotation and flip preserve alpha channel", () => {
  const src = new Uint8Array([
    255, 0, 0, 128, // semi-transparent red
    0, 255, 0, 64, // more transparent green
  ]);

  const rotated = rotate90(src, 2, 1);
  assertEquals(rotated.data[3], 128); // Alpha preserved
  assertEquals(rotated.data[7], 64); // Alpha preserved

  const flippedH = flipHorizontal(src, 2, 1);
  assertEquals(flippedH[3], 64); // Alpha swapped
  assertEquals(flippedH[7], 128); // Alpha swapped

  const rotated180 = rotate180(src, 2, 1);
  assertEquals(rotated180[3], 64); // Alpha swapped
  assertEquals(rotated180[7], 128); // Alpha swapped
});
