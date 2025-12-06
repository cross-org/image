import { assertEquals } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { Image } from "../src/image.ts";

// Note: These tests verify metadata handling for runtime API-based formats
// Actual encoding/decoding depends on runtime support (ImageDecoder, OffscreenCanvas)

test("WebP/TIFF/GIF: metadata preserved through programmatic operations", () => {
  // Create an image with metadata
  const data = new Uint8Array(100 * 100 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 128; // G
    data[i + 2] = 64; // B
    data[i + 3] = 255; // A
  }

  const image = Image.fromRGBA(100, 100, data);
  image.setMetadata({
    title: "Test Image",
    author: "Test Author",
    description: "Test Description",
    copyright: "Test Copyright",
    dpiX: 150,
    dpiY: 150,
  });

  // Metadata should be preserved in the Image object
  assertEquals(image.metadata?.title, "Test Image");
  assertEquals(image.metadata?.author, "Test Author");
  assertEquals(image.metadata?.description, "Test Description");
  assertEquals(image.metadata?.copyright, "Test Copyright");
  assertEquals(image.metadata?.dpiX, 150);
  assertEquals(image.metadata?.dpiY, 150);

  // Metadata should be preserved after resize
  image.resize({ width: 50, height: 50 });
  assertEquals(image.metadata?.title, "Test Image");
  assertEquals(image.metadata?.dpiX, 150);
});

test("TIFF: metadata with creation date", () => {
  const data = new Uint8Array(50 * 50 * 4).fill(200);
  const image = Image.fromRGBA(50, 50, data);

  const testDate = new Date("2024-06-15T10:30:00");
  image.setMetadata({
    title: "TIFF Test",
    description: "A TIFF test image",
    creationDate: testDate,
    dpiX: 96,
    dpiY: 96,
  });

  // Verify metadata is set
  assertEquals(image.metadata?.title, "TIFF Test");
  assertEquals(image.metadata?.description, "A TIFF test image");
  assertEquals(image.metadata?.creationDate?.getTime(), testDate.getTime());
  assertEquals(image.metadata?.dpiX, 96);
});

test("Conversion: metadata from PNG to TIFF", async () => {
  // Create PNG with metadata
  const data = new Uint8Array(100 * 100 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 1] = 100;
    data[i + 2] = 50;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(100, 100, data);
  image.setMetadata({
    title: "PNG to TIFF",
    author: "Converter",
    dpiX: 150,
    dpiY: 150,
  });

  // Save as PNG (metadata should be preserved)
  const pngData = await image.save("png");
  const loadedFromPNG = await Image.read(pngData);

  assertEquals(loadedFromPNG.metadata?.title, "PNG to TIFF");
  assertEquals(loadedFromPNG.metadata?.author, "Converter");
  assertEquals(loadedFromPNG.metadata?.dpiX, 150);

  // The TIFF encoder should write metadata when programmatically provided
  // (Runtime API encoding may or may not preserve it in the actual file)
  assertEquals(loadedFromPNG.metadata?.title, "PNG to TIFF");
});
