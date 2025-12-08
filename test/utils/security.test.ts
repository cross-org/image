/**
 * Security tests for image processing
 * Tests for integer overflow, heap exhaustion, and other security vulnerabilities
 */

import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../../mod.ts";
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  validateImageDimensions,
} from "../../src/utils/security.ts";

test("Security - validateImageDimensions rejects zero dimensions", () => {
  try {
    validateImageDimensions(0, 100);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions must be positive"),
      true,
    );
  }

  try {
    validateImageDimensions(100, 0);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions must be positive"),
      true,
    );
  }
});

test("Security - validateImageDimensions rejects negative dimensions", () => {
  try {
    validateImageDimensions(-100, 100);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions must be positive"),
      true,
    );
  }

  try {
    validateImageDimensions(100, -100);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions must be positive"),
      true,
    );
  }
});

test("Security - validateImageDimensions rejects non-integer dimensions", () => {
  try {
    validateImageDimensions(100.5, 100);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions must be integers"),
      true,
    );
  }

  try {
    validateImageDimensions(100, 100.5);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions must be integers"),
      true,
    );
  }
});

test("Security - validateImageDimensions rejects dimensions that are too large", () => {
  try {
    validateImageDimensions(MAX_IMAGE_DIMENSION + 1, 100);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions too large"),
      true,
    );
  }

  try {
    validateImageDimensions(100, MAX_IMAGE_DIMENSION + 1);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions too large"),
      true,
    );
  }
});

test("Security - validateImageDimensions rejects dimensions with excessive pixel count", () => {
  // Calculate dimensions that exceed MAX_IMAGE_PIXELS
  // Use square dimensions for simplicity: sqrt(MAX_IMAGE_PIXELS + 1)
  const excessiveSize = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS + 1));

  try {
    validateImageDimensions(excessiveSize, excessiveSize);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("exceeds"),
      true,
    );
  }
});

test("Security - validateImageDimensions accepts valid dimensions", () => {
  // These should all pass
  validateImageDimensions(1, 1);
  validateImageDimensions(100, 100);
  validateImageDimensions(1920, 1080);
  validateImageDimensions(4096, 4096);
  validateImageDimensions(8192, 8192);
});

test("Security - Image.fromRGBA rejects invalid dimensions", () => {
  const data = new Uint8Array(100 * 100 * 4);

  try {
    Image.fromRGBA(0, 100, data);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions must be positive"),
      true,
    );
  }

  try {
    Image.fromRGBA(MAX_IMAGE_DIMENSION + 1, 100, data);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions too large"),
      true,
    );
  }
});

test("Security - Image.fromRGBA accepts valid dimensions", () => {
  const width = 100;
  const height = 100;
  const data = new Uint8Array(width * height * 4);

  // Fill with red
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(width, height, data);
  assertEquals(image.width, width);
  assertEquals(image.height, height);
});

test("Security - PNG decoder rejects oversized images", async () => {
  // Create a malicious PNG with extremely large dimensions in IHDR
  const maliciousPNG = new Uint8Array([
    // PNG signature
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    // IHDR chunk
    0,
    0,
    0,
    13, // Length: 13
    73,
    72,
    68,
    82, // Type: IHDR
    // Width: 0x00010000 (65536) - exceeds MAX_IMAGE_DIMENSION
    0,
    1,
    0,
    0,
    // Height: 0x00010000 (65536) - exceeds MAX_IMAGE_DIMENSION
    0,
    1,
    0,
    0,
    8, // Bit depth: 8
    2, // Color type: RGB (2)
    0, // Compression: 0
    0, // Filter: 0
    0, // Interlace: 0
    // CRC (not validated in this test)
    0,
    0,
    0,
    0,
  ]);

  await assertRejects(
    async () => {
      await Image.read(maliciousPNG);
    },
    Error,
    "dimensions too large",
  );
});

test("Security - BMP decoder rejects oversized images", async () => {
  // Create a malicious BMP with extremely large dimensions
  const maliciousBMP = new Uint8Array(54);

  // BMP signature: 'BM'
  maliciousBMP[0] = 0x42;
  maliciousBMP[1] = 0x4d;

  // File size (placeholder)
  maliciousBMP[2] = 0xff;
  maliciousBMP[3] = 0xff;
  maliciousBMP[4] = 0xff;
  maliciousBMP[5] = 0xff;

  // Reserved
  maliciousBMP[6] = 0;
  maliciousBMP[7] = 0;
  maliciousBMP[8] = 0;
  maliciousBMP[9] = 0;

  // Data offset
  maliciousBMP[10] = 54;
  maliciousBMP[11] = 0;
  maliciousBMP[12] = 0;
  maliciousBMP[13] = 0;

  // DIB header size (BITMAPINFOHEADER = 40)
  maliciousBMP[14] = 40;
  maliciousBMP[15] = 0;
  maliciousBMP[16] = 0;
  maliciousBMP[17] = 0;

  // Width: 0x00010000 (65536) - exceeds MAX_IMAGE_DIMENSION
  maliciousBMP[18] = 0x00;
  maliciousBMP[19] = 0x00;
  maliciousBMP[20] = 0x01;
  maliciousBMP[21] = 0x00;

  // Height: 0x00010000 (65536) - exceeds MAX_IMAGE_DIMENSION
  maliciousBMP[22] = 0x00;
  maliciousBMP[23] = 0x00;
  maliciousBMP[24] = 0x01;
  maliciousBMP[25] = 0x00;

  // Planes
  maliciousBMP[26] = 1;
  maliciousBMP[27] = 0;

  // Bit depth: 24
  maliciousBMP[28] = 24;
  maliciousBMP[29] = 0;

  // Compression: 0 (uncompressed)
  maliciousBMP[30] = 0;
  maliciousBMP[31] = 0;
  maliciousBMP[32] = 0;
  maliciousBMP[33] = 0;

  await assertRejects(
    async () => {
      await Image.read(maliciousBMP);
    },
    Error,
    "dimensions too large",
  );
});

test("Security - resize rejects oversized target dimensions", () => {
  // Create a small valid image
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);

  const image = Image.fromRGBA(width, height, data);

  // Try to resize to dimensions that are too large
  try {
    image.resize({ width: MAX_IMAGE_DIMENSION + 1, height: 100 });
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions too large"),
      true,
    );
  }

  try {
    image.resize({ width: 100, height: MAX_IMAGE_DIMENSION + 1 });
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("dimensions too large"),
      true,
    );
  }
});

test("Security - maximum dimensions are reasonable", () => {
  // Verify that our security limits are practical
  assertEquals(MAX_IMAGE_DIMENSION, 65535); // 2^16 - 1
  assertEquals(MAX_IMAGE_PIXELS, 178956970); // ~179 megapixels

  // Verify that reasonable image sizes are allowed
  validateImageDimensions(1920, 1080); // Full HD
  validateImageDimensions(3840, 2160); // 4K
  validateImageDimensions(7680, 4320); // 8K
  validateImageDimensions(8192, 8192); // Large square image
});
