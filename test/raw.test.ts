import { assertEquals, assertRejects } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { RAWFormat } from "../src/formats/raw.ts";

test("RAW: canDecode - valid RAW signature", () => {
  const validRAW = new Uint8Array([
    0x52,
    0x47,
    0x42,
    0x41, // "RGBA" magic bytes
    0x00,
    0x00,
    0x00,
    0x02, // width = 2
    0x00,
    0x00,
    0x00,
    0x02, // height = 2
    255,
    0,
    0,
    255, // pixel data starts
  ]);
  const format = new RAWFormat();

  assertEquals(format.canDecode(validRAW), true);
});

test("RAW: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new RAWFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("RAW: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x52, 0x47, 0x42]);
  const format = new RAWFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("RAW: decode - invalid data throws", async () => {
  const format = new RAWFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid RAW signature",
  );
});

test("RAW: encode and decode - small image", async () => {
  const format = new RAWFormat();

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

  // Verify pixel data
  assertEquals(decoded.data.length, imageData.data.length);
  for (let i = 0; i < decoded.data.length; i++) {
    assertEquals(decoded.data[i], imageData.data[i], `Pixel ${i} mismatch`);
  }
});

test("RAW: properties", () => {
  const format = new RAWFormat();

  assertEquals(format.name, "raw");
  assertEquals(format.mimeType, "image/raw");
});

test("RAW: encode - single pixel", async () => {
  const format = new RAWFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 64, 32, 255]),
  };

  const encoded = await format.encode(imageData);

  // Check header
  assertEquals(encoded[0], 0x52); // 'R'
  assertEquals(encoded[1], 0x47); // 'G'
  assertEquals(encoded[2], 0x42); // 'B'
  assertEquals(encoded[3], 0x41); // 'A'

  // Check width (big-endian)
  assertEquals(encoded[4], 0x00);
  assertEquals(encoded[5], 0x00);
  assertEquals(encoded[6], 0x00);
  assertEquals(encoded[7], 0x01); // width = 1

  // Check height (big-endian)
  assertEquals(encoded[8], 0x00);
  assertEquals(encoded[9], 0x00);
  assertEquals(encoded[10], 0x00);
  assertEquals(encoded[11], 0x01); // height = 1

  // Check pixel data
  assertEquals(encoded[12], 128);
  assertEquals(encoded[13], 64);
  assertEquals(encoded[14], 32);
  assertEquals(encoded[15], 255);
});

test("RAW: encode and decode - larger image", async () => {
  const format = new RAWFormat();

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
    assertEquals(decoded.data[i], data[i], `Pixel ${i} mismatch`);
  }
});

test("RAW: decode - invalid dimensions", async () => {
  const format = new RAWFormat();

  // Create RAW with zero width
  const invalidWidth = new Uint8Array([
    0x52,
    0x47,
    0x42,
    0x41, // magic
    0x00,
    0x00,
    0x00,
    0x00, // width = 0
    0x00,
    0x00,
    0x00,
    0x02, // height = 2
  ]);

  await assertRejects(
    async () => await format.decode(invalidWidth),
    Error,
    "Invalid RAW dimensions",
  );
});

test("RAW: decode - data length mismatch", async () => {
  const format = new RAWFormat();

  // Create RAW with incorrect data length
  const wrongLength = new Uint8Array([
    0x52,
    0x47,
    0x42,
    0x41, // magic
    0x00,
    0x00,
    0x00,
    0x02, // width = 2
    0x00,
    0x00,
    0x00,
    0x02, // height = 2
    255,
    0,
    0, // only 3 bytes instead of 16 (2x2x4)
  ]);

  await assertRejects(
    async () => await format.decode(wrongLength),
    Error,
    "Invalid RAW data length",
  );
});

test("RAW: encode - data length mismatch", async () => {
  const format = new RAWFormat();

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
