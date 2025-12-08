import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { ICOFormat } from "../../src/formats/ico.ts";

test("ICO: canDecode - valid ICO signature", () => {
  // ICO: reserved=0, type=1 (icon), count=1
  const validICO = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
  const format = new ICOFormat();

  assertEquals(format.canDecode(validICO), true);
});

test("ICO: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new ICOFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("ICO: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x00, 0x00, 0x01]);
  const format = new ICOFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("ICO: canDecode - wrong type", () => {
  // Type = 0 (invalid)
  const wrongType = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x00]);
  const format = new ICOFormat();

  assertEquals(format.canDecode(wrongType), false);
});

test("ICO: canDecode - zero count", () => {
  // Count = 0
  const zeroCount = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
  const format = new ICOFormat();

  assertEquals(format.canDecode(zeroCount), false);
});

test("ICO: decode - invalid data throws", async () => {
  const format = new ICOFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid ICO signature",
  );
});

test("ICO: encode and decode - small image", async () => {
  const format = new ICOFormat();

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

  // Check it starts with ICO signature
  assertEquals(encoded[0], 0x00); // Reserved
  assertEquals(encoded[1], 0x00); // Reserved
  assertEquals(encoded[2], 0x01); // Type = 1 (icon)
  assertEquals(encoded[3], 0x00); // Type high byte
  assertEquals(encoded[4], 0x01); // Count = 1
  assertEquals(encoded[5], 0x00); // Count high byte

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

test("ICO: properties", () => {
  const format = new ICOFormat();

  assertEquals(format.name, "ico");
  assertEquals(format.mimeType, "image/x-icon");
});

test("ICO: encode - single pixel", async () => {
  const format = new ICOFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 128, 128, 255]),
  };

  const encoded = await format.encode(imageData);

  // Should be a valid ICO
  assertEquals(format.canDecode(encoded), true);

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, 1);
  assertEquals(decoded.height, 1);
});

test("ICO: encode and decode - larger image", async () => {
  const format = new ICOFormat();

  // Create a 16x16 gradient image
  const width = 16;
  const height = 16;
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

test("ICO: encode and decode - 32x32 image", async () => {
  const format = new ICOFormat();

  // Create a 32x32 solid color image
  const width = 32;
  const height = 32;
  const data = new Uint8Array(width * height * 4);

  // Fill with a solid blue color
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 0; // R
    data[i * 4 + 1] = 0; // G
    data[i * 4 + 2] = 255; // B
    data[i * 4 + 3] = 255; // A
  }

  const imageData = { width, height, data };

  // Encode and decode
  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Verify a few pixels
  assertEquals(decoded.data[0], 0); // First pixel R
  assertEquals(decoded.data[2], 255); // First pixel B
  assertEquals(decoded.data[3], 255); // First pixel A
});

test("ICO: encode and decode - with transparency", async () => {
  const format = new ICOFormat();

  // Create a 4x4 image with transparency
  const width = 4;
  const height = 4;
  const data = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255; // R
    data[i * 4 + 1] = 0; // G
    data[i * 4 + 2] = 0; // B
    // Checkerboard transparency
    data[i * 4 + 3] = (i % 2 === 0) ? 255 : 128; // A
  }

  const imageData = { width, height, data };

  // Encode and decode
  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, width * height * 4);
});
