import { assertEquals, assertRejects } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { GIFFormat } from "../src/formats/gif.ts";
import type { ImageData } from "../src/types.ts";

// Color validation thresholds for GIF quantization tests
const MIN_RED_THRESHOLD = 200;
const MAX_GREEN_BLUE_THRESHOLD = 50;

test("GIF: canDecode - valid GIF89a signature", () => {
  const validGIF = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61,
    0,
    0,
    0,
    0,
  ]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(validGIF), true);
});

test("GIF: canDecode - valid GIF87a signature", () => {
  const validGIF = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x37,
    0x61,
    0,
    0,
    0,
    0,
  ]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(validGIF), true);
});

test("GIF: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("GIF: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x47, 0x49, 0x46]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("GIF: decode - invalid data throws", async () => {
  const format = new GIFFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid GIF signature",
  );
});

test("GIF: properties", () => {
  const format = new GIFFormat();

  assertEquals(format.name, "gif");
  assertEquals(format.mimeType, "image/gif");
});

test("GIF: encode and decode - simple solid color", async () => {
  const format = new GIFFormat();

  // Create a simple 2x2 red image
  const width = 2;
  const height = 2;
  const data = new Uint8Array(width * height * 4);

  // Fill with red color
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 255; // A
  }

  const imageData: ImageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Check dimensions
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Check that all pixels are approximately red
  // (allow for color quantization in GIF encoding)
  for (let i = 0; i < decoded.data.length; i += 4) {
    const r = decoded.data[i];
    const g = decoded.data[i + 1];
    const b = decoded.data[i + 2];

    // Red should be dominant
    assertEquals(
      r > MIN_RED_THRESHOLD,
      true,
      `Pixel ${i / 4}: Red channel should be > ${MIN_RED_THRESHOLD}, got ${r}`,
    );
    assertEquals(
      g < MAX_GREEN_BLUE_THRESHOLD,
      true,
      `Pixel ${
        i / 4
      }: Green channel should be < ${MAX_GREEN_BLUE_THRESHOLD}, got ${g}`,
    );
    assertEquals(
      b < MAX_GREEN_BLUE_THRESHOLD,
      true,
      `Pixel ${
        i / 4
      }: Blue channel should be < ${MAX_GREEN_BLUE_THRESHOLD}, got ${b}`,
    );
  }
});

test("GIF: encode and decode - multi-color pattern", async () => {
  const format = new GIFFormat();

  // Create a 4x4 image with a simple pattern
  const width = 4;
  const height = 4;
  const data = new Uint8Array(width * height * 4);

  // Create a pattern: red, green, blue, white
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    if (i % 4 === 0) {
      // Red
      data[idx] = 255;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    } else if (i % 4 === 1) {
      // Green
      data[idx] = 0;
      data[idx + 1] = 255;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    } else if (i % 4 === 2) {
      // Blue
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    } else {
      // White
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  const imageData: ImageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Check dimensions
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Verify we have the expected number of bytes
  assertEquals(decoded.data.length, width * height * 4);
});

test("GIF: encode and decode - black and white with color reduction", async () => {
  const format = new GIFFormat();

  // Create an image with many colors (> 256) plus pure black and white
  // This triggers the color reduction path in the encoder
  const width = 20;
  const height = 20;
  const data = new Uint8Array(width * height * 4);

  // Fill with gradient to create many colors (more than 256)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Create gradient with many unique colors
      data[idx] = Math.floor((x / width) * 255); // R
      data[idx + 1] = Math.floor((y / height) * 255); // G
      data[idx + 2] = Math.floor(((x + y) / (width + height)) * 255); // B
      data[idx + 3] = 255; // A
    }
  }

  // Override some pixels to be pure black
  for (let i = 0; i < 10; i++) {
    const idx = i * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }

  // Override some pixels to be pure white
  for (let i = 10; i < 20; i++) {
    const idx = i * 4;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }

  const imageData: ImageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Check dimensions
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Check that pure black pixels remain black
  for (let i = 0; i < 10; i++) {
    const idx = i * 4;
    const r = decoded.data[idx];
    const g = decoded.data[idx + 1];
    const b = decoded.data[idx + 2];
    assertEquals(
      r === 0 && g === 0 && b === 0,
      true,
      `Black pixel ${i} should be (0,0,0), got (${r},${g},${b})`,
    );
  }

  // Check that pure white pixels remain white (not light brown)
  // This is the key test - with the bug, white would become (224,224,192)
  for (let i = 10; i < 20; i++) {
    const idx = i * 4;
    const r = decoded.data[idx];
    const g = decoded.data[idx + 1];
    const b = decoded.data[idx + 2];
    assertEquals(
      r === 255 && g === 255 && b === 255,
      true,
      `White pixel ${i} should be (255,255,255), got (${r},${g},${b})`,
    );
  }
});
