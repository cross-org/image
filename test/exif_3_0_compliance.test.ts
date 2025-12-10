/**
 * Tests for EXIF 3.0 specification compliance
 * Validates InteropIFD support and extended tag handling
 */

import { assertEquals, assertExists } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../mod.ts";
import {
  createInteropIFD,
  EXIF_VERSION,
  INTEROP_INDEX,
  parseInteropIFD,
} from "../src/utils/metadata/exif.ts";

test("EXIF 3.0: InteropIFD creation (R98)", () => {
  const ifd = createInteropIFD(INTEROP_INDEX.R98, true);
  assertExists(ifd);
  assertEquals(ifd.length > 0, true);

  // Verify structure: 2 entries (InteropIndex and InteropVersion)
  const numEntries = ifd[0] | (ifd[1] << 8);
  assertEquals(numEntries, 2);
});

test("EXIF 3.0: InteropIFD creation (R03)", () => {
  const ifd = createInteropIFD(INTEROP_INDEX.R03, true);
  assertExists(ifd);

  const numEntries = ifd[0] | (ifd[1] << 8);
  assertEquals(numEntries, 2);
});

test("EXIF 3.0: InteropIFD creation (THM)", () => {
  const ifd = createInteropIFD(INTEROP_INDEX.THM, true);
  assertExists(ifd);

  const numEntries = ifd[0] | (ifd[1] << 8);
  assertEquals(numEntries, 2);
});

test("EXIF 3.0: InteropIFD parsing roundtrip", () => {
  const ifd = createInteropIFD(INTEROP_INDEX.R98, true);
  const data = new Uint8Array(ifd);

  const parsed = parseInteropIFD(data, 0, true);
  assertEquals(parsed, INTEROP_INDEX.R98);
});

test("EXIF 3.0: EXIF version constants defined", () => {
  assertEquals(EXIF_VERSION.V2_2, "0220");
  assertEquals(EXIF_VERSION.V2_21, "0221");
  assertEquals(EXIF_VERSION.V2_3, "0230");
  assertEquals(EXIF_VERSION.V3_0, "0300");
});

test("EXIF 3.0: TIFF format reports metadata support", () => {
  const supported = Image.getSupportedMetadata("tiff");

  assertExists(supported);
  assertEquals(supported.length > 0, true);

  // Should support extended metadata
  assertEquals(supported.includes("cameraMake"), true);
  assertEquals(supported.includes("cameraModel"), true);
  assertEquals(supported.includes("iso"), true);
  assertEquals(supported.includes("exposureTime"), true);
  assertEquals(supported.includes("fNumber"), true);
  assertEquals(supported.includes("focalLength"), true);
  assertEquals(supported.includes("latitude"), true);
  assertEquals(supported.includes("longitude"), true);
});

test("EXIF 3.0: JPEG format supports extended tags", () => {
  const supported = Image.getSupportedMetadata("jpeg");

  assertExists(supported);

  // JPEG should have comprehensive EXIF support
  assertEquals(supported.includes("cameraMake"), true);
  assertEquals(supported.includes("lensMake"), true);
  assertEquals(supported.includes("userComment"), true);
  assertEquals(supported.includes("flash"), true);
  assertEquals(supported.includes("whiteBalance"), true);
});

test("EXIF 3.0: getSupportedMetadata static method", () => {
  const jpegSupported = Image.getSupportedMetadata("jpeg");
  const pngSupported = Image.getSupportedMetadata("png");
  const webpSupported = Image.getSupportedMetadata("webp");
  const tiffSupported = Image.getSupportedMetadata("tiff");

  assertExists(jpegSupported);
  assertExists(pngSupported);
  assertExists(webpSupported);
  assertExists(tiffSupported);

  // JPEG should have the most comprehensive support
  assertEquals(jpegSupported.length >= 21, true);

  // TIFF should now have extensive support
  assertEquals(tiffSupported.length >= 20, true);

  // PNG has more limited support
  assertEquals(pngSupported.length >= 9, true);

  // WebP has XMP support
  assertEquals(webpSupported.length >= 15, true);
});
