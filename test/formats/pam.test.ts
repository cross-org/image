import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { PAMFormat } from "../../src/formats/pam.ts";

test("PAM: canDecode - valid PAM signature", () => {
  const encoder = new TextEncoder();
  const validPAM = encoder.encode(
    "P7\nWIDTH 10\nHEIGHT 10\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n",
  );
  const format = new PAMFormat();

  assertEquals(format.canDecode(validPAM), true);
});

test("PAM: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new PAMFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("PAM: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x50, 0x37]);
  const format = new PAMFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("PAM: decode - invalid data throws", async () => {
  const format = new PAMFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid PAM signature",
  );
});

test("PAM: encode and decode - small image", async () => {
  const format = new PAMFormat();

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

test("PAM: properties", () => {
  const format = new PAMFormat();

  assertEquals(format.name, "pam");
  assertEquals(format.mimeType, "image/x-portable-arbitrary-map");
});

test("PAM: encode - single pixel", async () => {
  const format = new PAMFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 64, 32, 255]),
  };

  const encoded = await format.encode(imageData);
  const decoder = new TextDecoder();
  const encodedStr = decoder.decode(encoded);

  // Check header starts with P7
  assertEquals(encodedStr.startsWith("P7\n"), true);

  // Check content contains dimensions
  assertEquals(encodedStr.includes("WIDTH 1\n"), true);
  assertEquals(encodedStr.includes("HEIGHT 1\n"), true);
  assertEquals(encodedStr.includes("DEPTH 4\n"), true);
  assertEquals(encodedStr.includes("MAXVAL 255\n"), true);
  assertEquals(encodedStr.includes("TUPLTYPE RGB_ALPHA\n"), true);
  assertEquals(encodedStr.includes("ENDHDR\n"), true);

  // Check pixel data is at the end
  // The header length is variable, but we can find ENDHDR\n
  const headerEndIndex = encodedStr.indexOf("ENDHDR\n") + 7;

  assertEquals(encoded[headerEndIndex], 128);
  assertEquals(encoded[headerEndIndex + 1], 64);
  assertEquals(encoded[headerEndIndex + 2], 32);
  assertEquals(encoded[headerEndIndex + 3], 255);
});

test("PAM: encode and decode - larger image", async () => {
  const format = new PAMFormat();

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

test("PAM: decode - invalid dimensions", async () => {
  const format = new PAMFormat();

  // Create PAM with zero width
  const encoder = new TextEncoder();
  const invalidWidth = encoder.encode(
    "P7\nWIDTH 0\nHEIGHT 10\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n",
  );

  await assertRejects(
    async () => await format.decode(invalidWidth),
    Error,
    "Invalid PAM dimensions",
  );
});

test("PAM: decode - data length mismatch", async () => {
  const format = new PAMFormat();

  // Create PAM with incorrect data length
  const encoder = new TextEncoder();
  const header = "P7\nWIDTH 2\nHEIGHT 2\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n";
  const headerBytes = encoder.encode(header);
  const wrongLength = new Uint8Array(headerBytes.length + 3); // 3 bytes instead of 16
  wrongLength.set(headerBytes);
  wrongLength.set([255, 0, 0], headerBytes.length);

  await assertRejects(
    async () => await format.decode(wrongLength),
    Error,
    "Invalid PAM data length",
  );
});

test("PAM: encode - data length mismatch", async () => {
  const format = new PAMFormat();

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
