import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { GIFFormat } from "../src/formats/gif.ts";
import { TIFFFormat } from "../src/formats/tiff.ts";
import { Image } from "../src/image.ts";
import type { ImageFrame, MultiFrameImageData } from "../src/types.ts";

/**
 * Create test frame data with a specific color
 */
function createTestFrame(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): ImageFrame {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return {
    width,
    height,
    data,
    frameMetadata: {
      delay: 100,
      disposal: "none",
      left: 0,
      top: 0,
    },
  };
}

/**
 * Create multi-frame test data
 */
function createMultiFrameTestData(): MultiFrameImageData {
  return {
    width: 10,
    height: 10,
    frames: [
      createTestFrame(10, 10, 255, 0, 0), // Red frame
      createTestFrame(10, 10, 0, 255, 0), // Green frame
      createTestFrame(10, 10, 0, 0, 255), // Blue frame
    ],
  };
}

// GIF Tests

test("GIF: supportsMultipleFrames returns true", () => {
  const format = new GIFFormat();
  assertEquals(format.supportsMultipleFrames?.(), true);
});

test("GIF: decodeFrames - decode multi-frame GIF", async () => {
  const format = new GIFFormat();

  // Create a simple GIF with 2 frames
  const multiFrameData = createMultiFrameTestData();

  // For this test, we'll encode and decode
  // Note: Current implementation only encodes first frame, so we expect 1 frame
  const encoded = await format.encodeFrames(multiFrameData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode all frames
  const decoded = await format.decodeFrames(encoded);

  // Should have the canvas dimensions
  assertEquals(decoded.width, 10);
  assertEquals(decoded.height, 10);

  // Should have at least one frame (since we only encode first frame currently)
  assertEquals(decoded.frames.length >= 1, true);

  // First frame should have proper dimensions
  assertEquals(decoded.frames[0].width, 10);
  assertEquals(decoded.frames[0].height, 10);
});

test("GIF: encodeFrames - encode multi-frame data", async () => {
  const format = new GIFFormat();

  const multiFrameData = createMultiFrameTestData();

  // Encode
  const encoded = await format.encodeFrames(multiFrameData);

  // Should be a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Should be able to decode as multi-frame
  const decoded = await format.decodeFrames(encoded);
  assertEquals(decoded.frames.length, 3);
  // Check frame colors (sampling center pixel)
  // Frame 1: Red
  assertEquals(decoded.frames[0].data[0], 255);
  assertEquals(decoded.frames[0].data[1], 0);
  assertEquals(decoded.frames[0].data[2], 0);
  // Frame 2: Green
  assertEquals(decoded.frames[1].data[0], 0);
  assertEquals(decoded.frames[1].data[1], 255);
  assertEquals(decoded.frames[1].data[2], 0);
  // Frame 3: Blue
  assertEquals(decoded.frames[2].data[0], 0);
  assertEquals(decoded.frames[2].data[1], 0);
  assertEquals(decoded.frames[2].data[2], 255);
});

test("GIF: encodeFrames - throws on empty frames", async () => {
  const format = new GIFFormat();

  const emptyData: MultiFrameImageData = {
    width: 10,
    height: 10,
    frames: [],
  };

  try {
    await format.encodeFrames(emptyData);
    throw new Error("Should have thrown");
  } catch (error) {
    assertEquals((error as Error).message.includes("No frames"), true);
  }
});

// TIFF Tests

test("TIFF: supportsMultipleFrames returns true", () => {
  const format = new TIFFFormat();
  assertEquals(format.supportsMultipleFrames?.(), true);
});

test("TIFF: encodeFrames and decodeFrames - single page", async () => {
  const format = new TIFFFormat();

  const multiFrameData: MultiFrameImageData = {
    width: 5,
    height: 5,
    frames: [createTestFrame(5, 5, 255, 0, 0)],
  };

  // Encode
  const encoded = await format.encodeFrames(multiFrameData);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);

  // Decode all frames
  const decoded = await format.decodeFrames(encoded);

  assertEquals(decoded.frames.length, 1);
  assertEquals(decoded.frames[0].width, 5);
  assertEquals(decoded.frames[0].height, 5);
});

test("TIFF: encodeFrames and decodeFrames - multi-page", async () => {
  const format = new TIFFFormat();

  const multiFrameData = createMultiFrameTestData();

  // Encode multi-page TIFF
  const encoded = await format.encodeFrames(multiFrameData);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);

  // Decode all pages
  const decoded = await format.decodeFrames(encoded);

  // Should have 3 pages
  assertEquals(decoded.frames.length, 3);

  // Check dimensions of each page
  for (let i = 0; i < decoded.frames.length; i++) {
    assertEquals(decoded.frames[i].width, 10);
    assertEquals(decoded.frames[i].height, 10);
  }

  // Verify pixel data matches original (check first pixel of each frame)
  // Red frame
  assertEquals(decoded.frames[0].data[0], 255); // R
  assertEquals(decoded.frames[0].data[1], 0); // G
  assertEquals(decoded.frames[0].data[2], 0); // B

  // Green frame
  assertEquals(decoded.frames[1].data[0], 0); // R
  assertEquals(decoded.frames[1].data[1], 255); // G
  assertEquals(decoded.frames[1].data[2], 0); // B

  // Blue frame
  assertEquals(decoded.frames[2].data[0], 0); // R
  assertEquals(decoded.frames[2].data[1], 0); // G
  assertEquals(decoded.frames[2].data[2], 255); // B
});

