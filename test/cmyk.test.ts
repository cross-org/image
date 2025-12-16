import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { cmykToRgb, cmykToRgba, Image, rgbaToCmyk, rgbToCmyk } from "../mod.ts";

test("CMYK: rgbToCmyk - pure colors", () => {
  // Pure red
  const [c1, m1, y1, k1] = rgbToCmyk(255, 0, 0);
  assertEquals(c1, 0);
  assertEquals(m1, 1);
  assertEquals(y1, 1);
  assertEquals(k1, 0);

  // Pure green
  const [c2, m2, y2, k2] = rgbToCmyk(0, 255, 0);
  assertEquals(c2, 1);
  assertEquals(m2, 0);
  assertEquals(y2, 1);
  assertEquals(k2, 0);

  // Pure blue
  const [c3, m3, y3, k3] = rgbToCmyk(0, 0, 255);
  assertEquals(c3, 1);
  assertEquals(m3, 1);
  assertEquals(y3, 0);
  assertEquals(k3, 0);
});

test("CMYK: rgbToCmyk - black and white", () => {
  // Pure black
  const [c1, m1, y1, k1] = rgbToCmyk(0, 0, 0);
  assertEquals(c1, 0);
  assertEquals(m1, 0);
  assertEquals(y1, 0);
  assertEquals(k1, 1);

  // Pure white
  const [c2, m2, y2, k2] = rgbToCmyk(255, 255, 255);
  assertEquals(c2, 0);
  assertEquals(m2, 0);
  assertEquals(y2, 0);
  assertEquals(k2, 0);
});

test("CMYK: cmykToRgb - pure colors", () => {
  // Cyan (should be close to RGB: 0, 255, 255)
  const [r1, g1, b1] = cmykToRgb(1, 0, 0, 0);
  assertEquals(r1, 0);
  assertEquals(g1, 255);
  assertEquals(b1, 255);

  // Magenta (should be close to RGB: 255, 0, 255)
  const [r2, g2, b2] = cmykToRgb(0, 1, 0, 0);
  assertEquals(r2, 255);
  assertEquals(g2, 0);
  assertEquals(b2, 255);

  // Yellow (should be close to RGB: 255, 255, 0)
  const [r3, g3, b3] = cmykToRgb(0, 0, 1, 0);
  assertEquals(r3, 255);
  assertEquals(g3, 255);
  assertEquals(b3, 0);

  // Black
  const [r4, g4, b4] = cmykToRgb(0, 0, 0, 1);
  assertEquals(r4, 0);
  assertEquals(g4, 0);
  assertEquals(b4, 0);
});

test("CMYK: round-trip conversion RGB -> CMYK -> RGB", () => {
  const testColors = [
    [255, 0, 0], // Red
    [0, 255, 0], // Green
    [0, 0, 255], // Blue
    [255, 255, 0], // Yellow
    [255, 0, 255], // Magenta
    [0, 255, 255], // Cyan
    [128, 128, 128], // Gray
    [255, 255, 255], // White
    [0, 0, 0], // Black
    [200, 100, 50], // Random color
  ];

  for (const [r, g, b] of testColors) {
    const [c, m, y, k] = rgbToCmyk(r, g, b);
    const [r2, g2, b2] = cmykToRgb(c, m, y, k);

    // Allow small rounding differences
    assertEquals(Math.abs(r - r2) <= 1, true, `Red mismatch for ${r},${g},${b}: ${r2}`);
    assertEquals(Math.abs(g - g2) <= 1, true, `Green mismatch for ${r},${g},${b}: ${g2}`);
    assertEquals(Math.abs(b - b2) <= 1, true, `Blue mismatch for ${r},${g},${b}: ${b2}`);
  }
});

test("CMYK: rgbaToCmyk - converts image data", () => {
  // Create a 2x2 image with different colors
  const rgbaData = new Uint8Array([
    255,
    0,
    0,
    255, // Red pixel
    0,
    255,
    0,
    255, // Green pixel
    0,
    0,
    255,
    255, // Blue pixel
    255,
    255,
    255,
    255, // White pixel
  ]);

  const cmykData = rgbaToCmyk(rgbaData);

  // Check that we have 4 pixels worth of CMYK data
  assertEquals(cmykData.length, 16); // 4 pixels * 4 components

  // Check red pixel (C=0, M=1, Y=1, K=0)
  assertEquals(cmykData[0], 0);
  assertEquals(cmykData[1], 1);
  assertEquals(cmykData[2], 1);
  assertEquals(cmykData[3], 0);

  // Check green pixel (C=1, M=0, Y=1, K=0)
  assertEquals(cmykData[4], 1);
  assertEquals(cmykData[5], 0);
  assertEquals(cmykData[6], 1);
  assertEquals(cmykData[7], 0);

  // Check blue pixel (C=1, M=1, Y=0, K=0)
  assertEquals(cmykData[8], 1);
  assertEquals(cmykData[9], 1);
  assertEquals(cmykData[10], 0);
  assertEquals(cmykData[11], 0);

  // Check white pixel (C=0, M=0, Y=0, K=0)
  assertEquals(cmykData[12], 0);
  assertEquals(cmykData[13], 0);
  assertEquals(cmykData[14], 0);
  assertEquals(cmykData[15], 0);
});

