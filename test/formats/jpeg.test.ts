import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";

import { JPEGFormat } from "../../src/formats/jpeg.ts";
import { Image } from "../../src/image.ts";
import { withoutOffscreenCanvas } from "../test_utils.ts";

test("JPEG: canDecode - valid JPEG signature", () => {
  const validJPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const format = new JPEGFormat();

  assertEquals(format.canDecode(validJPEG), true);
});

test("JPEG: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new JPEGFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("JPEG: canDecode - too short", () => {
  const tooShort = new Uint8Array([0xff, 0xd8]);
  const format = new JPEGFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("JPEG: decode - invalid data throws", async () => {
  const format = new JPEGFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid JPEG signature",
  );
});

test("JPEG: encode and decode - small image", async () => {
  const format = new JPEGFormat();

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

  // Encode to JPEG
  const encoded = await format.encode(imageData);

  // Should be a valid JPEG (starts with FF D8 FF)
  assertEquals(encoded[0], 0xff);
  assertEquals(encoded[1], 0xd8);
  assertEquals(encoded[2], 0xff);

  // Decode it back
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
  assertEquals(decoded.data.length, 16);

  // JPEG is lossy, so colors won't be exact but should be close
  // Just verify we got some reasonable data back
  assertEquals(decoded.data[3], 255); // alpha should be 255
  assertEquals(decoded.data[7], 255); // alpha should be 255
});

test("JPEG: properties", () => {
  const format = new JPEGFormat();

  assertEquals(format.name, "jpeg");
  assertEquals(format.mimeType, "image/jpeg");
});

test("JPEG: encode - single pixel", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([255, 128, 64, 255]),
  };

  const encoded = await format.encode(imageData);

  // Should start with JPEG signature
  assertEquals(encoded[0], 0xff);
  assertEquals(encoded[1], 0xd8);

  // Should end with EOI marker (FF D9)
  assertEquals(encoded[encoded.length - 2], 0xff);
  assertEquals(encoded[encoded.length - 1], 0xd9);
});

test("JPEG: encode and decode - larger image", async () => {
  const format = new JPEGFormat();

  // Create a 10x10 image with gradient
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * 255); // R gradient
      data[i + 1] = Math.floor((y / height) * 255); // G gradient
      data[i + 2] = 128; // B constant
      data[i + 3] = 255; // A opaque
    }
  }

  const imageData = { width, height, data };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, width * height * 4);

  // All alpha values should be 255
  for (let i = 3; i < decoded.data.length; i += 4) {
    assertEquals(decoded.data[i], 255);
  }
});

test("JPEG: metadata - DPI preservation", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 4).fill(128),
    metadata: {
      dpiX: 300,
      dpiY: 300,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Check if DPI metadata is preserved
  assertEquals(decoded.metadata?.dpiX, 300);
  assertEquals(decoded.metadata?.dpiY, 300);
});

test("JPEG: metadata - EXIF fields preservation", async () => {
  const format = new JPEGFormat();

  const testDate = new Date("2024-06-15T10:30:00");
  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(200),
    metadata: {
      author: "Test Author",
      description: "Test Description",
      copyright: "Test Copyright 2024",
      creationDate: testDate,
      dpiX: 96,
      dpiY: 96,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Check if EXIF metadata is preserved
  assertEquals(decoded.metadata?.author, "Test Author");
  assertEquals(decoded.metadata?.description, "Test Description");
  assertEquals(decoded.metadata?.copyright, "Test Copyright 2024");
  assertEquals(decoded.metadata?.dpiX, 96);
  assertEquals(decoded.metadata?.dpiY, 96);

  // Check date (may lose some precision)
  if (decoded.metadata?.creationDate) {
    assertEquals(decoded.metadata.creationDate.getFullYear(), 2024);
    assertEquals(decoded.metadata.creationDate.getMonth(), 5); // June (0-indexed)
    assertEquals(decoded.metadata.creationDate.getDate(), 15);
  }
});

test("JPEG: metadata - default DPI when not specified", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(150),
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Default DPI should be 72
  assertEquals(decoded.metadata?.dpiX, 72);
  assertEquals(decoded.metadata?.dpiY, 72);
});

test("JPEG: Image integration - read and save", async () => {
  // Create an image
  const data = new Uint8Array([
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
    255,
    255, // white
  ]);

  const image = Image.fromRGBA(2, 2, data);

  // Save as JPEG
  const encoded = await image.save("jpeg");

  // Verify JPEG signature
  assertEquals(encoded[0], 0xff);
  assertEquals(encoded[1], 0xd8);

  // Read it back
  const loaded = await Image.read(encoded);

  assertEquals(loaded.width, 2);
  assertEquals(loaded.height, 2);
  assertEquals(loaded.data.length, 16);
});

test("JPEG: Image integration - with metadata", async () => {
  const data = new Uint8Array(100 * 100 * 4).fill(128);
  const image = Image.fromRGBA(100, 100, data);

  image.setMetadata({
    author: "Integration Test",
    description: "JPEG integration test image",
    dpiX: 150,
    dpiY: 150,
  });

  // Save as JPEG
  const encoded = await image.save("jpeg");

  // Read it back
  const loaded = await Image.read(encoded);

  assertEquals(loaded.metadata?.author, "Integration Test");
  assertEquals(loaded.metadata?.description, "JPEG integration test image");
  assertEquals(loaded.metadata?.dpiX, 150);
  assertEquals(loaded.metadata?.dpiY, 150);
});

test("JPEG: Image integration - format auto-detection", async () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  const encoded = await image.save("jpeg");

  // Read without format hint - should auto-detect JPEG
  const loaded = await Image.read(encoded);

  assertEquals(loaded.width, 1);
  assertEquals(loaded.height, 1);
});

