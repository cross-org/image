import { assertEquals, assertExists } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Image: resize with fit=stretch (default)", () => {
  const data = new Uint8Array([
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

  const image = Image.fromRGBA(2, 2, data);
  image.resize({ width: 4, height: 4 }); // Default stretch

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);
});

test("Image: resize with fit=fit (letterbox)", () => {
  // 4x2 image resized to 4x4 should become 4x2 centered vertically
  const data = new Uint8Array(4 * 2 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // red
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(4, 2, data);
  image.resize({ width: 4, height: 4, fit: "fit" });

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);

  // Check that top row is transparent (letterbox)
  assertEquals(image.data[3], 0); // alpha should be 0
});

test("Image: resize with fit=contain (alias for fit)", () => {
  const data = new Uint8Array(4 * 2 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(4, 2, data);
  image.resize({ width: 4, height: 4, fit: "contain" });

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);
});

test("Image: resize with fit=fill (crop)", () => {
  // 4x2 image resized to 2x2 should crop to center 2x2
  const data = new Uint8Array(4 * 2 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(4, 2, data);
  image.resize({ width: 2, height: 2, fit: "fill" });

  assertEquals(image.width, 2);
  assertEquals(image.height, 2);
  // Should have red pixels (cropped from center)
  assertEquals(image.data[0], 255);
});

test("Image: resize with fit=cover (alias for fill)", () => {
  const data = new Uint8Array(4 * 2 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(4, 2, data);
  image.resize({ width: 2, height: 2, fit: "cover" });

  assertEquals(image.width, 2);
  assertEquals(image.height, 2);
});

test("Image: resize fit mode with bicubic", () => {
  const data = new Uint8Array(10 * 5 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(10, 5, data);
  image.resize({ width: 8, height: 8, fit: "fit", method: "bicubic" });

  assertEquals(image.width, 8);
  assertEquals(image.height, 8);
});

test("Image: resize fit mode preserves aspect ratio", () => {
  // 4x2 image (2:1 aspect) resized to 8x8
  // Should fit to 8x4 (maintaining 2:1)
  const data = new Uint8Array(4 * 2 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100;
    data[i + 1] = 150;
    data[i + 2] = 200;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(4, 2, data);
  image.resize({ width: 8, height: 8, fit: "fit" });

  assertEquals(image.width, 8);
  assertEquals(image.height, 8);

  // Middle rows should have image content
  const midRowIdx = 4 * 8 * 4; // Row 4, pixel 0
  assertEquals(image.data[midRowIdx + 3] > 0, true); // Not transparent
});

test("Image: resize fill mode crops correctly", () => {
  // 2x4 image (1:2 aspect) resized to 4x4
  // Should resize to 4x8 then crop to 4x4
  const data = new Uint8Array(2 * 4 * 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 2; x++) {
      const idx = (y * 2 + x) * 4;
      data[idx] = y * 60; // Gradient
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  const image = Image.fromRGBA(2, 4, data);
  image.resize({ width: 4, height: 4, fit: "fill" });

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);
});

test("Image: resize fit mode is chainable", () => {
  const data = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(4, 4, data);
  image
    .resize({ width: 8, height: 8, fit: "fit" })
    .brightness(0.1);

  assertEquals(image.width, 8);
  assertEquals(image.height, 8);
});

test("Image: resize with fit mode encodes successfully", async () => {
  const data = new Uint8Array(4 * 2 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 1] = 100;
    data[i + 2] = 50;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(4, 2, data);
  image.resize({ width: 8, height: 8, fit: "fit" });

  const encoded = await image.encode("png");
  assertExists(encoded);
  assertEquals(encoded.length > 0, true);
});

test("Image: resize stretch mode still works (backward compatibility)", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.resize({ width: 4, height: 2, fit: "stretch" });

  assertEquals(image.width, 4);
  assertEquals(image.height, 2);
});

test("Image: resize without fit option defaults to stretch", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.resize({ width: 4, height: 4 }); // No fit specified

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);
});