test("TIFF: encodeFrames with LZW compression - multi-page", async () => {
  const format = new TIFFFormat();

  const multiFrameData = createMultiFrameTestData();

  // Encode multi-page TIFF with LZW compression
  const encoded = await format.encodeFrames(multiFrameData, {
    compression: "lzw",
  });

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);

  // Decode all pages
  const decoded = await format.decodeFrames(encoded);

  // Should have 3 pages
  assertEquals(decoded.frames.length, 3);

  // Verify pixel data matches (LZW is lossless)
  assertEquals(decoded.frames[0].data[0], 255); // First pixel of red frame
  assertEquals(decoded.frames[1].data[1], 255); // First pixel of green frame
  assertEquals(decoded.frames[2].data[2], 255); // First pixel of blue frame
});

test("TIFF: encodeFrames - throws on empty frames", async () => {
  const format = new TIFFFormat();

  const emptyData: MultiFrameImageData = {
    width: 10,
    height: 10,
    frames: [],
  };

  try {
    await format.encodeFrames(emptyData);
    throw new Error("Should have thrown");
  } catch (error) {
    assertEquals((error as Error).message.includes("No frames"), true);
  }
});

test("TIFF: encodeFrames with metadata", async () => {
  const format = new TIFFFormat();

  const multiFrameData: MultiFrameImageData = {
    width: 5,
    height: 5,
    frames: [createTestFrame(5, 5, 255, 0, 0)],
    metadata: {
      description: "Test multi-page TIFF",
      author: "Test Author",
      copyright: "Test Copyright",
    },
  };

  // Encode
  const encoded = await format.encodeFrames(multiFrameData);

  // Decode and check metadata
  const decoded = await format.decodeFrames(encoded);

  assertEquals(decoded.metadata?.description, "Test multi-page TIFF");
  assertEquals(decoded.metadata?.author, "Test Author");
  assertEquals(decoded.metadata?.copyright, "Test Copyright");
});

// Image class static methods tests

test("Image.readFrames - GIF format", async () => {
  const format = new GIFFormat();
  const multiFrameData = createMultiFrameTestData();

  // Encode a multi-frame GIF
  const encoded = await format.encodeFrames(multiFrameData);

  // Read using Image.readFrames
  const decoded = await Image.readFrames(encoded, "gif");

  assertEquals(decoded.width, 10);
  assertEquals(decoded.height, 10);
  assertEquals(decoded.frames.length >= 1, true);
});

test("Image.readFrames - TIFF format", async () => {
  const format = new TIFFFormat();
  const multiFrameData = createMultiFrameTestData();

  // Encode a multi-page TIFF
  const encoded = await format.encodeFrames(multiFrameData);

  // Read using Image.readFrames
  const decoded = await Image.readFrames(encoded, "tiff");

  assertEquals(decoded.width, 10);
  assertEquals(decoded.height, 10);
  assertEquals(decoded.frames.length, 3);
});

test("Image.readFrames - auto-detect TIFF format", async () => {
  const format = new TIFFFormat();
  const multiFrameData: MultiFrameImageData = {
    width: 5,
    height: 5,
    frames: [createTestFrame(5, 5, 128, 128, 128)],
  };

  // Encode a TIFF
  const encoded = await format.encodeFrames(multiFrameData);

  // Read without format hint (auto-detect)
  const decoded = await Image.readFrames(encoded);

  assertEquals(decoded.width, 5);
  assertEquals(decoded.height, 5);
  assertEquals(decoded.frames.length, 1);
});

test("Image.saveFrames - TIFF format", async () => {
  const multiFrameData = createMultiFrameTestData();

  // Save using Image.saveFrames
  const encoded = await Image.saveFrames("tiff", multiFrameData);

  // Verify it's a valid TIFF
  const format = new TIFFFormat();
  assertEquals(format.canDecode(encoded), true);

  // Decode and verify
  const decoded = await format.decodeFrames(encoded);
  assertEquals(decoded.frames.length, 3);
});

test("Image.saveFrames - GIF format", async () => {
  const multiFrameData = createMultiFrameTestData();

  // Save using Image.saveFrames
  const encoded = await Image.saveFrames("gif", multiFrameData);

  // Verify it's a valid GIF
  const format = new GIFFormat();
  assertEquals(format.canDecode(encoded), true);
});

test("Image.saveFrames - throws on unsupported format", async () => {
  const multiFrameData = createMultiFrameTestData();

  try {
    await Image.saveFrames("png", multiFrameData);
    throw new Error("Should have thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message.includes("does not support"),
      true,
    );
  }
});

test("Image.saveFrames - throws on invalid format", async () => {
  const multiFrameData = createMultiFrameTestData();

  try {
    await Image.saveFrames("invalid-format", multiFrameData);
    throw new Error("Should have thrown");
  } catch (error) {
    assertEquals((error as Error).message.includes("Unsupported"), true);
  }
});

// Backwards compatibility tests

test("GIF: decode single frame (backwards compatible)", async () => {
  const format = new GIFFormat();

  // Create single frame
  const imageData = {
    width: 5,
    height: 5,
    data: new Uint8Array(5 * 5 * 4).fill(128),
  };

  // Encode using single-frame method
  const encoded = await format.encode(imageData);

  // Decode using single-frame method
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 5);
  assertEquals(decoded.height, 5);
});

test("TIFF: decode single page (backwards compatible)", async () => {
  const format = new TIFFFormat();

  // Create single frame
  const imageData = {
    width: 5,
    height: 5,
    data: new Uint8Array(5 * 5 * 4).fill(128),
  };

  // Encode using single-frame method
  const encoded = await format.encode(imageData);

  // Decode using single-frame method
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 5);
  assertEquals(decoded.height, 5);
});
