import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { PPMFormat } from "../../src/formats/ppm.ts";

test("PPM: canDecode - valid P6 (binary) signature", () => {
  const encoder = new TextEncoder();
  const validPPM = encoder.encode("P6\n10 10\n255\n");
  const format = new PPMFormat();

  assertEquals(format.canDecode(validPPM), true);
});

test("PPM: canDecode - valid P3 (ASCII) signature", () => {
  const encoder = new TextEncoder();
  const validPPM = encoder.encode("P3\n10 10\n255\n");
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
      255, // red (alpha ignored)
      0,
      255,
      0,
      255, // green (alpha ignored)
      0,
      0,
      255,
      255, // blue (alpha ignored)
      255,
      255,
      0,
      255, // yellow (alpha ignored)
    ]),
  };

  // Encode (P6 binary format)
  const encoded = await format.encode(imageData);

  // Check that it can be decoded
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Verify dimensions
  assertEquals(decoded.width, imageData.width);
  assertEquals(decoded.height, imageData.height);

  // Verify pixel data (note: PPM doesn't have alpha, so all alpha values should be 255)
  assertEquals(decoded.data.length, imageData.data.length);
  for (let i = 0; i < decoded.data.length; i++) {
    if (i % 4 === 3) {
      // Alpha channel should always be 255
      assertEquals(decoded.data[i], 255, `Alpha channel at ${i} should be 255`);
    } else {
      assertEquals(decoded.data[i], imageData.data[i], `Pixel ${i} mismatch`);
    }
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
  const headerEnd = encoded.indexOf(0x0a, 7) + 1; // Find end of "255\n"
  const encodedStr = decoder.decode(encoded.subarray(0, headerEnd));

  // Check header starts with P6
  assertEquals(encodedStr.startsWith("P6\n"), true);

  // Check content contains dimensions
  assertEquals(encodedStr.includes("1 1"), true);
  assertEquals(encodedStr.includes("255"), true);

  // Check pixel data (RGB, no alpha)
  assertEquals(encoded[headerEnd], 128); // R
  assertEquals(encoded[headerEnd + 1], 64); // G
  assertEquals(encoded[headerEnd + 2], 32); // B
  assertEquals(encoded.length, headerEnd + 3); // Should be exactly 3 bytes of pixel data
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

  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3) {
      // Alpha should be 255
      assertEquals(decoded.data[i], 255);
    } else {
      assertEquals(decoded.data[i], data[i], `Pixel ${i} mismatch`);
    }
  }
});

test("PPM: decode P3 (ASCII) - small image", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  // Create a 2x2 image in P3 format
  const p3Data = encoder.encode(
    "P3\n2 2\n255\n255 0 0 0 255 0 0 0 255 255 255 0",
  );

  const decoded = await format.decode(p3Data);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);

  // Expected: red, green, blue, yellow (with alpha=255)
  assertEquals(decoded.data[0], 255); // R
  assertEquals(decoded.data[1], 0); // G
  assertEquals(decoded.data[2], 0); // B
  assertEquals(decoded.data[3], 255); // A

  assertEquals(decoded.data[4], 0); // R
  assertEquals(decoded.data[5], 255); // G
  assertEquals(decoded.data[6], 0); // B
  assertEquals(decoded.data[7], 255); // A

  assertEquals(decoded.data[8], 0); // R
  assertEquals(decoded.data[9], 0); // G
  assertEquals(decoded.data[10], 255); // B
  assertEquals(decoded.data[11], 255); // A

  assertEquals(decoded.data[12], 255); // R
  assertEquals(decoded.data[13], 255); // G
  assertEquals(decoded.data[14], 0); // B
  assertEquals(decoded.data[15], 255); // A
});

test("PPM: decode P3 (ASCII) - with comments", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  // Create a 1x1 image with comments
  const p3Data = encoder.encode(
    "P3\n# This is a comment\n1 1\n# Another comment\n255\n# Pixel data comment\n128 64 32",
  );

  const decoded = await format.decode(p3Data);

  assertEquals(decoded.width, 1);
  assertEquals(decoded.height, 1);
  assertEquals(decoded.data[0], 128);
  assertEquals(decoded.data[1], 64);
  assertEquals(decoded.data[2], 32);
  assertEquals(decoded.data[3], 255);
});

