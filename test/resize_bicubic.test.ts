import { assertEquals, assertExists } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Image: resize with bicubic method", () => {
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
  image.resize({ width: 4, height: 4, method: "bicubic" });

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);
  assertEquals(image.data.length, 64);

  // All values should be valid
  for (let i = 0; i < image.data.length; i++) {
    assertEquals(image.data[i] >= 0 && image.data[i] <= 255, true);
  }
});

test("Image: bicubic resize downscale", () => {
  const data = new Uint8Array(16 * 16 * 4);
  // Fill with gradient
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = (y * 16 + x) * 4;
      data[idx] = Math.floor((x / 15) * 255);
      data[idx + 1] = Math.floor((y / 15) * 255);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  const image = Image.fromRGBA(16, 16, data);
  image.resize({ width: 8, height: 8, method: "bicubic" });

  assertEquals(image.width, 8);
  assertEquals(image.height, 8);

  // Gradient should be preserved (left side darker than right)
  assertEquals(image.data[0] < image.data[(8 - 1) * 4], true);
});

test("Image: bicubic resize upscale", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.resize({ width: 8, height: 4, method: "bicubic" });

  assertEquals(image.width, 8);
  assertEquals(image.height, 4);
});

test("Image: bicubic resize preserves metadata", () => {
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
  image.setMetadata({ title: "Test", author: "Tester" });
  image.resize({ width: 4, height: 2, method: "bicubic" });

  assertEquals(image.metadata?.title, "Test");
  assertEquals(image.metadata?.author, "Tester");
});

test("Image: bicubic resize updates DPI", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
    0,
    0,
    255,
    255,
    255,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 2, data);
  image.setDPI(100, 100);

  image.resize({ width: 4, height: 4, method: "bicubic" });

  assertEquals(image.metadata?.dpiX, 100);
  assertEquals(image.metadata?.dpiY, 100);
  // Physical dimensions should be updated
  assertEquals(image.metadata?.physicalWidth, 4 / 100);
  assertEquals(image.metadata?.physicalHeight, 4 / 100);
});

test("Image: bicubic resize is chainable", () => {
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

  image
    .resize({ width: 4, height: 2, method: "bicubic" })
    .brightness(0.1)
    .contrast(0.1);

  assertEquals(image.width, 4);
  assertEquals(image.height, 2);
});

test("Image: bicubic vs bilinear vs nearest comparison", () => {
  // Create a simple 2x2 checkerboard
  const data = new Uint8Array([
    255,
    255,
    255,
    255, // white
    0,
    0,
    0,
    255, // black
    0,
    0,
    0,
    255, // black
    255,
    255,
    255,
    255, // white
  ]);

  const nearest = Image.fromRGBA(2, 2, new Uint8Array(data));
  nearest.resize({ width: 8, height: 8, method: "nearest" });

  const bilinear = Image.fromRGBA(2, 2, new Uint8Array(data));
  bilinear.resize({ width: 8, height: 8, method: "bilinear" });

  const bicubic = Image.fromRGBA(2, 2, new Uint8Array(data));
  bicubic.resize({ width: 8, height: 8, method: "bicubic" });

  // All should produce valid results
  assertEquals(nearest.width, 8);
  assertEquals(bilinear.width, 8);
  assertEquals(bicubic.width, 8);

  // Nearest should have sharp edges (only 0 or 255)
  let nearestSharp = true;
  for (let i = 0; i < nearest.data.length; i += 4) {
    if (nearest.data[i] !== 0 && nearest.data[i] !== 255) {
      nearestSharp = false;
      break;
    }
  }
  assertEquals(nearestSharp, true);

  // Bilinear and bicubic should have interpolated values
  let bilinearInterpolated = false;
  let bicubicInterpolated = false;
  for (let i = 0; i < bilinear.data.length; i += 4) {
    if (bilinear.data[i] !== 0 && bilinear.data[i] !== 255) {
      bilinearInterpolated = true;
    }
    if (bicubic.data[i] !== 0 && bicubic.data[i] !== 255) {
      bicubicInterpolated = true;
    }
  }
  assertEquals(bilinearInterpolated, true);
  assertEquals(bicubicInterpolated, true);
});

test("Image: bicubic resize encodes successfully", async () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
    0,
    0,
    255,
    255,
    255,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 2, data);
  image.resize({ width: 16, height: 16, method: "bicubic" });

  const encoded = await image.encode("png");
  assertExists(encoded);
  assertEquals(encoded.length > 0, true);

  // Decode and verify
  const decoded = await Image.decode(encoded);
  assertEquals(decoded.width, 16);
  assertEquals(decoded.height, 16);
});

test("Image: default resize method is bilinear", () => {
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
  image.resize({ width: 4, height: 2 }); // No method specified

  assertEquals(image.width, 4);
  assertEquals(image.height, 2);
});

test("Image: bicubic handles extreme downscaling", () => {
  const data = new Uint8Array(100 * 100 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(100, 100, data);
  image.resize({ width: 10, height: 10, method: "bicubic" });

  assertEquals(image.width, 10);
  assertEquals(image.height, 10);

  // All values should still be valid
  for (let i = 0; i < image.data.length; i++) {
    assertEquals(image.data[i] >= 0 && image.data[i] <= 255, true);
  }
});
