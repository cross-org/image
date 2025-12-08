import { assertEquals, assertExists } from "@std/assert";
import { test } from "@cross/test";
import { resizeBilinear, resizeNearest } from "../../src/utils/resize.ts";

test("resize: nearest neighbor - simple 2x2 to 1x1", () => {
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

  const result = resizeNearest(src, 2, 2, 1, 1);

  assertEquals(result.length, 4);
  // Should pick top-left pixel (red)
  assertEquals(result[0], 255);
  assertEquals(result[1], 0);
  assertEquals(result[2], 0);
  assertEquals(result[3], 255);
});

test("resize: nearest neighbor - upscaling 1x1 to 2x2", () => {
  const src = new Uint8Array([255, 128, 64, 255]); // single pixel

  const result = resizeNearest(src, 1, 1, 2, 2);

  assertEquals(result.length, 16);
  // All pixels should be the same
  for (let i = 0; i < 4; i++) {
    assertEquals(result[i * 4], 255);
    assertEquals(result[i * 4 + 1], 128);
    assertEquals(result[i * 4 + 2], 64);
    assertEquals(result[i * 4 + 3], 255);
  }
});

test("resize: bilinear - simple 2x2 to 1x1", () => {
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

  const result = resizeBilinear(src, 2, 2, 1, 1);

  assertEquals(result.length, 4);
  // Should average all pixels
  assertEquals(result[0], 100);
  assertEquals(result[1], 0);
  assertEquals(result[2], 0);
  assertEquals(result[3], 255);
});

test("resize: bilinear - upscaling 1x1 to 2x2", () => {
  const src = new Uint8Array([255, 128, 64, 200]); // single pixel

  const result = resizeBilinear(src, 1, 1, 2, 2);

  assertEquals(result.length, 16);
  // All pixels should be the same
  for (let i = 0; i < 4; i++) {
    assertEquals(result[i * 4], 255);
    assertEquals(result[i * 4 + 1], 128);
    assertEquals(result[i * 4 + 2], 64);
    assertEquals(result[i * 4 + 3], 200);
  }
});

test("resize: bilinear - 2x2 to 4x4", () => {
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

  const result = resizeBilinear(src, 2, 2, 4, 4);

  assertEquals(result.length, 64); // 4x4 * 4 bytes
  assertExists(result);
});

test("resize: nearest - 4x4 to 2x2", () => {
  const src = new Uint8Array(64); // 4x4 image
  for (let i = 0; i < 64; i += 4) {
    src[i] = 255; // red channel
    src[i + 3] = 255; // alpha channel
  }

  const result = resizeNearest(src, 4, 4, 2, 2);

  assertEquals(result.length, 16); // 2x2 * 4 bytes
  // Check that we have valid data
  assertEquals(result[0], 255);
  assertEquals(result[3], 255);
});
