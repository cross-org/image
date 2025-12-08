import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Metadata: set and get metadata", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Set metadata
  image.setMetadata({
    title: "Test Image",
    author: "Test Author",
    description: "A test image",
  });

  // Get metadata
  const metadata = image.metadata;
  assertEquals(metadata?.title, "Test Image");
  assertEquals(metadata?.author, "Test Author");
  assertEquals(metadata?.description, "A test image");
});

test("Metadata: merge metadata by default", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Set initial metadata
  image.setMetadata({
    title: "Test Image",
    author: "Test Author",
  });

  // Add more metadata (should merge)
  image.setMetadata({
    description: "A test image",
  });

  // Check that all metadata is preserved
  const metadata = image.metadata;
  assertEquals(metadata?.title, "Test Image");
  assertEquals(metadata?.author, "Test Author");
  assertEquals(metadata?.description, "A test image");
});

test("Metadata: replace metadata when merge=false", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Set initial metadata
  image.setMetadata({
    title: "Test Image",
    author: "Test Author",
  });

  // Replace metadata
  image.setMetadata({
    description: "A test image",
  }, false);

  // Check that only new metadata exists
  const metadata = image.metadata;
  assertEquals(metadata?.title, undefined);
  assertEquals(metadata?.author, undefined);
  assertEquals(metadata?.description, "A test image");
});

test("Metadata: get specific metadata field", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  image.setMetadata({
    title: "Test Image",
    author: "Test Author",
  });

  assertEquals(image.getMetadataField("title"), "Test Image");
  assertEquals(image.getMetadataField("author"), "Test Author");
  assertEquals(image.getMetadataField("description"), undefined);
});

test("Metadata: set and get position (GPS)", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Set position
  image.setPosition(40.7128, -74.0060); // New York City coordinates

  // Get position
  const position = image.getPosition();
  assertEquals(position?.latitude, 40.7128);
  assertEquals(position?.longitude, -74.0060);
});

test("Metadata: getPosition returns undefined when not set", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  const position = image.getPosition();
  assertEquals(position, undefined);
});

test("Metadata: set and get DPI", () => {
  // Create a proper 100x100 image
  const largeData = new Uint8Array(100 * 100 * 4);
  for (let i = 0; i < largeData.length; i += 4) {
    largeData[i] = 255; // R
    largeData[i + 1] = 0; // G
    largeData[i + 2] = 0; // B
    largeData[i + 3] = 255; // A
  }
  const image = Image.fromRGBA(100, 100, largeData);

  // Set DPI
  image.setDPI(72);

  // Get dimensions
  const dimensions = image.getDimensions();
  assertEquals(dimensions?.dpiX, 72);
  assertEquals(dimensions?.dpiY, 72);

  // Physical dimensions should be calculated: 100 pixels / 72 DPI ≈ 1.389 inches
  const expectedPhysical = 100 / 72;
  assertEquals(
    Math.abs((dimensions?.physicalWidth ?? 0) - expectedPhysical) < 0.01,
    true,
  );
  assertEquals(
    Math.abs((dimensions?.physicalHeight ?? 0) - expectedPhysical) < 0.01,
    true,
  );
});

test("Metadata: set DPI with different X and Y values", () => {
  const largeData = new Uint8Array(100 * 50 * 4);
  for (let i = 0; i < largeData.length; i += 4) {
    largeData[i] = 255; // R
    largeData[i + 1] = 0; // G
    largeData[i + 2] = 0; // B
    largeData[i + 3] = 255; // A
  }
  const image = Image.fromRGBA(100, 50, largeData);

  // Set different DPI for X and Y
  image.setDPI(72, 96);

  const dimensions = image.getDimensions();
  assertEquals(dimensions?.dpiX, 72);
  assertEquals(dimensions?.dpiY, 96);

  // Physical dimensions should be calculated separately
  assertEquals(
    Math.abs((dimensions?.physicalWidth ?? 0) - (100 / 72)) < 0.01,
    true,
  );
  assertEquals(
    Math.abs((dimensions?.physicalHeight ?? 0) - (50 / 96)) < 0.01,
    true,
  );
});

test("Metadata: getDimensions returns undefined when not set", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  const dimensions = image.getDimensions();
  assertEquals(dimensions, undefined);
});

test("Metadata: custom metadata fields", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  image.setMetadata({
    custom: {
      camera: "Canon EOS",
      iso: 400,
      flash: false,
    },
  });

  const custom = image.metadata?.custom;
  assertEquals(custom?.camera, "Canon EOS");
  assertEquals(custom?.iso, 400);
  assertEquals(custom?.flash, false);
});

test("Metadata: chainable setters", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Chain metadata setters
  image
    .setPosition(40.7128, -74.0060)
    .setMetadata({ title: "Test Image" })
    .setMetadata({ author: "Test Author" });

  assertEquals(image.getPosition()?.latitude, 40.7128);
  assertEquals(image.metadata?.title, "Test Image");
  assertEquals(image.metadata?.author, "Test Author");
});

test("Metadata: preserved during clone", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const original = Image.fromRGBA(1, 1, data);

  original.setMetadata({
    title: "Original",
    author: "Test",
  });

  const cloned = original.clone();

  // Check that metadata is preserved
  assertEquals(cloned.metadata?.title, "Original");
  assertEquals(cloned.metadata?.author, "Test");

  // Check that modifying clone doesn't affect original
  cloned.setMetadata({ title: "Cloned" });
  assertEquals(original.metadata?.title, "Original");
  assertEquals(cloned.metadata?.title, "Cloned");
});

test("Metadata: creation date", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  const now = new Date();
  image.setMetadata({ creationDate: now });

  assertEquals(image.metadata?.creationDate?.getTime(), now.getTime());
});
