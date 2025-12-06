import { assertEquals, assertRejects } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { TIFFFormat } from "../src/formats/tiff.ts";

test("TIFF: canDecode - valid TIFF signature (little-endian)", () => {
  const validTIFF = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(validTIFF), true);
});

test("TIFF: canDecode - valid TIFF signature (big-endian)", () => {
  const validTIFF = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 0]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(validTIFF), true);
});

test("TIFF: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("TIFF: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x49, 0x49]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("TIFF: decode - invalid data throws", async () => {
  const format = new TIFFFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid TIFF signature",
  );
});

test("TIFF: encode and decode - small image", async () => {
  const format = new TIFFFormat();

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

  // Check it starts with TIFF signature (little-endian)
  assertEquals(encoded[0], 0x49);
  assertEquals(encoded[1], 0x49);
  assertEquals(encoded[2], 0x2a);
  assertEquals(encoded[3], 0x00);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);
});

test("TIFF: properties", () => {
  const format = new TIFFFormat();

  assertEquals(format.name, "tiff");
  assertEquals(format.mimeType, "image/tiff");
});

test("TIFF: encode - single pixel", async () => {
  const format = new TIFFFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 128, 128, 255]),
  };

  const encoded = await format.encode(imageData);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);
});

test("TIFF: encode - larger image", async () => {
  const format = new TIFFFormat();

  // Create a 10x10 gradient image
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x / width) * 255; // R
      data[i + 1] = (y / height) * 255; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);
});
