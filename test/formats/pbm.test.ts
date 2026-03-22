import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { PBMFormat } from "../../src/formats/pbm.ts";

test("PBM: canDecode - valid P4 (binary) signature", () => {
  const encoder = new TextEncoder();
  const validPBM = encoder.encode("P4\n8 1\n");
  const format = new PBMFormat();

  assertEquals(format.canDecode(validPBM), true);
});

test("PBM: canDecode - valid P1 (ASCII) signature", () => {
  const encoder = new TextEncoder();
  const validPBM = encoder.encode("P1\n8 1\n");
  const format = new PBMFormat();

  assertEquals(format.canDecode(validPBM), true);
});

test("PBM: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const format = new PBMFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("PBM: canDecode - PPM signature rejected", () => {
  const encoder = new TextEncoder();
  const ppm = encoder.encode("P6\n10 10\n255\n");
  const format = new PBMFormat();

  assertEquals(format.canDecode(ppm), false);
});

test("PBM: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x50, 0x34]);
  const format = new PBMFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("PBM: decode - invalid data throws", async () => {
  const format = new PBMFormat();

  await assertRejects(
    async () => await format.decode(new Uint8Array([0, 1, 2, 3])),
    Error,
    "Invalid PBM signature",
  );
});

test("PBM: decode P4 - 8-pixel row (1 byte)", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  // P4, 8 pixels wide, 1 pixel tall
  // Bit pattern 0b10110010 = 0xB2 -> pixels: black white black black white white black black
  // In PBM: 1=black (0,0,0), 0=white (255,255,255)
  const header = encoder.encode("P4\n8 1\n");
  const pixels = new Uint8Array([0b10110010]); // 8 pixels packed
  const data = new Uint8Array(header.length + pixels.length);
  data.set(header);
  data.set(pixels, header.length);

  const decoded = await format.decode(data);

  assertEquals(decoded.width, 8);
  assertEquals(decoded.height, 1);

  // Bit 7 (MSB) = 1 = black
  assertEquals(decoded.data[0], 0); // R
  assertEquals(decoded.data[1], 0); // G
  assertEquals(decoded.data[2], 0); // B
  assertEquals(decoded.data[3], 255); // A

  // Bit 6 = 0 = white
  assertEquals(decoded.data[4], 255);
  assertEquals(decoded.data[5], 255);
  assertEquals(decoded.data[6], 255);
  assertEquals(decoded.data[7], 255);

  // Bit 5 = 1 = black
  assertEquals(decoded.data[8], 0);

  // Bit 4 = 1 = black
  assertEquals(decoded.data[12], 0);

  // Bit 3 = 0 = white
  assertEquals(decoded.data[16], 255);

  // Bit 2 = 0 = white
  assertEquals(decoded.data[20], 255);

  // Bit 1 = 1 = black
  assertEquals(decoded.data[24], 0);

  // Bit 0 (LSB) = 0 = white
  assertEquals(decoded.data[28], 255);
});

test("PBM: decode P4 - row padding", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  // 3 pixels wide, 2 rows: each row is 1 byte (3 bits + 5 padding bits)
  // Row 1: 0b10100000 -> pixels: black, white, black (then 5 padding bits ignored)
  // Row 2: 0b01100000 -> pixels: white, black, black
  const header = encoder.encode("P4\n3 2\n");
  const pixels = new Uint8Array([0b10100000, 0b01100000]);
  const data = new Uint8Array(header.length + pixels.length);
  data.set(header);
  data.set(pixels, header.length);

  const decoded = await format.decode(data);

  assertEquals(decoded.width, 3);
  assertEquals(decoded.height, 2);

  // Row 1
  assertEquals(decoded.data[0], 0); // black
  assertEquals(decoded.data[4], 255); // white
  assertEquals(decoded.data[8], 0); // black

  // Row 2
  assertEquals(decoded.data[12], 255); // white
  assertEquals(decoded.data[16], 0); // black
  assertEquals(decoded.data[20], 0); // black
});

