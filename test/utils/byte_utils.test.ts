import { test } from "@cross/test";
import { assertEquals } from "@std/assert";
import { clamp, clampRgb } from "../../src/utils/byte_utils.ts";

test("clampRgb - clamps values to RGB range [0, 255]", () => {
  // Values within range
  assertEquals(clampRgb(0), 0);
  assertEquals(clampRgb(127), 127);
  assertEquals(clampRgb(255), 255);

  // Values below range
  assertEquals(clampRgb(-1), 0);
  assertEquals(clampRgb(-100), 0);
  assertEquals(clampRgb(-Infinity), 0);

  // Values above range
  assertEquals(clampRgb(256), 255);
  assertEquals(clampRgb(300), 255);
  assertEquals(clampRgb(1000), 255);
  assertEquals(clampRgb(Infinity), 255);

  // Floating point values
  assertEquals(clampRgb(127.5), 127.5);
  assertEquals(clampRgb(255.9), 255);
  assertEquals(clampRgb(-0.5), 0);
});

test("clamp - clamps values to specified range [min, max]", () => {
  // Values within range
  assertEquals(clamp(5, 0, 10), 5);
  assertEquals(clamp(0.5, 0, 1), 0.5);
  assertEquals(clamp(-0.5, -1, 1), -0.5);

  // Values below range
  assertEquals(clamp(-5, 0, 10), 0);
  assertEquals(clamp(-2, -1, 1), -1);
  assertEquals(clamp(-Infinity, 0, 100), 0);

  // Values above range
  assertEquals(clamp(15, 0, 10), 10);
  assertEquals(clamp(2, -1, 1), 1);
  assertEquals(clamp(Infinity, 0, 100), 100);

  // Edge cases
  assertEquals(clamp(0, 0, 0), 0);
  assertEquals(clamp(1, 0, 0), 0);
  assertEquals(clamp(-1, 0, 0), 0);

  // Negative ranges
  assertEquals(clamp(-5, -10, -1), -5);
  assertEquals(clamp(-15, -10, -1), -10);
  assertEquals(clamp(0, -10, -1), -1);

  // Floating point ranges
  assertEquals(clamp(0.5, 0.0, 1.0), 0.5);
  assertEquals(clamp(1.5, 0.0, 1.0), 1.0);
  assertEquals(clamp(-0.5, 0.0, 1.0), 0.0);
});

test("clamp - handles zero-width ranges", () => {
  assertEquals(clamp(5, 10, 10), 10);
  assertEquals(clamp(-5, -10, -10), -10);
});

test("clampRgb - handles NaN", () => {
  // NaN behavior depends on Math.max/Math.min
  const result = clampRgb(NaN);
  assertEquals(Number.isNaN(result), true);
});

test("clamp - handles NaN", () => {
  // NaN behavior depends on Math.max/Math.min
  const result = clamp(NaN, 0, 100);
  assertEquals(Number.isNaN(result), true);
});
