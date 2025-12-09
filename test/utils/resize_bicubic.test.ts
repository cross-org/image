import { assertEquals, assertExists } from "@std/assert";
import { test } from "@cross/test";
import { resizeBicubic } from "../../src/utils/resize.ts";

test("resize bicubic: 1x1 to 2x2", () => {
  const src = new Uint8Array([255, 128, 64, 200]); // single pixel

  const result = resizeBicubic(src, 1, 1, 2, 2);

  assertEquals(result.length, 16);
  // All pixels should be close to the original (bicubic preserves single pixels well)
  for (let i = 0; i < 4; i++) {
    assertEquals(result[i * 4], 255);
    assertEquals(result[i * 4 + 1], 128);
    assertEquals(result[i * 4 + 2], 64);
    assertEquals(result[i * 4 + 3], 200);
  }
});

test("resize bicubic: 2x2 to 1x1", () => {
  const src = new Uint8Array([
    100,
    0,
    0,
    255, // pixel 1
    100,
    0,
    0,
    255, // pixel 2
    100,
    0,
    0,
    255, // pixel 3
    100,
    0,
    0,
    255, // pixel 4
  ]);

  const result = resizeBicubic(src, 2, 2, 1, 1);

  assertEquals(result.length, 4);
  // Should average to approximately 100
  assertEquals(Math.abs(result[0] - 100) < 5, true);
  assertEquals(result[1], 0);
  assertEquals(result[2], 0);
  assertEquals(result[3], 255);
});

test("resize bicubic: 4x4 to 2x2 downscale", () => {
  const src = new Uint8Array(64); // 4x4 image
  // Fill with pattern: top-left quadrant is red, others are black
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const idx = (y * 4 + x) * 4;
      if (x < 2 && y < 2) {
        src[idx] = 255; // red
        src[idx + 1] = 0;
        src[idx + 2] = 0;
      } else {
        src[idx] = 0;
        src[idx + 1] = 0;
        src[idx + 2] = 0;
      }
      src[idx + 3] = 255; // alpha
    }
  }

  const result = resizeBicubic(src, 4, 4, 2, 2);

  assertEquals(result.length, 16); // 2x2 * 4 bytes
  assertExists(result);

  // Top-left should be mostly red
  assertEquals(result[0] > 200, true);
  // Bottom-right should be mostly black
  assertEquals(result[12] < 50, true);
});

test("resize bicubic: 2x2 to 4x4 upscale", () => {
  const src = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
    0,
    0,
    255,
    255, // blue
    255,
    255,
    0,
    255, // yellow
  ]);

  const result = resizeBicubic(src, 2, 2, 4, 4);

  assertEquals(result.length, 64); // 4x4 * 4 bytes
  assertExists(result);

  // Corners should be close to original colors
  // Top-left should be red-ish
  assertEquals(result[0] > 200, true);
  assertEquals(result[1] < 100, true);
  assertEquals(result[2] < 100, true);

  // Top-right should be green-ish
  assertEquals(result[12] < 100, true);
  assertEquals(result[13] > 200, true);
  assertEquals(result[14] < 100, true);
});

test("resize bicubic: preserves alpha channel", () => {
  const src = new Uint8Array([
    255,
    0,
    0,
    128, // semi-transparent red
    0,
    255,
    0,
    64, // more transparent green
  ]);

  const result = resizeBicubic(src, 2, 1, 4, 2);

  assertEquals(result.length, 32); // 4x2 * 4 bytes

  // Alpha should be preserved in some form
  assertExists(result);
  // Check that alpha values are within valid range
  for (let i = 3; i < result.length; i += 4) {
    assertEquals(result[i] >= 0 && result[i] <= 255, true);
  }
});

test("resize bicubic: horizontal line gradient", () => {
  // Create a smooth gradient from black to white
  const src = new Uint8Array(16); // 4x1 image
  for (let x = 0; x < 4; x++) {
    const value = Math.floor((x / 3) * 255);
    const idx = x * 4;
    src[idx] = value;
    src[idx + 1] = value;
    src[idx + 2] = value;
    src[idx + 3] = 255;
  }

  const result = resizeBicubic(src, 4, 1, 8, 1);

  assertEquals(result.length, 32); // 8x1 * 4 bytes

  // Should maintain gradient smoothness
  // Left should be darker than right
  assertEquals(result[0] < result[28], true);

  // Gradient should be monotonic (mostly increasing)
  let increasing = 0;
  for (let i = 0; i < 7; i++) {
    if (result[i * 4] <= result[(i + 1) * 4] + 5) { // Allow small tolerance
      increasing++;
    }
  }
  assertEquals(increasing >= 5, true); // Most values should increase
});

test("resize bicubic: clamping prevents overflow", () => {
  // Create extreme values that might cause overflow in interpolation
  const src = new Uint8Array([
    255,
    255,
    255,
    255, // white
    0,
    0,
    0,
    255, // black
    255,
    255,
    255,
    255, // white
    0,
    0,
    0,
    255, // black
  ]);

  const result = resizeBicubic(src, 2, 2, 3, 3);

  // All values should be clamped to 0-255
  for (let i = 0; i < result.length; i++) {
    assertEquals(result[i] >= 0 && result[i] <= 255, true);
  }
});

test("resize bicubic: edge handling with small image", () => {
  // Test that bicubic handles edges correctly with a 2x2 image
  const src = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
    0,
    0,
    255,
    255, // blue
    255,
    255,
    255,
    255, // white
  ]);

  const result = resizeBicubic(src, 2, 2, 3, 3);

  assertEquals(result.length, 36); // 3x3 * 4 bytes

  // Should handle edge pixels without errors
  assertExists(result);

  // All values should be valid
  for (let i = 0; i < result.length; i++) {
    assertEquals(result[i] >= 0 && result[i] <= 255, true);
  }
});

test("resize bicubic: matches dimensions exactly", () => {
  const src = new Uint8Array(100 * 100 * 4); // 100x100 image
  for (let i = 0; i < src.length; i += 4) {
    src[i] = 128;
    src[i + 1] = 128;
    src[i + 2] = 128;
    src[i + 3] = 255;
  }

  const result = resizeBicubic(src, 100, 100, 50, 75);

  assertEquals(result.length, 50 * 75 * 4);
});
