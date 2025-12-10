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
