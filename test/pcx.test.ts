import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { PCXFormat } from "../src/formats/pcx.ts";

test("PCX: canDecode - valid PCX signature", () => {
  const format = new PCXFormat();
  const header = new Uint8Array(128);
  header[0] = 0x0A; // Manufacturer
  header[1] = 5; // Version
  header[2] = 1; // Encoding
  assertEquals(format.canDecode(header), true);
});

test("PCX: canDecode - invalid signature", () => {
  const format = new PCXFormat();
  const header = new Uint8Array(128);
  header[0] = 0x00; // Invalid Manufacturer
  assertEquals(format.canDecode(header), false);
});

test("PCX: encode and decode - small image", async () => {
  const format = new PCXFormat();

  // Create a simple 2x2 RGBA image
  const imageData = {
    width: 2,
    height: 2,
    data: new Uint8Array([
      255,
      0,
      0,
      255,
      0,
      255,
      0,
      255,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      255,
    ]),
  };

  // Encode
  const encoded = await format.encode(imageData);

  // Verify header basics
  assertEquals(encoded[0], 0x0A); // Manufacturer
  assertEquals(encoded[1], 5); // Version

  // Decode
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);

  // Check pixels
  // Red
  assertEquals(decoded.data[0], 255);
  assertEquals(decoded.data[1], 0);
  assertEquals(decoded.data[2], 0);
  assertEquals(decoded.data[3], 255);

  // Green
  assertEquals(decoded.data[4], 0);
  assertEquals(decoded.data[5], 255);
  assertEquals(decoded.data[6], 0);
  assertEquals(decoded.data[7], 255);

  // Blue
  assertEquals(decoded.data[8], 0);
  assertEquals(decoded.data[9], 0);
  assertEquals(decoded.data[10], 255);
  assertEquals(decoded.data[11], 255);

  // White
  assertEquals(decoded.data[12], 255);
  assertEquals(decoded.data[13], 255);
  assertEquals(decoded.data[14], 255);
  assertEquals(decoded.data[15], 255);
});
