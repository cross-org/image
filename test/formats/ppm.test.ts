import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { PPMFormat } from "../../src/formats/ppm.ts";

test("PPM: canDecode - valid PPM signature", () => {
  const encoder = new TextEncoder();
  const validPPM = encoder.encode("P6\n10 10\n255\n");
  const format = new PPMFormat();

  assertEquals(format.canDecode(validPPM), true);
});

test("PPM: canDecode - valid PPM signature with space", () => {
  const encoder = new TextEncoder();
  const validPPM = encoder.encode("P6 10 10\n255\n");
  const format = new PPMFormat();

  assertEquals(format.canDecode(validPPM), true);
});

test("PPM: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new PPMFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("PPM: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x50, 0x36]);
  const format = new PPMFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("PPM: canDecode - P3 signature (ASCII format)", () => {
  const encoder = new TextEncoder();
  const p3 = encoder.encode("P3\n10 10\n255\n");
  const format = new PPMFormat();

  // Should not decode P3 (ASCII) format, only P6 (binary)
  assertEquals(format.canDecode(p3), false);
});

test("PPM: decode - invalid data throws", async () => {
  const format = new PPMFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid PPM signature",
  );
});

test("PPM: encode and decode - small image", async () => {
  const format = new PPMFormat();

  // Create a simple 2x2 RGBA image
  const imageData = {
    width: 2,
    height: 2,
    data: new Uint8Array([
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
    ]),
  };

  // Encode
  const encoded = await format.encode(imageData);

  // Check that it can be decoded
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Verify dimensions
  assertEquals(decoded.width, imageData.width);
  assertEquals(decoded.height, imageData.height);

  // Verify pixel data (alpha is always 255 in decoded PPM)
  assertEquals(decoded.data.length, imageData.data.length);
  for (let i = 0; i < decoded.data.length; i += 4) {
    assertEquals(decoded.data[i], imageData.data[i], `Red ${i} mismatch`);
    assertEquals(
      decoded.data[i + 1],
      imageData.data[i + 1],
      `Green ${i} mismatch`,
    );
    assertEquals(
      decoded.data[i + 2],
      imageData.data[i + 2],
      `Blue ${i} mismatch`,
    );
    assertEquals(decoded.data[i + 3], 255, `Alpha ${i} should be 255`);
  }
});

test("PPM: properties", () => {
  const format = new PPMFormat();

  assertEquals(format.name, "ppm");
  assertEquals(format.mimeType, "image/x-portable-pixmap");
});

test("PPM: encode - single pixel", async () => {
  const format = new PPMFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 64, 32, 255]),
  };

  const encoded = await format.encode(imageData);
  const decoder = new TextDecoder();
  const encodedStr = decoder.decode(encoded);

  // Check header starts with P6
  assertEquals(encodedStr.startsWith("P6\n"), true);

  // Check content contains dimensions and maxval
  assertEquals(encodedStr.includes("1 1\n"), true);
  assertEquals(encodedStr.includes("255\n"), true);

  // Find where pixel data starts (after "255\n")
  const headerEndIndex = encodedStr.indexOf("255\n") + 4;

  // Check pixel data
  assertEquals(encoded[headerEndIndex], 128); // R
  assertEquals(encoded[headerEndIndex + 1], 64); // G
  assertEquals(encoded[headerEndIndex + 2], 32); // B
});

test("PPM: encode and decode - larger image", async () => {
  const format = new PPMFormat();

  // Create a 10x10 gradient image
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * 255); // R
      data[i + 1] = Math.floor((y / height) * 255); // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode and decode
  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Verify
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, data.length);

  // Verify pixel data (alpha channel is always 255 after decode)
  for (let i = 0; i < data.length; i += 4) {
    assertEquals(decoded.data[i], data[i], `Red pixel ${i / 4} mismatch`);
    assertEquals(
      decoded.data[i + 1],
      data[i + 1],
      `Green pixel ${i / 4} mismatch`,
    );
    assertEquals(
      decoded.data[i + 2],
      data[i + 2],
      `Blue pixel ${i / 4} mismatch`,
    );
    assertEquals(
      decoded.data[i + 3],
      255,
      `Alpha pixel ${i / 4} should be 255`,
    );
  }
});

