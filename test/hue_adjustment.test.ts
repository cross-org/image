import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Hue adjustment: no change with 0 degrees", () => {
  // Create a simple red, green, blue image
  const image = Image.create(3, 1, 0, 0, 0);
  const data = image.data;

  // Set RGB pixels
  data[0] = 255;
  data[1] = 0;
  data[2] = 0;
  data[3] = 255; // Red
  data[4] = 0;
  data[5] = 255;
  data[6] = 0;
  data[7] = 255; // Green
  data[8] = 0;
  data[9] = 0;
  data[10] = 255;
  data[11] = 255; // Blue

  const original = new Uint8Array(data);

  // Apply hue adjustment of 0 degrees (no change)
  image.hue(0);

  // Check that pixels remain unchanged
  assertEquals(image.data[0], original[0]);
  assertEquals(image.data[1], original[1]);
  assertEquals(image.data[2], original[2]);
  assertEquals(image.data[4], original[4]);
  assertEquals(image.data[5], original[5]);
  assertEquals(image.data[6], original[6]);
  assertEquals(image.data[8], original[8]);
  assertEquals(image.data[9], original[9]);
  assertEquals(image.data[10], original[10]);
});

test("Hue adjustment: 120 degree rotation shifts red to green", () => {
  // Create a pure red pixel
  const image = Image.create(1, 1, 255, 0, 0);

  // Rotate hue by 120 degrees (red -> green)
  image.hue(120);

  const data = image.data;

  // Red (hue ~0°) rotated 120° should become green (hue ~120°)
  // Allow some tolerance due to RGB<->HSL conversion rounding
  assertEquals(
    Math.abs(data[0] - 0) < 5,
    true,
    `R should be ~0, got ${data[0]}`,
  );
  assertEquals(
    Math.abs(data[1] - 255) < 5,
    true,
    `G should be ~255, got ${data[1]}`,
  );
  assertEquals(
    Math.abs(data[2] - 0) < 5,
    true,
    `B should be ~0, got ${data[2]}`,
  );
  assertEquals(data[3], 255); // Alpha unchanged
});

test("Hue adjustment: 240 degree rotation shifts red to blue", () => {
  // Create a pure red pixel
  const image = Image.create(1, 1, 255, 0, 0);

  // Rotate hue by 240 degrees (red -> blue)
  image.hue(240);

  const data = image.data;

  // Red (hue ~0°) rotated 240° should become blue (hue ~240°)
  assertEquals(
    Math.abs(data[0] - 0) < 5,
    true,
    `R should be ~0, got ${data[0]}`,
  );
  assertEquals(
    Math.abs(data[1] - 0) < 5,
    true,
    `G should be ~0, got ${data[1]}`,
  );
  assertEquals(
    Math.abs(data[2] - 255) < 5,
    true,
    `B should be ~255, got ${data[2]}`,
  );
  assertEquals(data[3], 255);
});

test("Hue adjustment: -120 degree rotation shifts red to blue", () => {
  // Create a pure red pixel
  const image = Image.create(1, 1, 255, 0, 0);

  // Rotate hue by -120 degrees (red -> blue, going backwards)
  image.hue(-120);

  const data = image.data;

  // Red rotated -120° should become blue (same as +240°)
  assertEquals(
    Math.abs(data[0] - 0) < 5,
    true,
    `R should be ~0, got ${data[0]}`,
  );
  assertEquals(
    Math.abs(data[1] - 0) < 5,
    true,
    `G should be ~0, got ${data[1]}`,
  );
  assertEquals(
    Math.abs(data[2] - 255) < 5,
    true,
    `B should be ~255, got ${data[2]}`,
  );
  assertEquals(data[3], 255);
});

test("Hue adjustment: 360 degree rotation is full circle", () => {
  // Create a red pixel
  const image = Image.create(1, 1, 255, 0, 0);
  const original = new Uint8Array(image.data);

  // Rotate hue by 360 degrees (full circle, should return to original)
  image.hue(360);

  const data = image.data;

  // Should be back to red (with possible small rounding errors)
  assertEquals(Math.abs(data[0] - original[0]) < 5, true);
  assertEquals(Math.abs(data[1] - original[1]) < 5, true);
  assertEquals(Math.abs(data[2] - original[2]) < 5, true);
  assertEquals(data[3], 255);
});

