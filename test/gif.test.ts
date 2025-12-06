import { assertEquals, assertRejects } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { GIFFormat } from "../src/formats/gif.ts";
import type { ImageData } from "../src/types.ts";

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
      r > 200,
      true,
      `Pixel ${i / 4}: Red channel should be > 200, got ${r}`,
    );
    assertEquals(
      g < 50,
      true,
      `Pixel ${i / 4}: Green channel should be < 50, got ${g}`,
    );
    assertEquals(
      b < 50,
      true,
      `Pixel ${i / 4}: Blue channel should be < 50, got ${b}`,
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
