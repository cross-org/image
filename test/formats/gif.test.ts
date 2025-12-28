import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { GIFFormat } from "../../src/formats/gif.ts";
import type { ImageData, MultiFrameImageData } from "../../src/types.ts";

// Color validation thresholds for GIF quantization tests
const MIN_RED_THRESHOLD = 200;
const MAX_GREEN_BLUE_THRESHOLD = 50;

test("GIF: canDecode - valid GIF89a signature", () => {
  const validGIF = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61,
    0,
    0,
    0,
    0,
  ]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(validGIF), true);
});

test("GIF: canDecode - valid GIF87a signature", () => {
  const validGIF = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x37,
    0x61,
    0,
    0,
    0,
    0,
  ]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(validGIF), true);
});

test("GIF: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("GIF: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x47, 0x49, 0x46]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("GIF: decode - invalid data throws", async () => {
  const format = new GIFFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid GIF signature",
  );
});

test("GIF: properties", () => {
  const format = new GIFFormat();

  assertEquals(format.name, "gif");
  assertEquals(format.mimeType, "image/gif");
});

test("GIF: encode and decode - simple solid color", async () => {
  const format = new GIFFormat();

  // Create a simple 2x2 red image
  const width = 2;
  const height = 2;
  const data = new Uint8Array(width * height * 4);

  // Fill with red color
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 255; // A
  }

  const imageData: ImageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Check dimensions
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Check that all pixels are approximately red
  // (allow for color quantization in GIF encoding)
  for (let i = 0; i < decoded.data.length; i += 4) {
    const r = decoded.data[i];
    const g = decoded.data[i + 1];
    const b = decoded.data[i + 2];

    // Red should be dominant
    assertEquals(
      r > MIN_RED_THRESHOLD,
      true,
      `Pixel ${i / 4}: Red channel should be > ${MIN_RED_THRESHOLD}, got ${r}`,
    );
    assertEquals(
      g < MAX_GREEN_BLUE_THRESHOLD,
      true,
      `Pixel ${i / 4}: Green channel should be < ${MAX_GREEN_BLUE_THRESHOLD}, got ${g}`,
    );
    assertEquals(
      b < MAX_GREEN_BLUE_THRESHOLD,
      true,
      `Pixel ${i / 4}: Blue channel should be < ${MAX_GREEN_BLUE_THRESHOLD}, got ${b}`,
    );
  }
});

test("GIF: encode and decode - multi-color pattern", async () => {
  const format = new GIFFormat();

  // Create a 4x4 image with a simple pattern
  const width = 4;
  const height = 4;
  const data = new Uint8Array(width * height * 4);

  // Create a pattern: red, green, blue, white
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    if (i % 4 === 0) {
      // Red
      data[idx] = 255;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    } else if (i % 4 === 1) {
      // Green
      data[idx] = 0;
      data[idx + 1] = 255;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    } else if (i % 4 === 2) {
      // Blue
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    } else {
      // White
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  const imageData: ImageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Check dimensions
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Verify we have the expected number of bytes
  assertEquals(decoded.data.length, width * height * 4);
});

test("GIF: encode and decode - black and white with color reduction", async () => {
  const format = new GIFFormat();

  // Create an image with many colors (> 256) plus pure black and white
  // This triggers the color reduction path in the encoder
  const width = 20;
  const height = 20;
  const data = new Uint8Array(width * height * 4);

  // Fill with gradient to create many colors (more than 256)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Create gradient with many unique colors
      data[idx] = Math.floor((x / width) * 255); // R
      data[idx + 1] = Math.floor((y / height) * 255); // G
      data[idx + 2] = Math.floor(((x + y) / (width + height)) * 255); // B
      data[idx + 3] = 255; // A
    }
  }

  // Override some pixels to be pure black
  for (let i = 0; i < 10; i++) {
    const idx = i * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }

  // Override some pixels to be pure white
  for (let i = 10; i < 20; i++) {
    const idx = i * 4;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }

  const imageData: ImageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decode(encoded);

  // Check dimensions
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Check that pure black pixels remain black
  for (let i = 0; i < 10; i++) {
    const idx = i * 4;
    const r = decoded.data[idx];
    const g = decoded.data[idx + 1];
    const b = decoded.data[idx + 2];
    assertEquals(
      r === 0 && g === 0 && b === 0,
      true,
      `Black pixel ${i} should be (0,0,0), got (${r},${g},${b})`,
    );
  }

  // Check that pure white pixels remain white (not light brown)
  // This is the key test - with the bug, white would become (224,224,192)
  for (let i = 10; i < 20; i++) {
    const idx = i * 4;
    const r = decoded.data[idx];
    const g = decoded.data[idx + 1];
    const b = decoded.data[idx + 2];
    assertEquals(
      r === 255 && g === 255 && b === 255,
      true,
      `White pixel ${i} should be (255,255,255), got (${r},${g},${b})`,
    );
  }
});

