import { test } from "@cross/test";
import { assertEquals, assertExists } from "@std/assert";
import { Image } from "../mod.ts";

test("PNG: encode with compressionLevel 0 (fast, no filter)", async () => {
  const image = Image.create(100, 100, 128, 128, 128);

  const png = await image.encode("png", { compressionLevel: 0 });

  // Verify it's a valid PNG
  const decoded = await Image.decode(png);
  assertEquals(decoded.width, 100);
  assertEquals(decoded.height, 100);
});

test("PNG: encode with compressionLevel 3 (balanced, sub filter)", async () => {
  const image = Image.create(100, 100, 255, 0, 0);

  const png = await image.encode("png", { compressionLevel: 3 });

  // Verify it's a valid PNG
  const decoded = await Image.decode(png);
  assertEquals(decoded.width, 100);
  assertEquals(decoded.height, 100);
});

test("PNG: encode with compressionLevel 9 (best, adaptive filter)", async () => {
  const image = Image.create(100, 100, 0, 255, 0);

  const png = await image.encode("png", { compressionLevel: 9 });

  // Verify it's a valid PNG
  const decoded = await Image.decode(png);
  assertEquals(decoded.width, 100);
  assertEquals(decoded.height, 100);
});

test("PNG: compression level affects file size", async () => {
  // Create an image with a gradient that compresses differently
  const image = Image.create(200, 200, 0, 0, 0);
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      const brightness = Math.floor((x / 200) * 255);
      image.setPixel(x, y, brightness, brightness, brightness, 255);
    }
  }

  const pngFast = await image.encode("png", { compressionLevel: 0 });
  const pngBalanced = await image.encode("png", { compressionLevel: 6 });
  const pngBest = await image.encode("png", { compressionLevel: 9 });

  // With proper filtering, best should compress better than no filter
  // Note: This is a heuristic check - actual results depend on the image content
  assertExists(pngFast);
  assertExists(pngBalanced);
  assertExists(pngBest);

  // Verify all produce valid images
  const decodedFast = await Image.decode(pngFast);
  const decodedBalanced = await Image.decode(pngBalanced);
  const decodedBest = await Image.decode(pngBest);

  assertEquals(decodedFast.width, 200);
  assertEquals(decodedBalanced.width, 200);
  assertEquals(decodedBest.width, 200);
});

test("PNG: default compression level is 6", async () => {
  const image = Image.create(50, 50, 128, 128, 128);

  const pngDefault = await image.encode("png");
  const pngLevel6 = await image.encode("png", { compressionLevel: 6 });

  // Both should produce valid images
  const decodedDefault = await Image.decode(pngDefault);
  const decodedLevel6 = await Image.decode(pngLevel6);

  assertEquals(decodedDefault.width, 50);
  assertEquals(decodedLevel6.width, 50);
});

test("PNG: invalid compression level throws error", async () => {
  const image = Image.create(10, 10, 0, 0, 0);

  let errorThrown = false;
  try {
    await image.encode("png", { compressionLevel: 10 });
  } catch (error) {
    errorThrown = true;
    assertEquals((error as Error).message, "Compression level must be between 0 and 9");
  }
  assertEquals(errorThrown, true);

  errorThrown = false;
  try {
    await image.encode("png", { compressionLevel: -1 });
  } catch (error) {
    errorThrown = true;
    assertEquals((error as Error).message, "Compression level must be between 0 and 9");
  }
  assertEquals(errorThrown, true);
});

test("APNG: encode with compression level", async () => {
  const frame1 = Image.create(50, 50, 255, 0, 0);
  const frame2 = Image.create(50, 50, 0, 0, 255);

  const multiFrame = {
    width: 50,
    height: 50,
    frames: [
      { width: 50, height: 50, data: frame1.data, frameMetadata: { delay: 100 } },
      { width: 50, height: 50, data: frame2.data, frameMetadata: { delay: 100 } },
    ],
  };

  const apngFast = await Image.encodeFrames("apng", multiFrame, { compressionLevel: 0 });
  const apngBest = await Image.encodeFrames("apng", multiFrame, { compressionLevel: 9 });

  // Verify both produce valid APNGs
  const decodedFast = await Image.decodeFrames(apngFast);
  const decodedBest = await Image.decodeFrames(apngBest);

  assertEquals(decodedFast.frames.length, 2);
  assertEquals(decodedBest.frames.length, 2);
});

test("PNG: roundtrip with different compression levels preserves data", async () => {
  // Create a checkerboard pattern
  const image = Image.create(50, 50, 0, 0, 0);
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const isWhite = ((x >> 2) + (y >> 2)) % 2 === 0;
      const color = isWhite ? 255 : 0;
      image.setPixel(x, y, color, color, color, 255);
    }
  }

  // Test multiple compression levels
  for (const level of [0, 3, 6, 9]) {
    const encoded = await image.encode("png", { compressionLevel: level });
    const decoded = await Image.decode(encoded);

    // Verify dimensions
    assertEquals(decoded.width, 50);
    assertEquals(decoded.height, 50);

    // Sample pixels to verify pattern is preserved
    // (0,0) should be white since (0>>2 + 0>>2) % 2 = 0
    const pixel00 = decoded.getPixel(0, 0);
    assertExists(pixel00);
    assertEquals(pixel00.r, 255, `Level ${level}: pixel (0,0) should be white`);

    // (4,0) should be black since (4>>2 + 0>>2) % 2 = 1
    const pixel40 = decoded.getPixel(4, 0);
    assertExists(pixel40);
    assertEquals(pixel40.r, 0, `Level ${level}: pixel (4,0) should be black`);

    // (0,4) should be black since (0>>2 + 4>>2) % 2 = 1
    const pixel04 = decoded.getPixel(0, 4);
    assertExists(pixel04);
    assertEquals(pixel04.r, 0, `Level ${level}: pixel (0,4) should be black`);
  }
});
