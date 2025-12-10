import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { AVIFFormat } from "../../src/formats/avif.ts";

const avifFormat = new AVIFFormat();

test("AVIF: canDecode - valid AVIF signature (avif brand)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x61,
    0x76,
    0x69,
    0x66, // "avif" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(avifFormat.canDecode(data), true);
});

test("AVIF: canDecode - valid AVIF signature (avis brand)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x61,
    0x76,
    0x69,
    0x73, // "avis" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(avifFormat.canDecode(data), true);
});

test("AVIF: canDecode - valid AVIF signature (avio brand)", () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x61,
    0x76,
    0x69,
    0x6f, // "avio" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(avifFormat.canDecode(data), true);
});

test("AVIF: canDecode - invalid signature (no ftyp)", () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  assertEquals(avifFormat.canDecode(data), false);
});

test("AVIF: canDecode - invalid signature (wrong brand)", () => {
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
    0x20, // "jp2 " brand (JPEG 2000, not AVIF)
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  assertEquals(avifFormat.canDecode(data), false);
});

test("AVIF: canDecode - too short", () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x18]);
  assertEquals(avifFormat.canDecode(data), false);
});

test("AVIF: decode - invalid data throws", async () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  await assertRejects(
    async () => await avifFormat.decode(data),
    Error,
    "Invalid AVIF signature",
  );
});

test("AVIF: properties", () => {
  assertEquals(avifFormat.name, "avif");
  assertEquals(avifFormat.mimeType, "image/avif");
});

test("AVIF: getSupportedMetadata - returns expected fields", () => {
  const supported = avifFormat.getSupportedMetadata();
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

test("AVIF: extractMetadata - invalid data returns undefined", async () => {
  const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const metadata = await avifFormat.extractMetadata(data);
  assertEquals(metadata, undefined);
});

test("AVIF: extractMetadata - valid AVIF without EXIF returns undefined", async () => {
  const data = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x18, // box size
    0x66,
    0x74,
    0x79,
    0x70, // "ftyp"
    0x61,
    0x76,
    0x69,
    0x66, // "avif" brand
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ]);
  const metadata = await avifFormat.extractMetadata(data);
  // Should return undefined as there's no EXIF data
  assertEquals(metadata, undefined);
});

// Note: Full encode/decode tests require runtime support (ImageDecoder/OffscreenCanvas)
// These APIs may not be available in all test environments
// The tests above verify signature detection and metadata extraction logic
