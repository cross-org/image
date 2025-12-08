import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Conversion: metadata preserved from PNG to BMP", async () => {
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
    dpiX: 300,
    dpiY: 300,
  });

  // Save as PNG
  const pngData = await image.save("png");

  // Load from PNG
  const loadedFromPNG = await Image.read(pngData);
  assertEquals(loadedFromPNG.metadata?.title, "Test Image");
  assertEquals(loadedFromPNG.metadata?.author, "Test Author");
  assertEquals(loadedFromPNG.metadata?.dpiX, 300);
  assertEquals(loadedFromPNG.metadata?.dpiY, 300);

  // Convert to BMP
  const bmpData = await loadedFromPNG.save("bmp");

  // Load from BMP
  const loadedFromBMP = await Image.read(bmpData);
  // BMP only preserves DPI, not text metadata
  assertEquals(loadedFromBMP.metadata?.dpiX, 300);
  assertEquals(loadedFromBMP.metadata?.dpiY, 300);
});

test("Conversion: metadata preserved from BMP to PNG", async () => {
  // Create an image with DPI metadata
  const data = new Uint8Array(100 * 100 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 1] = 100;
    data[i + 2] = 50;
    data[i + 3] = 255;
  }

  const image = Image.fromRGBA(100, 100, data);
  image.setDPI(150);

  // Save as BMP
  const bmpData = await image.save("bmp");

  // Load from BMP
  const loadedFromBMP = await Image.read(bmpData);
  assertEquals(loadedFromBMP.metadata?.dpiX, 150);
  assertEquals(loadedFromBMP.metadata?.dpiY, 150);

  // Add text metadata
  loadedFromBMP.setMetadata({
    title: "Converted Image",
    description: "Converted from BMP",
  });

  // Convert to PNG
  const pngData = await loadedFromBMP.save("png");

  // Load from PNG
  const loadedFromPNG = await Image.read(pngData);
  assertEquals(loadedFromPNG.metadata?.dpiX, 150);
  assertEquals(loadedFromPNG.metadata?.dpiY, 150);
  assertEquals(loadedFromPNG.metadata?.title, "Converted Image");
  assertEquals(loadedFromPNG.metadata?.description, "Converted from BMP");
});

test("Conversion: metadata with resize operation", async () => {
  const data = new Uint8Array(100 * 100 * 4).fill(255);
  const image = Image.fromRGBA(100, 100, data);

  image.setMetadata({
    title: "Original",
    author: "Test",
    dpiX: 72,
    dpiY: 72,
  });

  // Resize and save
  image.resize({ width: 50, height: 50 });

  const pngData = await image.save("png");
  const loaded = await Image.read(pngData);

  // Metadata should be preserved
  assertEquals(loaded.metadata?.title, "Original");
  assertEquals(loaded.metadata?.author, "Test");
  // DPI should be preserved
  assertEquals(loaded.metadata?.dpiX, 72);
  assertEquals(loaded.metadata?.dpiY, 72);
  // Physical dimensions should be updated for new size
  assertEquals(loaded.metadata?.physicalWidth, 50 / 72);
  assertEquals(loaded.metadata?.physicalHeight, 50 / 72);
});

test("Conversion: PNG with various metadata round-trip", async () => {
  const data = new Uint8Array(50 * 50 * 4).fill(200);
  const image = Image.fromRGBA(50, 50, data);

  const testDate = new Date("2024-06-15T10:30:00");
  image.setMetadata({
    title: "Test Title",
    author: "Test Author",
    description: "Test Description",
    copyright: "Copyright 2024",
    dpiX: 96,
    dpiY: 96,
    creationDate: testDate,
    custom: {
      camera: "Test Camera",
      lens: "Test Lens",
    },
  });

  // Save and reload
  const pngData = await image.save("png");
  const loaded = await Image.read(pngData);

  assertEquals(loaded.metadata?.title, "Test Title");
  assertEquals(loaded.metadata?.author, "Test Author");
  assertEquals(loaded.metadata?.description, "Test Description");
  assertEquals(loaded.metadata?.copyright, "Copyright 2024");
  assertEquals(loaded.metadata?.dpiX, 96);
  assertEquals(loaded.metadata?.dpiY, 96);
  assertEquals(loaded.metadata?.creationDate?.getFullYear(), 2024);
  assertEquals(loaded.metadata?.creationDate?.getMonth(), 5); // June
  assertEquals(loaded.metadata?.creationDate?.getDate(), 15);
  assertEquals(loaded.metadata?.custom?.camera, "Test Camera");
  assertEquals(loaded.metadata?.custom?.lens, "Test Lens");
});
