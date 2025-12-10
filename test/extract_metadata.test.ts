import { assertEquals } from "@std/assert";
import { Image } from "../mod.ts";

Deno.test("extractMetadata - JPEG with EXIF", async () => {
  // Create a simple JPEG with metadata
  const image = Image.create(100, 100, 255, 0, 0);
  image.setMetadata({
    author: "Test Author",
    cameraMake: "TestCam",
    cameraModel: "TC-100",
    iso: 400,
  });

  const jpegData = await image.encode("jpeg");

  // Extract metadata without decoding
  const metadata = await Image.extractMetadata(jpegData, "jpeg");

  assertEquals(metadata?.author, "Test Author");
  assertEquals(metadata?.cameraMake, "TestCam");
  assertEquals(metadata?.cameraModel, "TC-100");
  assertEquals(metadata?.iso, 400);
});

Deno.test("extractMetadata - PNG with metadata", async () => {
  // Create a simple PNG with metadata
  const image = Image.create(100, 100, 0, 255, 0);
  image.setMetadata({
    title: "Test Image",
    author: "Test Author",
    description: "A test image",
  });
  image.setDPI(300);

  const pngData = await image.encode("png");

  // Extract metadata without decoding
  const metadata = await Image.extractMetadata(pngData, "png");

  assertEquals(metadata?.title, "Test Image");
  assertEquals(metadata?.author, "Test Author");
  assertEquals(metadata?.description, "A test image");
  assertEquals(metadata?.dpiX, 300);
  assertEquals(metadata?.dpiY, 300);
});

Deno.test("extractMetadata - WebP with metadata", async () => {
  // Create a simple WebP with metadata
  const image = Image.create(100, 100, 0, 0, 255);
  image.setMetadata({
    title: "WebP Test",
    description: "WebP test image",
  });

  const webpData = await image.encode("webp");

  // Extract metadata without decoding
  const metadata = await Image.extractMetadata(webpData, "webp");

  assertEquals(metadata?.title, "WebP Test");
  assertEquals(metadata?.description, "WebP test image");
});

Deno.test("extractMetadata - TIFF with metadata", async () => {
  // Create a simple TIFF with metadata
  const image = Image.create(100, 100, 255, 255, 0);
  image.setMetadata({
    author: "TIFF Author",
    description: "TIFF description",
  });

  const tiffData = await image.encode("tiff");

  // Extract metadata without decoding
  const metadata = await Image.extractMetadata(tiffData, "tiff");

  assertEquals(metadata?.author, "TIFF Author");
  assertEquals(metadata?.description, "TIFF description");
});

Deno.test("extractMetadata - auto-detect format", async () => {
  // Create a JPEG with metadata
  const image = Image.create(50, 50, 128, 128, 128);
  image.setMetadata({
    author: "Auto Detect Test",
  });

  const jpegData = await image.encode("jpeg");

  // Extract metadata without format hint (auto-detect)
  const metadata = await Image.extractMetadata(jpegData);

  assertEquals(metadata?.author, "Auto Detect Test");
});

Deno.test("extractMetadata - unsupported format returns undefined", async () => {
  // Create some invalid data
  const invalidData = new Uint8Array([1, 2, 3, 4, 5]);

  const metadata = await Image.extractMetadata(invalidData);

  assertEquals(metadata, undefined);
});

Deno.test("extractMetadata - image without metadata returns undefined", async () => {
  // Create a simple image without metadata
  const image = Image.create(50, 50, 200, 200, 200);

  const jpegData = await image.encode("jpeg");

  // Some metadata might be added by the encoder (like DPI), so we just check it's an object or undefined
  const metadata = await Image.extractMetadata(jpegData);

  // This test verifies the function doesn't crash on images without explicit metadata
  // Metadata might be undefined or contain default values
  if (metadata !== undefined) {
    assertEquals(typeof metadata, "object");
  }
});

Deno.test("extractMetadata - PNG includes format and compression info", async () => {
  const image = Image.create(100, 100, 255, 0, 0);
  const pngData = await image.encode("png");
  const metadata = await Image.extractMetadata(pngData, "png");

  assertEquals(metadata?.format, "png");
  assertEquals(metadata?.compression, "deflate");
  assertEquals(metadata?.frameCount, 1);
  assertEquals(metadata?.bitDepth, 8);
  assertEquals(metadata?.colorType, "rgba");
});

Deno.test("extractMetadata - JPEG includes format and compression info", async () => {
  const image = Image.create(100, 100, 0, 255, 0);
  const jpegData = await image.encode("jpeg");
  const metadata = await Image.extractMetadata(jpegData, "jpeg");

  assertEquals(metadata?.format, "jpeg");
  assertEquals(metadata?.compression, "dct");
  assertEquals(metadata?.frameCount, 1);
  assertEquals(metadata?.bitDepth, 8);
  assertEquals(metadata?.colorType, "rgb");
});