test("PBM: decode P1 (ASCII) - small image", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  // 2x2: 0=white, 1=black
  const p1Data = encoder.encode("P1\n2 2\n0 1 1 0");

  const decoded = await format.decode(p1Data);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);

  assertEquals(decoded.data[0], 255); // white
  assertEquals(decoded.data[4], 0); // black
  assertEquals(decoded.data[8], 0); // black
  assertEquals(decoded.data[12], 255); // white
});

test("PBM: decode P1 (ASCII) - with comments", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  const p1Data = encoder.encode("P1\n# a comment\n2 1\n0 1");

  const decoded = await format.decode(p1Data);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 1);
  assertEquals(decoded.data[0], 255); // 0 = white
  assertEquals(decoded.data[4], 0); // 1 = black
});

test("PBM: encode and decode round-trip", async () => {
  const format = new PBMFormat();

  // Create a 4x4 image with clear black/white pixels
  const imageData = {
    width: 4,
    height: 4,
    data: new Uint8Array([
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255,
    ]),
  };

  const encoded = await format.encode(imageData);
  assertEquals(format.canDecode(encoded), true);

  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 4);
  assertEquals(decoded.height, 4);

  // Black pixels should be black, white pixels should be white
  for (let i = 0; i < 16; i++) {
    const origGray = imageData.data[i * 4]; // all are pure black or pure white
    const expected = origGray < 128 ? 0 : 255;
    assertEquals(decoded.data[i * 4], expected, `pixel ${i} mismatch`);
    assertEquals(decoded.data[i * 4 + 3], 255, `pixel ${i} alpha mismatch`);
  }
});

test("PBM: encode - thresholding gray to black/white", async () => {
  const format = new PBMFormat();

  // Dark gray (100 < 128) -> black; light gray (200 >= 128) -> white
  const imageData = {
    width: 2,
    height: 1,
    data: new Uint8Array([100, 100, 100, 255, 200, 200, 200, 255]),
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.data[0], 0); // dark gray -> black
  assertEquals(decoded.data[4], 255); // light gray -> white
});

test("PBM: properties", () => {
  const format = new PBMFormat();

  assertEquals(format.name, "pbm");
  assertEquals(format.mimeType, "image/x-portable-bitmap");
});

test("PBM: decode P4 - data length mismatch", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  const header = encoder.encode("P4\n16 16\n"); // needs 16*16/8 = 32 bytes
  const data = new Uint8Array(header.length + 3); // only 3 bytes
  data.set(header);

  await assertRejects(
    async () => await format.decode(data),
    Error,
    "Invalid PBM data length",
  );
});

test("PBM: decode - incomplete header", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  const incomplete = encoder.encode("P4\n10");

  await assertRejects(
    async () => await format.decode(incomplete),
    Error,
    "Incomplete PBM header",
  );
});

test("PBM: encode - data length mismatch", async () => {
  const format = new PBMFormat();

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

test("PBM: decode P1 - incomplete pixel data", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  // 2x2 needs 4 values, only 3
  const incomplete = encoder.encode("P1\n2 2\n0 1 0");

  await assertRejects(
    async () => await format.decode(incomplete),
    Error,
    "Incomplete PBM pixel data",
  );
});

test("PBM: extractMetadata", async () => {
  const format = new PBMFormat();
  const encoder = new TextEncoder();
  const data = encoder.encode("P4\n10 10\n");

  const metadata = await format.extractMetadata(data);

  assertEquals(metadata?.format, "pbm");
  assertEquals(metadata?.colorType, "grayscale");
  assertEquals(metadata?.bitDepth, 1);
  assertEquals(metadata?.compression, "none");
});

test("PBM: getSupportedMetadata", () => {
  const format = new PBMFormat();
  assertEquals(format.getSupportedMetadata(), []);
});