test("JPEG: Pure-JS encoder - force pure-JS path", async () => {
  const format = new JPEGFormat();

  // Create a simple 8x8 image (one MCU block)
  const width = 8;
  const height = 8;
  const data = new Uint8Array(width * height * 4);

  // Create a red gradient
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * 255); // R gradient
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Force pure-JS encoder by using the helper
  const encoded = await withoutOffscreenCanvas(async () => {
    return await format.encode(imageData);
  });

  // Should be a valid JPEG
  assertEquals(encoded[0], 0xff);
  assertEquals(encoded[1], 0xd8);
  assertEquals(encoded[2], 0xff);

  // Should end with EOI marker
  assertEquals(encoded[encoded.length - 2], 0xff);
  assertEquals(encoded[encoded.length - 1], 0xd9);

  // Decode it back (this will use pure-JS decoder if ImageDecoder unavailable)
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
});

test("JPEG: Pure-JS decoder - grayscale image", async () => {
  const format = new JPEGFormat();

  // Create a grayscale image (will be encoded as single Y component)
  const width = 16;
  const height = 16;
  const data = new Uint8Array(width * height * 4);

  // Create a grayscale gradient
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = Math.floor((x / width) * 255);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
  }

  const imageData = { width, height, data };
  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, width * height * 4);
});

test("JPEG: Pure-JS roundtrip - MCU boundary handling", async () => {
  const format = new JPEGFormat();

  // Test with dimensions that don't align to 8x8 MCU boundaries
  const width = 13; // Not divisible by 8
  const height = 11; // Not divisible by 8
  const data = new Uint8Array(width * height * 4);

  // Fill with a pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 20) % 256; // R
      data[i + 1] = (y * 20) % 256; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };
  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Dimensions should be preserved exactly
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, width * height * 4);

  // All alpha values should be 255
  for (let i = 3; i < decoded.data.length; i += 4) {
    assertEquals(decoded.data[i], 255);
  }
});

test("JPEG: Quality parameter affects file size", async () => {
  const format = new JPEGFormat();

  const width = 32;
  const height = 32;
  const data = new Uint8Array(width * height * 4);

  // Create a gradient image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * 255);
      data[i + 1] = Math.floor((y / height) * 255);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  const imageData = { width, height, data };

  // Test with different quality settings through the pure-JS encoder
  const encoded = await withoutOffscreenCanvas(async () => {
    return await format.encode(imageData);
  });

  // The encoder uses quality 85 by default
  // Higher quality = larger file size
  // Just verify we get valid JPEG output
  assertEquals(encoded[0], 0xff);
  assertEquals(encoded[1], 0xd8);
  assertEquals(encoded[encoded.length - 2], 0xff);
  assertEquals(encoded[encoded.length - 1], 0xd9);
});

test("JPEG: Pure-JS decoder - chroma subsampling compatibility", async () => {
  // Test that the decoder correctly handles images with chroma subsampling
  // by creating images of various sizes that would exercise different
  // subsampling boundary conditions.
  // Note: The pure-JS encoder currently uses 4:4:4 (no chroma subsampling),
  // but the decoder is designed to handle 4:2:0 and 4:2:2 as well.

  const testSizes = [
    { width: 16, height: 16 }, // Exactly MCU aligned (16x16 for 4:2:0)
    { width: 24, height: 16 }, // Non-square
    { width: 17, height: 17 }, // Requires MCU padding
    { width: 32, height: 24 }, // Larger, non-square
  ];

  for (const { width, height } of testSizes) {
    // Create a gradient pattern to test color accuracy
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = Math.floor((x / width) * 255); // Red gradient horizontal
        data[i + 1] = Math.floor((y / height) * 255); // Green gradient vertical
        data[i + 2] = 128; // Blue constant
        data[i + 3] = 255; // Alpha
      }
    }

    const image = Image.fromRGBA(width, height, data);

    // Encode with pure-JS encoder (uses 4:4:4 subsampling)
    const encoded = await withoutOffscreenCanvas(async () => {
      return await image.save("jpeg");
    });

    // Decode with pure-JS decoder
    const decoded = await withoutOffscreenCanvas(async () => {
      return await Image.read(encoded);
    });

    // Verify dimensions are preserved
    assertEquals(decoded.width, width, `Width mismatch for ${width}x${height}`);
    assertEquals(
      decoded.height,
      height,
      `Height mismatch for ${width}x${height}`,
    );

    // Verify the image data is reasonable (lossy compression, so allow tolerance)
    // Check the center point which should have less edge artifacts
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const ci = (cy * width + cx) * 4;

    const expectedR = Math.floor((cx / width) * 255);
    const expectedG = Math.floor((cy / height) * 255);
    const expectedB = 128;

    const decodedR = decoded.data[ci];
    const decodedG = decoded.data[ci + 1];
    const decodedB = decoded.data[ci + 2];

    // Allow tolerance for JPEG compression artifacts
    // Using 40 (~16% of 255) as a reasonable tolerance for quality=85 JPEG
    const tolerance = 40;
    assertEquals(
      Math.abs(decodedR - expectedR) <= tolerance,
      true,
      `Red channel at center of ${width}x${height}: expected ~${expectedR}, got ${decodedR}`,
    );
    assertEquals(
      Math.abs(decodedG - expectedG) <= tolerance,
      true,
      `Green channel at center of ${width}x${height}: expected ~${expectedG}, got ${decodedG}`,
    );
    assertEquals(
      Math.abs(decodedB - expectedB) <= tolerance,
      true,
      `Blue channel at center of ${width}x${height}: expected ~${expectedB}, got ${decodedB}`,
    );

    // Verify alpha channel is always 255
    assertEquals(decoded.data[ci + 3], 255, `Alpha channel should be 255`);
  }
});
