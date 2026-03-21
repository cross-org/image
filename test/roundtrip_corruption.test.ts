/**
 * Test to verify that pixel data is preserved correctly during roundtrip
 * encode/decode operations, specifically testing for buffer offset corruption
 * issues when using runtime APIs (ImageDecoder/OffscreenCanvas).
 *
 * This addresses issue: "Instances of pixel-offset corruption after decoding/re-encoding"
 */

import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

// Helper to compare pixel data exactly
function pixelDataEqual(data1: Uint8Array, data2: Uint8Array): boolean {
  if (data1.length !== data2.length) return false;
  for (let i = 0; i < data1.length; i++) {
    if (data1[i] !== data2[i]) return false;
  }
  return true;
}

// Helper to compare pixel data with tolerance for lossy formats.
// Instead of requiring every byte to be within tolerance (which is too strict
// for JPEG and can be flaky across runtimes/encoders), we allow a small
// fraction of bytes to exceed the tolerance while still considering the
// images "similar". This is sufficient to catch structural corruption while
// avoiding over-sensitivity to encoder differences.
function pixelDataSimilar(
  data1: Uint8Array,
  data2: Uint8Array,
  tolerance = 5,
): boolean {
  if (data1.length !== data2.length) return false;

  // Allow up to 5% of bytes to exceed the tolerance.
  const maxOutlierRatio = 0.05;
  let outlierCount = 0;

  for (let i = 0; i < data1.length; i++) {
    if (Math.abs(data1[i] - data2[i]) > tolerance) {
      outlierCount++;
      if (outlierCount / data1.length > maxOutlierRatio) {
        return false;
      }
    }
  }
  return true;
}

test("JPEG: roundtrip preserves pixel data structure", async () => {
  // Create a simple test pattern
  const width = 8;
  const height = 8;
  const originalData = new Uint8Array(width * height * 4);

  // Create a recognizable pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      originalData[i] = (x * 32) % 256; // R
      originalData[i + 1] = (y * 32) % 256; // G
      originalData[i + 2] = ((x + y) * 16) % 256; // B
      originalData[i + 3] = 255; // A
    }
  }

  const image = Image.fromRGBA(width, height, originalData);

  // Encode to JPEG
  const jpegData = await image.encode("jpeg", { quality: 95 });

  // Decode back
  const decodedImage = await Image.decode(jpegData, "jpeg");

  // Verify dimensions are correct
  assertEquals(decodedImage.width, width);
  assertEquals(decodedImage.height, height);

  // Verify pixel data is similar (JPEG is lossy, so we allow some tolerance)
  // The key is that the structure should be preserved - if there's buffer offset
  // corruption, the pixel data will be completely scrambled
  const similarity = pixelDataSimilar(
    originalData,
    decodedImage.data,
    30,
  );
  assertEquals(
    similarity,
    true,
    "Pixel data should be similar after JPEG roundtrip (allowing for compression)",
  );

  // Verify first few pixels are in the right ballpark
  // (not completely scrambled which would indicate buffer offset issues)
  const firstPixelR = decodedImage.data[0];
  const firstPixelG = decodedImage.data[1];
  const firstPixelB = decodedImage.data[2];

  // First pixel should be close to (0, 0, 0, 255)
  assertEquals(
    Math.abs(firstPixelR - 0) < 40,
    true,
    `First pixel R should be close to 0, got ${firstPixelR}`,
  );
  assertEquals(
    Math.abs(firstPixelG - 0) < 40,
    true,
    `First pixel G should be close to 0, got ${firstPixelG}`,
  );
  assertEquals(
    Math.abs(firstPixelB - 0) < 40,
    true,
    `First pixel B should be close to 0, got ${firstPixelB}`,
  );
});