test("GIF: encodeFrames - partial frame with offset position", async () => {
  const format = new GIFFormat();

  // Create a 20x20 canvas with a 10x10 red frame at position (5, 5)
  const canvasWidth = 20;
  const canvasHeight = 20;
  const frameWidth = 10;
  const frameHeight = 10;
  const left = 5;
  const top = 5;

  // Create frame data (10x10 red square)
  const frameData = new Uint8Array(frameWidth * frameHeight * 4);
  for (let i = 0; i < frameData.length; i += 4) {
    frameData[i] = 255; // R
    frameData[i + 1] = 0; // G
    frameData[i + 2] = 0; // B
    frameData[i + 3] = 255; // A
  }

  const multiFrameData: MultiFrameImageData = {
    width: canvasWidth,
    height: canvasHeight,
    frames: [
      {
        width: frameWidth,
        height: frameHeight,
        data: frameData,
        frameMetadata: {
          delay: 100,
          left: left,
          top: top,
          disposal: "none",
        },
      },
    ],
  };

  // Encode
  const encoded = await format.encodeFrames(multiFrameData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decodeFrames(encoded);

  // Check canvas dimensions
  assertEquals(decoded.width, canvasWidth);
  assertEquals(decoded.height, canvasHeight);

  // Check frame count
  assertEquals(decoded.frames.length, 1);

  // Check frame dimensions
  assertEquals(decoded.frames[0].width, frameWidth);
  assertEquals(decoded.frames[0].height, frameHeight);

  // Check frame position
  assertEquals(decoded.frames[0].frameMetadata?.left, left);
  assertEquals(decoded.frames[0].frameMetadata?.top, top);
});

test("GIF: encodeFrames - partial frame with transparency", async () => {
  const format = new GIFFormat();

  // Create a 20x20 canvas with a 10x10 frame at (5, 5) that has transparency
  const canvasWidth = 20;
  const canvasHeight = 20;
  const frameWidth = 10;
  const frameHeight = 10;

  // Create frame data with some transparent pixels (alpha < 128)
  const frameData = new Uint8Array(frameWidth * frameHeight * 4);
  for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const idx = (y * frameWidth + x) * 4;
      // Create a checkerboard pattern with transparency
      if ((x + y) % 2 === 0) {
        // Opaque red
        frameData[idx] = 255; // R
        frameData[idx + 1] = 0; // G
        frameData[idx + 2] = 0; // B
        frameData[idx + 3] = 255; // A (opaque)
      } else {
        // Transparent
        frameData[idx] = 0; // R
        frameData[idx + 1] = 0; // G
        frameData[idx + 2] = 0; // B
        frameData[idx + 3] = 0; // A (transparent)
      }
    }
  }

  const multiFrameData: MultiFrameImageData = {
    width: canvasWidth,
    height: canvasHeight,
    frames: [
      {
        width: frameWidth,
        height: frameHeight,
        data: frameData,
        frameMetadata: {
          delay: 100,
          left: 5,
          top: 5,
          disposal: "none",
        },
      },
    ],
  };

  // Encode
  const encoded = await format.encodeFrames(multiFrameData);

  // Verify it's a valid GIF
  assertEquals(format.canDecode(encoded), true);

  // Decode
  const decoded = await format.decodeFrames(encoded);

  // Check frame dimensions
  assertEquals(decoded.frames[0].width, frameWidth);
  assertEquals(decoded.frames[0].height, frameHeight);

  // Check that transparency is preserved
  // Transparent pixels should have alpha < 128
  let transparentCount = 0;
  for (let i = 0; i < decoded.frames[0].data.length; i += 4) {
    if (decoded.frames[0].data[i + 3] < 128) {
      transparentCount++;
    }
  }
  // Should have approximately half transparent pixels (checkerboard pattern)
  assertEquals(transparentCount > 0, true, "Should have transparent pixels");
});