test("CMYK: cmykToRgba - converts CMYK to RGBA", () => {
  // Create CMYK data for 2 pixels
  const cmykData = new Float32Array([
    0,
    1,
    1,
    0, // Red (C=0, M=1, Y=1, K=0)
    1,
    0,
    0,
    0, // Cyan (C=1, M=0, Y=0, K=0)
  ]);

  const rgbaData = cmykToRgba(cmykData);

  // Check that we have 2 pixels worth of RGBA data
  assertEquals(rgbaData.length, 8); // 2 pixels * 4 components

  // Check red pixel
  assertEquals(rgbaData[0], 255); // R
  assertEquals(rgbaData[1], 0); // G
  assertEquals(rgbaData[2], 0); // B
  assertEquals(rgbaData[3], 255); // A

  // Check cyan pixel
  assertEquals(rgbaData[4], 0); // R
  assertEquals(rgbaData[5], 255); // G
  assertEquals(rgbaData[6], 255); // B
  assertEquals(rgbaData[7], 255); // A
});

test("CMYK: Image.toCMYK - converts image to CMYK", () => {
  // Create a simple 2x2 image
  const image = Image.create(2, 2, 255, 0, 0); // Red image

  const cmykData = image.toCMYK();

  // Check that we have correct amount of data
  assertEquals(cmykData.length, 16); // 4 pixels * 4 components

  // All pixels should be red (C=0, M=1, Y=1, K=0)
  for (let i = 0; i < 4; i++) {
    const idx = i * 4;
    assertEquals(cmykData[idx], 0, `Cyan for pixel ${i}`);
    assertEquals(cmykData[idx + 1], 1, `Magenta for pixel ${i}`);
    assertEquals(cmykData[idx + 2], 1, `Yellow for pixel ${i}`);
    assertEquals(cmykData[idx + 3], 0, `Key for pixel ${i}`);
  }
});

test("CMYK: Image.fromCMYK - creates image from CMYK data", () => {
  // Create CMYK data for a 2x1 image (red and blue pixels)
  const cmykData = new Float32Array([
    0,
    1,
    1,
    0, // Red
    1,
    1,
    0,
    0, // Blue
  ]);

  const image = Image.fromCMYK(cmykData, 2, 1);

  assertEquals(image.width, 2);
  assertEquals(image.height, 1);

  // Check red pixel
  const pixel1 = image.getPixel(0, 0);
  assertEquals(pixel1?.r, 255);
  assertEquals(pixel1?.g, 0);
  assertEquals(pixel1?.b, 0);
  assertEquals(pixel1?.a, 255);

  // Check blue pixel
  const pixel2 = image.getPixel(1, 0);
  assertEquals(pixel2?.r, 0);
  assertEquals(pixel2?.g, 0);
  assertEquals(pixel2?.b, 255);
  assertEquals(pixel2?.a, 255);
});

test("CMYK: Image round-trip RGB -> CMYK -> RGB", () => {
  // Create a colorful test image
  const image = Image.create(3, 1);
  image.setPixel(0, 0, 255, 0, 0, 255); // Red
  image.setPixel(1, 0, 0, 255, 0, 255); // Green
  image.setPixel(2, 0, 0, 0, 255, 255); // Blue

  // Convert to CMYK and back
  const cmykData = image.toCMYK();
  const restored = Image.fromCMYK(cmykData, 3, 1);

  // Check that colors are preserved (allowing for small rounding errors)
  const p1 = restored.getPixel(0, 0);
  assertEquals(Math.abs(p1!.r - 255) <= 1, true);
  assertEquals(Math.abs(p1!.g - 0) <= 1, true);
  assertEquals(Math.abs(p1!.b - 0) <= 1, true);

  const p2 = restored.getPixel(1, 0);
  assertEquals(Math.abs(p2!.r - 0) <= 1, true);
  assertEquals(Math.abs(p2!.g - 255) <= 1, true);
  assertEquals(Math.abs(p2!.b - 0) <= 1, true);

  const p3 = restored.getPixel(2, 0);
  assertEquals(Math.abs(p3!.r - 0) <= 1, true);
  assertEquals(Math.abs(p3!.g - 0) <= 1, true);
  assertEquals(Math.abs(p3!.b - 255) <= 1, true);
});

test("CMYK: cmykToRgba with custom alpha", () => {
  const cmykData = new Float32Array([
    0,
    0,
    0,
    0, // White
  ]);

  const rgbaData = cmykToRgba(cmykData, 128); // Half opacity

  assertEquals(rgbaData[0], 255); // R
  assertEquals(rgbaData[1], 255); // G
  assertEquals(rgbaData[2], 255); // B
  assertEquals(rgbaData[3], 128); // A
});

test("CMYK: Image.fromCMYK with custom alpha", () => {
  const cmykData = new Float32Array([
    0,
    0,
    0,
    0, // White
  ]);

  const image = Image.fromCMYK(cmykData, 1, 1, 100);

  const pixel = image.getPixel(0, 0);
  assertEquals(pixel?.r, 255);
  assertEquals(pixel?.g, 255);
  assertEquals(pixel?.b, 255);
  assertEquals(pixel?.a, 100);
});
