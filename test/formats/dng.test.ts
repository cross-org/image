import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { DNGFormat } from "../../src/formats/dng.ts";

test("DNG: canDecode - valid DNG signature", () => {
  const format = new DNGFormat();
  // Create a minimal DNG structure
  // Header: II (2) + 42 (2) + Offset (4)
  // IFD: NumEntries (2) + Entry (12)
  // Entry: Tag 50706 (2) + Type 1 (2) + Count 4 (4) + Value (4)
  const buffer = new Uint8Array(22);
  const view = new DataView(buffer.buffer);

  // Header
  view.setUint16(0, 0x4949, false); // "II" (but written as number, wait. 0x4949 is II)
  // Actually let's just write bytes
  buffer[0] = 0x49;
  buffer[1] = 0x49; // II
  buffer[2] = 0x2a;
  buffer[3] = 0x00; // 42
  buffer[4] = 0x08;
  buffer[5] = 0x00;
  buffer[6] = 0x00;
  buffer[7] = 0x00; // Offset 8

  // IFD at offset 8
  buffer[8] = 0x01;
  buffer[9] = 0x00; // 1 Entry

  // Entry 1: DNGVersion (50706 = 0xC612)
  buffer[10] = 0x12;
  buffer[11] = 0xC6; // Tag
  buffer[12] = 0x01;
  buffer[13] = 0x00; // Type BYTE
  buffer[14] = 0x04;
  buffer[15] = 0x00;
  buffer[16] = 0x00;
  buffer[17] = 0x00; // Count 4
  buffer[18] = 0x01;
  buffer[19] = 0x01;
  buffer[20] = 0x00;
  buffer[21] = 0x00; // Value (1.1.0.0)

  assertEquals(format.canDecode(buffer), true);
});

test("DNG: encode and decode - small image", async () => {
  const format = new DNGFormat();

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

  // Check that it can be decoded (as it is a valid TIFF)
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

test("DNG: properties", () => {
  const format = new DNGFormat();

  assertEquals(format.name, "dng");
  assertEquals(format.mimeType, "image/x-adobe-dng");
});

test("DNG: check specific tags", async () => {
  const format = new DNGFormat();
  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([100, 100, 100, 255]),
  };

  const encoded = await format.encode(imageData);

  // Helper to read uint16
  const readU16 = (offset: number) =>
    encoded[offset] | (encoded[offset + 1] << 8);
  const readU32 = (offset: number) =>
    encoded[offset] | (encoded[offset + 1] << 8) | (encoded[offset + 2] << 16) |
    (encoded[offset + 3] << 24);

  // Find IFD
  const ifdOffset = readU32(4);
  const numEntries = readU16(ifdOffset);

  let hasDNGVersion = false;
  let hasUniqueCameraModel = false;

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + (i * 12);
    const tag = readU16(entryOffset);

    if (tag === 50706) hasDNGVersion = true;
    if (tag === 50708) hasUniqueCameraModel = true;
  }

  assertEquals(hasDNGVersion, true, "Should have DNGVersion tag");
  assertEquals(hasUniqueCameraModel, true, "Should have UniqueCameraModel tag");
});