test("Hue adjustment: grayscale pixels remain unchanged", () => {
  // Create grayscale pixels (no saturation, so hue doesn't matter)
  const image = Image.create(3, 1, 0, 0, 0);
  const data = image.data;

  // Set grayscale values
  data[0] = 0;
  data[1] = 0;
  data[2] = 0;
  data[3] = 255; // Black
  data[4] = 128;
  data[5] = 128;
  data[6] = 128;
  data[7] = 255; // Gray
  data[8] = 255;
  data[9] = 255;
  data[10] = 255;
  data[11] = 255; // White

  const original = new Uint8Array(data);

  // Apply hue adjustment
  image.hue(120);

  // Grayscale pixels should remain unchanged
  assertEquals(image.data[0], original[0]);
  assertEquals(image.data[1], original[1]);
  assertEquals(image.data[2], original[2]);
  assertEquals(image.data[4], original[4]);
  assertEquals(image.data[5], original[5]);
  assertEquals(image.data[6], original[6]);
  assertEquals(image.data[8], original[8]);
  assertEquals(image.data[9], original[9]);
  assertEquals(image.data[10], original[10]);
});

test("Hue adjustment: alpha channel is preserved", () => {
  // Create pixels with different alpha values
  const image = Image.create(3, 1, 255, 0, 0);
  const data = image.data;

  data[3] = 255; // Full opacity
  data[7] = 128; // Half opacity
  data[11] = 0; // Transparent

  // Apply hue adjustment
  image.hue(60);

  // Alpha should be preserved
  assertEquals(image.data[3], 255);
  assertEquals(image.data[7], 128);
  assertEquals(image.data[11], 0);
});

test("Hue adjustment: chainable with other operations", () => {
  // Create a red image
  const image = Image.create(2, 2, 255, 0, 0);

  // Chain multiple operations including hue
  image
    .hue(120) // Shift to green
    .brightness(0.1) // Brighten
    .saturation(0.2); // Increase saturation

  // Should succeed without errors and return the image
  assertEquals(image.width, 2);
  assertEquals(image.height, 2);

  // Green channel should be dominant now
  const data = image.data;
  assertEquals(data[1] > data[0], true, "Green should be greater than red");
  assertEquals(data[1] > data[2], true, "Green should be greater than blue");
});

test("Hue adjustment: works with desaturated colors", () => {
  // Create a desaturated red (pink-ish)
  const image = Image.create(1, 1, 200, 100, 100);

  // Apply hue rotation
  image.hue(120);

  const data = image.data;

  // Should shift towards green but maintain the desaturated quality
  // Green channel should now be dominant
  assertEquals(
    data[1] > data[0],
    true,
    "Green should be greater than red after rotation",
  );
  assertEquals(
    data[1] > data[2],
    true,
    "Green should be greater than blue after rotation",
  );
});

test("Hue adjustment: handles large rotation values", () => {
  // Create a red pixel
  const image = Image.create(1, 1, 255, 0, 0);

  // Apply large rotation (should wrap around)
  image.hue(480); // 480 = 360 + 120, equivalent to 120

  const data = image.data;

  // Should be same as rotating 120 degrees
  assertEquals(Math.abs(data[0] - 0) < 5, true);
  assertEquals(Math.abs(data[1] - 255) < 5, true);
  assertEquals(Math.abs(data[2] - 0) < 5, true);
});

test("Hue adjustment: handles negative rotation values", () => {
  // Create a green pixel
  const image = Image.create(1, 1, 0, 255, 0);

  // Apply negative rotation
  image.hue(-240); // -240 = +120

  const data = image.data;

  // Green rotated -240° (or +120°) should become blue
  assertEquals(Math.abs(data[0] - 0) < 5, true);
  assertEquals(Math.abs(data[1] - 0) < 5, true);
  assertEquals(Math.abs(data[2] - 255) < 5, true);
});

test("Hue adjustment: preserves image dimensions", () => {
  const image = Image.create(100, 50, 255, 128, 0);

  image.hue(45);

  assertEquals(image.width, 100);
  assertEquals(image.height, 50);
});