test("PNG: roundtrip preserves pixel data exactly", async () => {
  // Create a simple test pattern
  const width = 8;
  const height = 8;
  const originalData = new Uint8Array(width * height * 4);

  // Create a recognizable pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      originalData[i] = (x * 32) % 256; // R
      originalData[i + 1] = (y * 32) % 256; // G
      originalData[i + 2] = ((x + y) * 16) % 256; // B
      originalData[i + 3] = 255; // A
    }
  }

  const image = Image.fromRGBA(width, height, originalData);

  // Encode to PNG
  const pngData = await image.encode("png");

  // Decode back
  const decodedImage = await Image.decode(pngData, "png");

  // Verify dimensions are correct
  assertEquals(decodedImage.width, width);
  assertEquals(decodedImage.height, height);

  // Verify pixel data is exactly the same (PNG is lossless)
  const isEqual = pixelDataEqual(originalData, decodedImage.data);
  assertEquals(
    isEqual,
    true,
    "Pixel data should be exactly the same after PNG roundtrip",
  );
});

test("Multiple roundtrips: JPEG stability", async () => {
  // Create a test pattern
  const width = 16;
  const height = 16;
  const originalData = new Uint8Array(width * height * 4);

  for (let i = 0; i < originalData.length; i += 4) {
    originalData[i] = 128; // R
    originalData[i + 1] = 64; // G
    originalData[i + 2] = 192; // B
    originalData[i + 3] = 255; // A
  }

  let currentImage = Image.fromRGBA(width, height, originalData);

  // Perform multiple roundtrips
  for (let i = 0; i < 3; i++) {
    const encoded = await currentImage.encode("jpeg", { quality: 90 });
    currentImage = await Image.decode(encoded, "jpeg");

    // Verify dimensions remain correct
    assertEquals(currentImage.width, width);
    assertEquals(currentImage.height, height);
  }

  // After 3 roundtrips, pixels should still be in a reasonable range
  // (not completely scrambled which would indicate systematic corruption)
  const finalData = currentImage.data;
  let redSum = 0,
    greenSum = 0,
    blueSum = 0;
  for (let i = 0; i < finalData.length; i += 4) {
    redSum += finalData[i];
    greenSum += finalData[i + 1];
    blueSum += finalData[i + 2];
  }

  const pixelCount = finalData.length / 4;
  const avgRed = redSum / pixelCount;
  const avgGreen = greenSum / pixelCount;
  const avgBlue = blueSum / pixelCount;

  // Averages should be close to original (128, 64, 192)
  assertEquals(
    Math.abs(avgRed - 128) < 50,
    true,
    `Average red should be close to 128, got ${avgRed}`,
  );
  assertEquals(
    Math.abs(avgGreen - 64) < 50,
    true,
    `Average green should be close to 64, got ${avgGreen}`,
  );
  assertEquals(
    Math.abs(avgBlue - 192) < 50,
    true,
    `Average blue should be close to 192, got ${avgBlue}`,
  );

  // Additionally verify a few specific pixel positions to catch offset/stride issues.
  // Because JPEG is lossy, allow a generous per-channel tolerance.
  const channelTolerance = 40;
  const sampleCoords: Array<[number, number]> = [
    [0, 0], // top-left
    [width - 1, 0], // top-right
    [0, height - 1], // bottom-left
    [width - 1, height - 1], // bottom-right
    [Math.floor(width / 2), Math.floor(height / 2)], // center
  ];

  for (const [x, y] of sampleCoords) {
    const idx = (y * width + x) * 4;
    const r = finalData[idx];
    const g = finalData[idx + 1];
    const b = finalData[idx + 2];

    assertEquals(
      Math.abs(r - 128) <= channelTolerance,
      true,
      `Pixel at (${x}, ${y}) has unexpected red channel: ${r}`,
    );
    assertEquals(
      Math.abs(g - 64) <= channelTolerance,
      true,
      `Pixel at (${x}, ${y}) has unexpected green channel: ${g}`,
    );
    assertEquals(
      Math.abs(b - 192) <= channelTolerance,
      true,
      `Pixel at (${x}, ${y}) has unexpected blue channel: ${b}`,
    );
  }
});
