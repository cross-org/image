import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { APNGFormat } from "../../src/formats/apng.ts";
import type { ImageData, MultiFrameImageData } from "../../src/types.ts";

test("APNG: canDecode - valid APNG with acTL chunk", () => {
  // Minimal APNG structure with PNG signature, IHDR, acTL, IDAT, IEND
  const validAPNG = new Uint8Array([
    // PNG signature
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    // IHDR chunk (13 bytes data)
    0,
    0,
    0,
    13, // length
    73,
    72,
    68,
    82, // "IHDR"
    0,
    0,
    0,
    1, // width
    0,
    0,
    0,
    1, // height
    8, // bit depth
    6, // color type (RGBA)
    0, // compression
    0, // filter
    0, // interlace
    0,
    0,
    0,
    0, // CRC (placeholder)
    // acTL chunk (8 bytes data)
    0,
    0,
    0,
    8, // length
    97,
    99,
    84,
    76, // "acTL"
    0,
    0,
    0,
    1, // num_frames
    0,
    0,
    0,
    0, // num_plays
    0,
    0,
    0,
    0, // CRC (placeholder)
  ]);
  const format = new APNGFormat();

  assertEquals(format.canDecode(validAPNG), true);
});

test("APNG: canDecode - regular PNG without acTL chunk", () => {
  // Regular PNG without acTL chunk
  const regularPNG = new Uint8Array([
    // PNG signature
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    // IHDR chunk
    0,
    0,
    0,
    13,
    73,
    72,
    68,
    82,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
    8,
    6,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // IDAT chunk (no acTL before it)
    0,
    0,
    0,
    0,
    73,
    68,
    65,
    84,
    0,
    0,
    0,
    0,
  ]);
  const format = new APNGFormat();

  assertEquals(format.canDecode(regularPNG), false);
});

test("APNG: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new APNGFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("APNG: canDecode - too short", () => {
  const tooShort = new Uint8Array([137, 80, 78]);
  const format = new APNGFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("APNG: decode - invalid data throws", async () => {
  const format = new APNGFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid APNG signature",
  );
});

test("APNG: properties", () => {
  const format = new APNGFormat();

  assertEquals(format.name, "apng");
  assertEquals(format.mimeType, "image/apng");
  assertEquals(format.supportsMultipleFrames(), true);
});

test("APNG: encode and decode - single frame", async () => {
  const format = new APNGFormat();

  // Create a simple 2x2 RGBA image (red square)
  const imageData: ImageData = {
    width: 2,
    height: 2,
    data: new Uint8Array([
      255,
      0,
      0,
      255, // red pixel
      255,
      0,
      0,
      255, // red pixel
      255,
      0,
      0,
      255, // red pixel
      255,
      0,
      0,
      255, // red pixel
    ]),
  };

  // Encode to APNG
  const encoded = await format.encode(imageData);

  // Verify it's a valid APNG
  assertEquals(format.canDecode(encoded), true);

  // Decode back
  const decoded = await format.decode(encoded);

  // Verify dimensions
  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);

  // Verify pixels (allow some compression artifacts)
  assertEquals(decoded.data.length, 16);
});

test("APNG: encodeFrames and decodeFrames - multiple frames", async () => {
  const format = new APNGFormat();

  // Create a simple 2-frame animation
  const multiFrame: MultiFrameImageData = {
    width: 2,
    height: 2,
    frames: [
      {
        width: 2,
        height: 2,
        data: new Uint8Array([
          255,
          0,
          0,
          255, // red
          255,
          0,
          0,
          255,
          255,
          0,
          0,
          255,
          255,
          0,
          0,
          255,
        ]),
        frameMetadata: {
          delay: 100,
          disposal: "none",
          left: 0,
          top: 0,
        },
      },
      {
        width: 2,
        height: 2,
        data: new Uint8Array([
          0,
          0,
          255,
          255, // blue
          0,
          0,
          255,
          255,
          0,
          0,
          255,
          255,
          0,
          0,
          255,
          255,
        ]),
        frameMetadata: {
          delay: 100,
          disposal: "background",
          left: 0,
          top: 0,
        },
      },
    ],
  };

  // Encode to APNG
  const encoded = await format.encodeFrames(multiFrame);

  // Verify it's a valid APNG
  assertEquals(format.canDecode(encoded), true);

  // Decode back
  const decoded = await format.decodeFrames(encoded);

  // Verify dimensions
  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);

  // Verify frame count
  assertEquals(decoded.frames.length, 2);

  // Verify first frame
  assertEquals(decoded.frames[0].width, 2);
  assertEquals(decoded.frames[0].height, 2);
  assertEquals(decoded.frames[0].frameMetadata?.delay, 100);

  // Verify second frame
  assertEquals(decoded.frames[1].width, 2);
  assertEquals(decoded.frames[1].height, 2);
  assertEquals(decoded.frames[1].frameMetadata?.delay, 100);
});

test("APNG: encode with metadata", async () => {
  const format = new APNGFormat();

  const imageData: ImageData = {
    width: 2,
    height: 2,
    data: new Uint8Array(16).fill(255),
    metadata: {
      title: "Test Image",
      author: "Test Author",
      description: "Test Description",
      dpiX: 96,
      dpiY: 96,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.title, "Test Image");
  assertEquals(decoded.metadata?.author, "Test Author");
  assertEquals(decoded.metadata?.description, "Test Description");
  assertEquals(decoded.metadata?.dpiX, 96);
  assertEquals(decoded.metadata?.dpiY, 96);
});

test("APNG: encode - no frames throws", async () => {
  const format = new APNGFormat();

  const multiFrame: MultiFrameImageData = {
    width: 2,
    height: 2,
    frames: [],
  };

  await assertRejects(
    async () => await format.encodeFrames(multiFrame),
    Error,
    "No frames to encode",
  );
});

test("APNG: encodeFrames - frame with offset", async () => {
  const format = new APNGFormat();

  const multiFrame: MultiFrameImageData = {
    width: 4,
    height: 4,
    frames: [
      {
        width: 2,
        height: 2,
        data: new Uint8Array(16).fill(255),
        frameMetadata: {
          delay: 100,
          left: 1,
          top: 1,
        },
      },
    ],
  };

  const encoded = await format.encodeFrames(multiFrame);
  const decoded = await format.decodeFrames(encoded);

  assertEquals(decoded.frames[0].frameMetadata?.left, 1);
  assertEquals(decoded.frames[0].frameMetadata?.top, 1);
});