test("PPM: decode P6 (binary) - with comments", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  // Create header with comment
  const header = encoder.encode("P6\n# Comment\n2 1\n255\n");
  const pixels = new Uint8Array([255, 0, 0, 0, 255, 0]); // red, green

  const p6Data = new Uint8Array(header.length + pixels.length);
  p6Data.set(header, 0);
  p6Data.set(pixels, header.length);

  const decoded = await format.decode(p6Data);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 1);
  assertEquals(decoded.data[0], 255); // R
  assertEquals(decoded.data[1], 0); // G
  assertEquals(decoded.data[2], 0); // B
  assertEquals(decoded.data[3], 255); // A
  assertEquals(decoded.data[4], 0); // R
  assertEquals(decoded.data[5], 255); // G
  assertEquals(decoded.data[6], 0); // B
  assertEquals(decoded.data[7], 255); // A
});

test("PPM: decode - incomplete header", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  // Missing maxval
  const incomplete = encoder.encode("P6\n10 10\n");

  await assertRejects(
    async () => await format.decode(incomplete),
    Error,
    "Incomplete PPM header",
  );
});

test("PPM: decode P6 - data length mismatch", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  // Header says 2x2 but only 3 RGB bytes provided
  const header = encoder.encode("P6\n2 2\n255\n");
  const wrongLength = new Uint8Array(header.length + 3);
  wrongLength.set(header);
  wrongLength.set([255, 0, 0], header.length);

  await assertRejects(
    async () => await format.decode(wrongLength),
    Error,
    "Invalid PPM data length",
  );
});

test("PPM: decode P3 - incomplete pixel data", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  // 2x2 image needs 12 values, only 11 provided
  const incomplete = encoder.encode(
    "P3\n2 2\n255\n255 0 0 0 255 0 0 0 255 255 255",
  );

  await assertRejects(
    async () => await format.decode(incomplete),
    Error,
    "Incomplete PPM pixel data",
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

test("PPM: decode - invalid header value", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  const invalid = encoder.encode("P6\nabc 10\n255\n");

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid PPM header value",
  );
});

test("PPM: decode P3 - invalid pixel value", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  const invalid = encoder.encode("P3\n1 1\n255\nabc 0 0");

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid PPM pixel value",
  );
});

test("PPM: decode - maxval greater than 255", async () => {
  const format = new PPMFormat();
  const encoder = new TextEncoder();

  const unsupported = encoder.encode("P6\n1 1\n65535\n");

  await assertRejects(
    async () => await format.decode(unsupported),
    Error,
    "Unsupported PPM maxval",
  );
});

test("PPM: decode P3 - different whitespace types", async () => {
  const format = new PPMFormat();

  // Test with various whitespace: spaces, tabs, newlines
  const mixed = new Uint8Array([
    0x50,
    0x33,
    0x0a, // P3\n
    0x32,
    0x20,
    0x31,
    0x09,
    0x0d,
    0x0a, // 2 1\t\r\n
    0x32,
    0x35,
    0x35,
    0x20,
    0x0a, // 255 \n
    0x31,
    0x30,
    0x30,
    0x20,
    0x32,
    0x30,
    0x30,
    0x09,
    0x35,
    0x30, // 100 200\t50
    0x0a,
    0x31,
    0x35,
    0x30,
    0x20,
    0x31,
    0x30,
    0x30,
    0x20,
    0x32,
    0x30,
    0x30, // \n150 100 200
  ]);

  const decoded = await format.decode(mixed);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 1);
  assertEquals(decoded.data[0], 100); // R
  assertEquals(decoded.data[1], 200); // G
  assertEquals(decoded.data[2], 50); // B
  assertEquals(decoded.data[4], 150); // R
  assertEquals(decoded.data[5], 100); // G
  assertEquals(decoded.data[6], 200); // B
});