test("PPM: decode - invalid dimensions", async () => {
  const format = new PPMFormat();

  // Create PPM with zero width
  const encoder = new TextEncoder();
  const invalidWidth = encoder.encode("P6\n0 10\n255\n");

  await assertRejects(
    async () => await format.decode(invalidWidth),
    Error,
    "Invalid PPM dimensions",
  );
});

test("PPM: decode - negative dimensions", async () => {
  const format = new PPMFormat();

  // Create PPM with negative height
  const encoder = new TextEncoder();
  const invalidHeight = encoder.encode("P6\n10 -5\n255\n");

  await assertRejects(
    async () => await format.decode(invalidHeight),
    Error,
    "Invalid PPM dimensions",
  );
});

test("PPM: decode - data length mismatch", async () => {
  const format = new PPMFormat();

  // Create PPM with incorrect data length
  const encoder = new TextEncoder();
  const header = "P6\n2 2\n255\n";
  const headerBytes = encoder.encode(header);
  const wrongLength = new Uint8Array(headerBytes.length + 3); // 3 bytes instead of 12
  wrongLength.set(headerBytes);
  wrongLength.set([255, 0, 0], headerBytes.length);

  await assertRejects(
    async () => await format.decode(wrongLength),
    Error,
    "Invalid PPM data length",
  );
});

test("PPM: encode - data length mismatch", async () => {
  const format = new PPMFormat();

  const badImageData = {
    width: 2,
    height: 2,
    data: new Uint8Array([255, 0, 0]), // wrong length
  };

  await assertRejects(
    async () => await format.encode(badImageData),
    Error,
    "Data length mismatch",
  );
});

test("PPM: decode - unsupported maxval", async () => {
  const format = new PPMFormat();

  // Create PPM with maxval != 255
  const encoder = new TextEncoder();
  const header = "P6\n2 2\n65535\n";
  const headerBytes = encoder.encode(header);
  const ppmData = new Uint8Array(headerBytes.length + 12);
  ppmData.set(headerBytes);

  await assertRejects(
    async () => await format.decode(ppmData),
    Error,
    "Unsupported PPM maxval",
  );
});

test("PPM: decode - with comments in header", async () => {
  const format = new PPMFormat();

  // Create PPM with comments
  const encoder = new TextEncoder();
  const header = "P6\n# This is a comment\n2 2\n# Another comment\n255\n";
  const headerBytes = encoder.encode(header);

  // Add pixel data (2x2 = 4 pixels * 3 bytes = 12 bytes)
  const ppmData = new Uint8Array(headerBytes.length + 12);
  ppmData.set(headerBytes);

  // Fill with sample pixel data
  for (let i = 0; i < 12; i++) {
    ppmData[headerBytes.length + i] = i * 20;
  }

  // Should decode successfully
  const decoded = await format.decode(ppmData);
  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
});

test("PPM: encode and decode - preserves RGB values but not alpha", async () => {
  const format = new PPMFormat();

  // Create image with various alpha values
  const imageData = {
    width: 2,
    height: 1,
    data: new Uint8Array([
      255,
      0,
      0,
      128, // red, semi-transparent
      0,
      255,
      0,
      64, // green, more transparent
    ]),
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // RGB values should be preserved
  assertEquals(decoded.data[0], 255); // R
  assertEquals(decoded.data[1], 0); // G
  assertEquals(decoded.data[2], 0); // B
  assertEquals(decoded.data[3], 255); // A (always 255 after decode)

  assertEquals(decoded.data[4], 0); // R
  assertEquals(decoded.data[5], 255); // G
  assertEquals(decoded.data[6], 0); // B
  assertEquals(decoded.data[7], 255); // A (always 255 after decode)
});
