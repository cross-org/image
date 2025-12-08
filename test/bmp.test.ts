import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { BMPFormat } from "../src/formats/bmp.ts";

test("BMP: canDecode - valid BMP signature", () => {
  const validBMP = new Uint8Array([0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0]);
  const format = new BMPFormat();

  assertEquals(format.canDecode(validBMP), true);
});

test("BMP: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new BMPFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("BMP: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x42]);
  const format = new BMPFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("BMP: decode - invalid data throws", async () => {
  const format = new BMPFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid BMP signature",
  );
});

test("BMP: encode and decode - small image", async () => {
  const format = new BMPFormat();

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

  // Check it starts with BMP signature
  assertEquals(encoded[0], 0x42);
  assertEquals(encoded[1], 0x4d);

  // Decode
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
  assertEquals(decoded.data.length, 16); // 2x2 * 4 bytes

  // Check colors are preserved
  assertEquals(decoded.data[0], 255); // red R
  assertEquals(decoded.data[1], 0); // red G
  assertEquals(decoded.data[2], 0); // red B
  assertEquals(decoded.data[3], 255); // red A
});

test("BMP: properties", () => {
  const format = new BMPFormat();

  assertEquals(format.name, "bmp");
  assertEquals(format.mimeType, "image/bmp");
});

test("BMP: encode - single pixel", async () => {
  const format = new BMPFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 128, 128, 255]),
  };

  const encoded = await format.encode(imageData);

  // Should be a valid BMP
  assertEquals(format.canDecode(encoded), true);

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, 1);
  assertEquals(decoded.height, 1);
});

test("BMP: encode and decode - larger image", async () => {
  const format = new BMPFormat();

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

  // Encode and decode
  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, width * height * 4);
});

test("BMP: metadata - DPI preservation", async () => {
  const format = new BMPFormat();

  const imageData = {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 4).fill(255),
    metadata: {
      dpiX: 300,
      dpiY: 300,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.dpiX, 300);
  assertEquals(decoded.metadata?.dpiY, 300);
});

test("BMP: metadata - default DPI when not specified", async () => {
  const format = new BMPFormat();

  const imageData = {
    width: 10,
    height: 10,
    data: new Uint8Array(10 * 10 * 4).fill(255),
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Default is 72 DPI
  assertEquals(decoded.metadata?.dpiX, 72);
  assertEquals(decoded.metadata?.dpiY, 72);
});
