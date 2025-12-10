import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { HEICFormat } from "../../src/formats/heic.ts";

const heicFormat = new HEICFormat();

test("HEIC: canDecode - valid HEIC signature (heic brand)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x68,
    0x65,
    0x69,
    0x63, // "heic" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(heicFormat.canDecode(data), true);
});

test("HEIC: canDecode - valid HEIC signature (heix brand)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x68,
    0x65,
    0x69,
    0x78, // "heix" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(heicFormat.canDecode(data), true);
});

test("HEIC: canDecode - valid HEIC signature (mif1 brand)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x6d,
    0x69,
    0x66,
    0x31, // "mif1" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(heicFormat.canDecode(data), true);
});

test("HEIC: canDecode - invalid signature (no ftyp)", () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  assertEquals(heicFormat.canDecode(data), false);
});

test("HEIC: canDecode - invalid signature (wrong brand)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x6a,
    0x70,
    0x32,
    0x20, // "jp2 " brand (JPEG 2000, not HEIC)
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(heicFormat.canDecode(data), false);
});

test("HEIC: canDecode - too short", () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x18]);
  assertEquals(heicFormat.canDecode(data), false);
});

test("HEIC: decode - invalid data throws", async () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  await assertRejects(
    async () => await heicFormat.decode(data),
    Error,
    "Invalid HEIC signature",
  );
});

test("HEIC: properties", () => {
  assertEquals(heicFormat.name, "heic");
  assertEquals(heicFormat.mimeType, "image/heic");
});

test("HEIC: getSupportedMetadata - returns expected fields", () => {
  const supported = heicFormat.getSupportedMetadata();
  assertEquals(supported.includes("creationDate"), true);
  assertEquals(supported.includes("latitude"), true);
  assertEquals(supported.includes("longitude"), true);
  assertEquals(supported.includes("cameraMake"), true);
  assertEquals(supported.includes("cameraModel"), true);
  assertEquals(supported.includes("iso"), true);
  assertEquals(supported.includes("exposureTime"), true);
  assertEquals(supported.includes("fNumber"), true);
  assertEquals(supported.includes("focalLength"), true);
  assertEquals(supported.includes("orientation"), true);
  assertEquals(supported.includes("software"), true);
});

test("HEIC: extractMetadata - invalid data returns undefined", async () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const metadata = await heicFormat.extractMetadata(data);
  assertEquals(metadata, undefined);
});

test("HEIC: extractMetadata - valid HEIC without EXIF returns undefined", async () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x68,
    0x65,
    0x69,
    0x63, // "heic" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  const metadata = await heicFormat.extractMetadata(data);
  // Should return undefined as there's no EXIF data
  assertEquals(metadata, undefined);
});

// Note: Full encode/decode tests require runtime support (ImageDecoder/OffscreenCanvas)
// These APIs may not be available in all test environments
// The tests above verify signature detection and metadata extraction logic
