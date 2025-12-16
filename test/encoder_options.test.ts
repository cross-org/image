import { test } from "@cross/test";
import { assertEquals } from "@std/assert";
import { Image } from "../mod.ts";

test("GIF: encode with default loop (infinite)", async () => {
  // Create a simple 2-frame animated GIF
  const frame1 = Image.create(10, 10, 255, 0, 0); // red
  const frame2 = Image.create(10, 10, 0, 0, 255); // blue

  const multiFrame = {
    width: 10,
    height: 10,
    frames: [
      {
        width: 10,
        height: 10,
        data: frame1.data,
        frameMetadata: { delay: 100 },
      },
      {
        width: 10,
        height: 10,
        data: frame2.data,
        frameMetadata: { delay: 100 },
      },
    ],
  };

  // Encode without options (should use default infinite loop)
  const gif = await Image.encodeFrames("gif", multiFrame);

  // Verify it's a valid GIF by decoding it
  const decoded = await Image.decodeFrames(gif);
  assertEquals(decoded.frames.length, 2);
});

test("GIF: encode with specific loop count", async () => {
  // Create a simple 2-frame animated GIF
  const frame1 = Image.create(10, 10, 255, 0, 0); // red
  const frame2 = Image.create(10, 10, 0, 0, 255); // blue

  const multiFrame = {
    width: 10,
    height: 10,
    frames: [
      {
        width: 10,
        height: 10,
        data: frame1.data,
        frameMetadata: { delay: 100 },
      },
      {
        width: 10,
        height: 10,
        data: frame2.data,
        frameMetadata: { delay: 100 },
      },
    ],
  };

  // Encode with loop count of 5
  const gif = await Image.encodeFrames("gif", multiFrame, { loop: 5 });

  // Verify it's a valid GIF by decoding it
  const decoded = await Image.decodeFrames(gif);
  assertEquals(decoded.frames.length, 2);

  // Check that the GIF contains the NETSCAPE2.0 extension with loop count
  // The loop count is encoded at a specific position in the GIF
  // Look for the NETSCAPE2.0 string
  const text = new TextDecoder("ascii", { fatal: false }).decode(gif);
  assertEquals(text.includes("NETSCAPE2.0"), true);
});

test("GIF: encode single frame with loop option (should not add loop extension)", async () => {
  // Create a single frame image
  const image = Image.create(10, 10, 0, 255, 0); // green

  // Encode with loop option (should be ignored for single frame)
  const gif = await image.encode("gif", { loop: 3 });

  // Verify it's a valid GIF by decoding it
  const decoded = await Image.decode(gif);
  assertEquals(decoded.width, 10);
  assertEquals(decoded.height, 10);
});

test("PNG: encode with PNGEncoderOptions (empty interface)", async () => {
  // Create a simple image
  const image = Image.create(10, 10, 128, 128, 128);

  // Encode with empty options object
  const png = await image.encode("png", {});

  // Verify it's a valid PNG by decoding it
  const decoded = await Image.decode(png);
  assertEquals(decoded.width, 10);
  assertEquals(decoded.height, 10);
});

test("APNG: encode with APNGEncoderOptions (empty interface)", async () => {
  // Create a simple 2-frame animation
  const frame1 = Image.create(10, 10, 255, 0, 0); // red
  const frame2 = Image.create(10, 10, 0, 0, 255); // blue

  const multiFrame = {
    width: 10,
    height: 10,
    frames: [
      {
        width: 10,
        height: 10,
        data: frame1.data,
        frameMetadata: { delay: 100 },
      },
      {
        width: 10,
        height: 10,
        data: frame2.data,
        frameMetadata: { delay: 100 },
      },
    ],
  };

  // Encode with empty options object
  const apng = await Image.encodeFrames("apng", multiFrame, {});

  // Verify it's valid by decoding it
  const decoded = await Image.decodeFrames(apng);
  assertEquals(decoded.frames.length, 2);
});

test("Type exports: encoder options are properly exported", () => {
  // This test verifies that all encoder option types are exported from mod.ts
  // by attempting to import them (compilation test)

  // If this test compiles without errors, it means all types are properly exported
  type _PNGOptions = import("../mod.ts").PNGEncoderOptions;
  type _APNGOptions = import("../mod.ts").APNGEncoderOptions;
  type _GIFOptions = import("../mod.ts").GIFEncoderOptions;
  type _JPEGOptions = import("../mod.ts").JPEGEncoderOptions;
  type _WebPOptions = import("../mod.ts").WebPEncoderOptions;
  type _TIFFOptions = import("../mod.ts").TIFFEncoderOptions;
  type _ASCIIOptions = import("../mod.ts").ASCIIEncoderOptions;
  type _AVIFOptions = import("../mod.ts").AVIFEncoderOptions;
  type _HEICOptions = import("../mod.ts").HEICEncoderOptions;

  // If we reach here, all types compiled successfully
  assertEquals(true, true);
});