test("GIF: encodeFrames - disposal method preservation", async () => {
  const format = new GIFFormat();

  const canvasWidth = 10;
  const canvasHeight = 10;

  // Create three frames with different disposal methods
  const createFrame = (color: number[], disposal: "none" | "background" | "previous") => {
    const data = new Uint8Array(canvasWidth * canvasHeight * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color[0]; // R
      data[i + 1] = color[1]; // G
      data[i + 2] = color[2]; // B
      data[i + 3] = 255; // A
    }
    return {
      width: canvasWidth,
      height: canvasHeight,
      data,
      frameMetadata: {
        delay: 100,
        left: 0,
        top: 0,
        disposal: disposal,
      },
    };
  };

  const multiFrameData: MultiFrameImageData = {
    width: canvasWidth,
    height: canvasHeight,
    frames: [
      createFrame([255, 0, 0], "none"), // Red, none
      createFrame([0, 255, 0], "background"), // Green, background
      createFrame([0, 0, 255], "previous"), // Blue, previous
    ],
  };

  // Encode
  const encoded = await format.encodeFrames(multiFrameData);

  // Decode
  const decoded = await format.decodeFrames(encoded);

  // Check that disposal methods are preserved
  assertEquals(decoded.frames.length, 3);
  assertEquals(decoded.frames[0].frameMetadata?.disposal, "none");
  assertEquals(decoded.frames[1].frameMetadata?.disposal, "background");
  assertEquals(decoded.frames[2].frameMetadata?.disposal, "previous");
});

test("GIF: encodeFrames - round-trip with partial frames and transparency", async () => {
  const format = new GIFFormat();

  // Create a 30x30 canvas with two partial frames at different positions
  const canvasWidth = 30;
  const canvasHeight = 30;

  // Frame 1: 10x10 red square at (5, 5) with some transparency
  const frame1Data = new Uint8Array(10 * 10 * 4);
  for (let i = 0; i < frame1Data.length; i += 4) {
    frame1Data[i] = 255; // R
    frame1Data[i + 1] = 0; // G
    frame1Data[i + 2] = 0; // B
    // Make every 3rd pixel transparent
    frame1Data[i + 3] = (i / 4) % 3 === 0 ? 0 : 255; // A
  }

  // Frame 2: 8x8 blue square at (15, 15) with transparency
  const frame2Data = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < frame2Data.length; i += 4) {
    frame2Data[i] = 0; // R
    frame2Data[i + 1] = 0; // G
    frame2Data[i + 2] = 255; // B
    // Make every 2nd pixel transparent
    frame2Data[i + 3] = (i / 4) % 2 === 0 ? 0 : 255; // A
  }

  const originalData: MultiFrameImageData = {
    width: canvasWidth,
    height: canvasHeight,
    frames: [
      {
        width: 10,
        height: 10,
        data: frame1Data,
        frameMetadata: {
          delay: 100,
          left: 5,
          top: 5,
          disposal: "background",
        },
      },
      {
        width: 8,
        height: 8,
        data: frame2Data,
        frameMetadata: {
          delay: 150,
          left: 15,
          top: 15,
          disposal: "previous",
        },
      },
    ],
  };

  // First round-trip: encode -> decode
  const encoded1 = await format.encodeFrames(originalData);
  const decoded1 = await format.decodeFrames(encoded1);

  // Verify first round-trip
  assertEquals(decoded1.width, canvasWidth);
  assertEquals(decoded1.height, canvasHeight);
  assertEquals(decoded1.frames.length, 2);

  // Check frame 1 metadata
  assertEquals(decoded1.frames[0].width, 10);
  assertEquals(decoded1.frames[0].height, 10);
  assertEquals(decoded1.frames[0].frameMetadata?.left, 5);
  assertEquals(decoded1.frames[0].frameMetadata?.top, 5);
  assertEquals(decoded1.frames[0].frameMetadata?.disposal, "background");

  // Check frame 2 metadata
  assertEquals(decoded1.frames[1].width, 8);
  assertEquals(decoded1.frames[1].height, 8);
  assertEquals(decoded1.frames[1].frameMetadata?.left, 15);
  assertEquals(decoded1.frames[1].frameMetadata?.top, 15);
  assertEquals(decoded1.frames[1].frameMetadata?.disposal, "previous");

  // Second round-trip: encode -> decode again
  const encoded2 = await format.encodeFrames(decoded1);
  const decoded2 = await format.decodeFrames(encoded2);

  // Verify second round-trip preserves everything
  assertEquals(decoded2.width, canvasWidth);
  assertEquals(decoded2.height, canvasHeight);
  assertEquals(decoded2.frames.length, 2);

  // Check frame 1 metadata is still preserved
  assertEquals(decoded2.frames[0].width, 10);
  assertEquals(decoded2.frames[0].height, 10);
  assertEquals(decoded2.frames[0].frameMetadata?.left, 5);
  assertEquals(decoded2.frames[0].frameMetadata?.top, 5);
  assertEquals(decoded2.frames[0].frameMetadata?.disposal, "background");

  // Check frame 2 metadata is still preserved
  assertEquals(decoded2.frames[1].width, 8);
  assertEquals(decoded2.frames[1].height, 8);
  assertEquals(decoded2.frames[1].frameMetadata?.left, 15);
  assertEquals(decoded2.frames[1].frameMetadata?.top, 15);
  assertEquals(decoded2.frames[1].frameMetadata?.disposal, "previous");
});

