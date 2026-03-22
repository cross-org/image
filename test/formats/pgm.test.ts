import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { PGMFormat } from "../../src/formats/pgm.ts";

test("PGM: canDecode - valid P5 (binary) signature", () => {
  const encoder = new TextEncoder();
  const validPGM = encoder.encode("P5\n10 10\n255\n");
  const format = new PGMFormat();

  assertEquals(format.canDecode(validPGM), true);
});

test("PGM: canDecode - valid P2 (ASCII) signature", () => {
  const encoder = new TextEncoder();
  const validPGM = encoder.encode("P2\n10 10\n255\n");
  const format = new PGMFormat();

  assertEquals(format.canDecode(validPGM), true);
});

test("PGM: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const format = new PGMFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("PGM: canDecode - PPM signature rejected", () => {
  const encoder = new TextEncoder();
  const ppm = encoder.encode("P6\n10 10\n255\n");
  const format = new PGMFormat();

  assertEquals(format.canDecode(ppm), false);
});

test("PGM: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x50, 0x35]);
  const format = new PGMFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("PGM: decode - invalid data throws", async () => {
  const format = new PGMFormat();

  await assertRejects(
    async () => await format.decode(new Uint8Array([0, 1, 2, 3])),
    Error,
    "Invalid PGM signature",
  );
});

test("PGM: decode P5 - small grayscale image", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  const header = encoder.encode("P5\n2 2\n255\n");
  const pixels = new Uint8Array([0, 128, 64, 255]);
  const data = new Uint8Array(header.length + pixels.length);
  data.set(header);
  data.set(pixels, header.length);

  const decoded = await format.decode(data);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
  // Each grayscale value should be expanded to R=G=B with A=255
  assertEquals(decoded.data[0], 0); // R
  assertEquals(decoded.data[1], 0); // G
  assertEquals(decoded.data[2], 0); // B
  assertEquals(decoded.data[3], 255); // A

  assertEquals(decoded.data[4], 128); // R
  assertEquals(decoded.data[5], 128); // G
  assertEquals(decoded.data[6], 128); // B
  assertEquals(decoded.data[7], 255); // A

  assertEquals(decoded.data[8], 64); // R
  assertEquals(decoded.data[9], 64); // G
  assertEquals(decoded.data[10], 64); // B
  assertEquals(decoded.data[11], 255); // A

  assertEquals(decoded.data[12], 255); // R
  assertEquals(decoded.data[13], 255); // G
  assertEquals(decoded.data[14], 255); // B
  assertEquals(decoded.data[15], 255); // A
});

test("PGM: decode P2 (ASCII) - small image", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  const p2Data = encoder.encode("P2\n2 1\n255\n0 128");

  const decoded = await format.decode(p2Data);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 1);
  assertEquals(decoded.data[0], 0);
  assertEquals(decoded.data[1], 0);
  assertEquals(decoded.data[2], 0);
  assertEquals(decoded.data[3], 255);
  assertEquals(decoded.data[4], 128);
  assertEquals(decoded.data[5], 128);
  assertEquals(decoded.data[6], 128);
  assertEquals(decoded.data[7], 255);
});

test("PGM: decode P2 (ASCII) - with comments", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  const p2Data = encoder.encode("P2\n# comment\n1 1\n255\n# pixel\n200");

  const decoded = await format.decode(p2Data);

  assertEquals(decoded.width, 1);
  assertEquals(decoded.height, 1);
  assertEquals(decoded.data[0], 200);
  assertEquals(decoded.data[1], 200);
  assertEquals(decoded.data[2], 200);
  assertEquals(decoded.data[3], 255);
});

test("PGM: encode and decode round-trip", async () => {
  const format = new PGMFormat();

  // Create a simple 3x3 RGBA image (all grays)
  const imageData = {
    width: 3,
    height: 3,
    data: new Uint8Array([
      100,
      100,
      100,
      255,
      150,
      150,
      150,
      255,
      200,
      200,
      200,
      255,
      50,
      50,
      50,
      255,
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      128,
      128,
      128,
      255,
      64,
      64,
      64,
      255,
      192,
      192,
      192,
      255,
    ]),
  };

  const encoded = await format.encode(imageData);
  assertEquals(format.canDecode(encoded), true);

  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 3);
  assertEquals(decoded.height, 3);

  // For pure grays, encode->decode should preserve values
  for (let i = 0; i < 9; i++) {
    assertEquals(decoded.data[i * 4], imageData.data[i * 4], `pixel ${i} mismatch`);
    assertEquals(decoded.data[i * 4 + 1], imageData.data[i * 4 + 1], `pixel ${i} G mismatch`);
    assertEquals(decoded.data[i * 4 + 2], imageData.data[i * 4 + 2], `pixel ${i} B mismatch`);
    assertEquals(decoded.data[i * 4 + 3], 255, `pixel ${i} A mismatch`);
  }
});

test("PGM: encode - RGB to grayscale conversion", async () => {
  const format = new PGMFormat();

  // Red pixel: luminance = 0.299 * 255 ≈ 76
  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([255, 0, 0, 255]),
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Should be approximately the red luminance
  const expected = Math.round(0.299 * 255 + 0.587 * 0 + 0.114 * 0);
  assertEquals(decoded.data[0], expected);
  assertEquals(decoded.data[1], expected);
  assertEquals(decoded.data[2], expected);
  assertEquals(decoded.data[3], 255);
});

test("PGM: properties", () => {
  const format = new PGMFormat();

  assertEquals(format.name, "pgm");
  assertEquals(format.mimeType, "image/x-portable-graymap");
});

test("PGM: decode P5 - data length mismatch", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  const header = encoder.encode("P5\n4 4\n255\n");
  // Only 3 bytes when 16 expected
  const data = new Uint8Array(header.length + 3);
  data.set(header);

  await assertRejects(
    async () => await format.decode(data),
    Error,
    "Invalid PGM data length",
  );
});

test("PGM: decode - incomplete header", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  const incomplete = encoder.encode("P5\n10 10\n");

  await assertRejects(
    async () => await format.decode(incomplete),
    Error,
    "Incomplete PGM header",
  );
});

test("PGM: decode - maxval greater than 255", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  const unsupported = encoder.encode("P5\n1 1\n65535\n");

  await assertRejects(
    async () => await format.decode(unsupported),
    Error,
    "Unsupported PGM maxval",
  );
});

test("PGM: encode - data length mismatch", async () => {
  const format = new PGMFormat();

  await assertRejects(
    async () =>
      await format.encode({
        width: 2,
        height: 2,
        data: new Uint8Array([255, 0, 0]),
      }),
    Error,
    "Data length mismatch",
  );
});

test("PGM: decode P2 - incomplete pixel data", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  // 2x2 needs 4 values, only 3
  const incomplete = encoder.encode("P2\n2 2\n255\n100 200 150");

  await assertRejects(
    async () => await format.decode(incomplete),
    Error,
    "Incomplete PGM pixel data",
  );
});

test("PGM: extractMetadata", async () => {
  const format = new PGMFormat();
  const encoder = new TextEncoder();
  const data = encoder.encode("P5\n10 10\n255\n");

  const metadata = await format.extractMetadata(data);

  assertEquals(metadata?.format, "pgm");
  assertEquals(metadata?.colorType, "grayscale");
  assertEquals(metadata?.bitDepth, 8);
  assertEquals(metadata?.compression, "none");
});

test("PGM: getSupportedMetadata", () => {
  const format = new PGMFormat();
  assertEquals(format.getSupportedMetadata(), []);
});