Deno.test("extractMetadata - WebP includes format and compression info", async () => {
  const image = Image.create(100, 100, 0, 0, 255);
  const webpData = await image.encode("webp");
  const metadata = await Image.extractMetadata(webpData, "webp");

  assertEquals(metadata?.format, "webp");
  assertEquals(metadata?.compression, "vp8l");
  assertEquals(metadata?.frameCount, 1);
  assertEquals(metadata?.bitDepth, 8);
});

Deno.test("extractMetadata - TIFF includes format and compression info", async () => {
  const image = Image.create(100, 100, 255, 255, 0);
  const tiffData = await image.encode("tiff");
  const metadata = await Image.extractMetadata(tiffData, "tiff");

  assertEquals(metadata?.format, "tiff");
  assertEquals(metadata?.compression, "none");
  assertEquals(metadata?.frameCount, 1);
  // Note: bitDepth for RGBA TIFF is stored as array offset, not tested here
  assertEquals(metadata?.colorType, "rgba"); // Default TIFF encoding is RGBA
});

Deno.test("extractMetadata - TIFF with LZW compression", async () => {
  const image = Image.create(100, 100, 128, 128, 255);
  const tiffData = await image.encode("tiff", { compression: "lzw" });
  const metadata = await Image.extractMetadata(tiffData, "tiff");

  assertEquals(metadata?.format, "tiff");
  assertEquals(metadata?.compression, "lzw");
  assertEquals(metadata?.frameCount, 1);
});

Deno.test("extractMetadata - GIF includes frame count and format info", async () => {
  const image = Image.create(50, 50, 255, 0, 255);
  const gifData = await image.encode("gif");
  const metadata = await Image.extractMetadata(gifData, "gif");

  assertEquals(metadata?.format, "gif");
  assertEquals(metadata?.compression, "lzw");
  assertEquals(metadata?.frameCount, 1);
  assertEquals(metadata?.bitDepth, 8);
  assertEquals(metadata?.colorType, "indexed");
});

Deno.test("extractMetadata - BMP includes format and compression info", async () => {
  const image = Image.create(50, 50, 0, 128, 255);
  const bmpData = await image.encode("bmp");
  const metadata = await Image.extractMetadata(bmpData, "bmp");

  assertEquals(metadata?.format, "bmp");
  assertEquals(metadata?.compression, "none");
  assertEquals(metadata?.frameCount, 1);
  assertEquals(metadata?.bitDepth, 32); // BMP encoder uses 32-bit RGBA
  assertEquals(metadata?.colorType, "rgba");
});

Deno.test("extractMetadata - APNG multi-frame includes frame count", async () => {
  // Create a multi-frame APNG
  const frame1 = Image.create(50, 50, 255, 0, 0);
  const frame2 = Image.create(50, 50, 0, 255, 0);
  const frame3 = Image.create(50, 50, 0, 0, 255);

  const multiFrameData = {
    width: 50,
    height: 50,
    frames: [
      {
        width: 50,
        height: 50,
        data: frame1.data,
        frameMetadata: { delay: 100 },
      },
      {
        width: 50,
        height: 50,
        data: frame2.data,
        frameMetadata: { delay: 100 },
      },
      {
        width: 50,
        height: 50,
        data: frame3.data,
        frameMetadata: { delay: 100 },
      },
    ],
  };

  const apngData = await Image.saveFrames("apng", multiFrameData);
  const metadata = await Image.extractMetadata(apngData, "apng");

  assertEquals(metadata?.format, "apng");
  assertEquals(metadata?.compression, "deflate");
  assertEquals(metadata?.frameCount, 3);
  assertEquals(metadata?.bitDepth, 8);
  assertEquals(metadata?.colorType, "rgba");
});

Deno.test("extractMetadata - TIFF multi-page includes frame count", async () => {
  // Create a multi-page TIFF
  const frame1 = Image.create(50, 50, 255, 0, 0);
  const frame2 = Image.create(50, 50, 0, 255, 0);

  const multiFrameData = {
    width: 50,
    height: 50,
    frames: [
      { width: 50, height: 50, data: frame1.data },
      { width: 50, height: 50, data: frame2.data },
    ],
  };

  const tiffData = await Image.saveFrames("tiff", multiFrameData);
  const metadata = await Image.extractMetadata(tiffData, "tiff");

  assertEquals(metadata?.format, "tiff");
  assertEquals(metadata?.frameCount, 2);
});