test("GIF: encodeFrames - multiple partial frames at different positions", async () => {
  const format = new GIFFormat();

  // Create a 20x20 canvas with multiple small frames at different positions
  const canvasWidth = 20;
  const canvasHeight = 20;

  const multiFrameData: MultiFrameImageData = {
    width: canvasWidth,
    height: canvasHeight,
    frames: [
      {
        width: 5,
        height: 5,
        data: new Uint8Array(5 * 5 * 4).fill(255).map((_, i) =>
          i % 4 === 0 ? 255 : i % 4 === 3 ? 255 : 0
        ), // Red
        frameMetadata: {
          delay: 100,
          left: 2,
          top: 2,
          disposal: "none",
        },
      },
      {
        width: 6,
        height: 6,
        data: new Uint8Array(6 * 6 * 4).fill(255).map((_, i) =>
          i % 4 === 1 ? 255 : i % 4 === 3 ? 255 : 0
        ), // Green
        frameMetadata: {
          delay: 100,
          left: 10,
          top: 3,
          disposal: "background",
        },
      },
      {
        width: 4,
        height: 4,
        data: new Uint8Array(4 * 4 * 4).fill(255).map((_, i) =>
          i % 4 === 2 ? 255 : i % 4 === 3 ? 255 : 0
        ), // Blue
        frameMetadata: {
          delay: 100,
          left: 5,
          top: 12,
          disposal: "previous",
        },
      },
    ],
  };

  // Encode
  const encoded = await format.encodeFrames(multiFrameData);

  // Decode
  const decoded = await format.decodeFrames(encoded);

  // Verify all frames are preserved with correct metadata
  assertEquals(decoded.frames.length, 3);

  // Frame 1: 5x5 at (2, 2)
  assertEquals(decoded.frames[0].width, 5);
  assertEquals(decoded.frames[0].height, 5);
  assertEquals(decoded.frames[0].frameMetadata?.left, 2);
  assertEquals(decoded.frames[0].frameMetadata?.top, 2);
  assertEquals(decoded.frames[0].frameMetadata?.disposal, "none");

  // Frame 2: 6x6 at (10, 3)
  assertEquals(decoded.frames[1].width, 6);
  assertEquals(decoded.frames[1].height, 6);
  assertEquals(decoded.frames[1].frameMetadata?.left, 10);
  assertEquals(decoded.frames[1].frameMetadata?.top, 3);
  assertEquals(decoded.frames[1].frameMetadata?.disposal, "background");

  // Frame 3: 4x4 at (5, 12)
  assertEquals(decoded.frames[2].width, 4);
  assertEquals(decoded.frames[2].height, 4);
  assertEquals(decoded.frames[2].frameMetadata?.left, 5);
  assertEquals(decoded.frames[2].frameMetadata?.top, 12);
  assertEquals(decoded.frames[2].frameMetadata?.disposal, "previous");
});
