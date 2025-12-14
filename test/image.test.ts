import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Image: fromRGBA - create image from raw data", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
  ]);

  const image = Image.fromRGBA(2, 1, data);

  assertEquals(image.width, 2);
  assertEquals(image.height, 1);
  assertEquals(image.data.length, 8);
});

test("Image: fromRGBA - wrong data length throws", () => {
  const data = new Uint8Array([255, 0, 0, 255]); // 1 pixel

  try {
    Image.fromRGBA(2, 2, data); // expects 4 pixels
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("Data length mismatch"),
      true,
    );
  }
});

test("Image: read and save PNG", async () => {
  // Create a simple image
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
    0,
    255, // yellow
  ]);

  const original = Image.fromRGBA(2, 2, data);

  // Save as PNG
  const encoded = await original.save("png");

  // Read it back
  const loaded = await Image.read(encoded);

  assertEquals(loaded.width, 2);
  assertEquals(loaded.height, 2);
  assertEquals(loaded.data.length, 16);

  // Verify colors
  assertEquals(loaded.data[0], 255); // red
  assertEquals(loaded.data[4], 0); // green
  assertEquals(loaded.data[8], 0); // blue
});

test("Image: encode JPEG supports quality and progressive", async () => {
  const image = Image.create(2, 2, 255, 0, 0, 255);

  const encoded = await image.encode("jpeg", {
    quality: 90,
    progressive: true,
  });

  // JPEG SOI marker
  assertEquals(encoded[0], 0xff);
  assertEquals(encoded[1], 0xd8);

  // Should contain SOF2 marker (0xFFC2) for progressive JPEG
  let foundSOF2 = false;
  for (let i = 0; i < encoded.length - 1; i++) {
    if (encoded[i] === 0xff && encoded[i + 1] === 0xc2) {
      foundSOF2 = true;
      break;
    }
  }
  assertEquals(foundSOF2, true);
});

test("Image: read - auto-detect format", async () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  const encoded = await image.save("png");

  // Read without specifying format
  const loaded = await Image.read(encoded);

  assertEquals(loaded.width, 2);
  assertEquals(loaded.height, 1);
});

test("Image: read - with format hint", async () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);
  const encoded = await image.save("png");

  // Read with format hint
  const loaded = await Image.read(encoded, "png");

  assertEquals(loaded.width, 1);
  assertEquals(loaded.height, 1);
});

test("Image: read - unsupported format throws", async () => {
  const invalidData = new Uint8Array([1, 2, 3, 4, 5]);

  await assertRejects(
    async () => await Image.read(invalidData),
    Error,
    "Unsupported or unrecognized image format",
  );
});

test("Image: resize - bilinear", () => {
  const data = new Uint8Array(16); // 2x2 image
  for (let i = 0; i < 16; i += 4) {
    data[i] = 255; // red
    data[i + 3] = 255; // alpha
  }

  const image = Image.fromRGBA(2, 2, data);
  image.resize({ width: 4, height: 4, method: "bilinear" });

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);
  assertEquals(image.data.length, 64);
});

test("Image: resize - nearest", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.resize({ width: 4, height: 2, method: "nearest" });

  assertEquals(image.width, 4);
  assertEquals(image.height, 2);
  assertEquals(image.data.length, 32);
});

test("Image: resize - default method is bilinear", () => {
  const data = new Uint8Array(16);
  const image = Image.fromRGBA(2, 2, data);

  image.resize({ width: 1, height: 1 });

  assertEquals(image.width, 1);
  assertEquals(image.height, 1);
});

test("Image: clone", () => {
  const data = new Uint8Array([255, 128, 64, 255]);
  const original = Image.fromRGBA(1, 1, data);

  const cloned = original.clone();

  assertEquals(cloned.width, original.width);
  assertEquals(cloned.height, original.height);
  assertEquals(cloned.data.length, original.data.length);

  // Verify it's a deep copy
  cloned.data[0] = 0;
  assertEquals(original.data[0], 255); // original unchanged
});

test("Image: save - unsupported format throws", async () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  await assertRejects(
    async () => await image.save("unsupported"),
    Error,
    "Unsupported format",
  );
});

test("Image: chaining operations", async () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
    0,
    0,
    255,
    255,
    255,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 2, data);

  // Chain resize
  image.resize({ width: 4, height: 4 }).resize({ width: 2, height: 2 });

  assertEquals(image.width, 2);
  assertEquals(image.height, 2);

  // Should still be able to save
  const encoded = await image.save("png");
  assertEquals(encoded.length > 0, true);
});

test("Image: operations on unloaded image throw", () => {
  const image = new Image();

  try {
    const _width = image.width;
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message, "No image loaded");
  }

  try {
    const _height = image.height;
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message, "No image loaded");
  }

  try {
    const _data = image.data;
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message, "No image loaded");
  }
});

test("Image: registerFormat", () => {
  const formatsBefore = Image.getFormats().length;

  // Create a dummy format
  const dummyFormat = {
    name: "dummy",
    mimeType: "image/dummy",
    canDecode: () => false,
    decode: () => Promise.resolve({ width: 0, height: 0, data: new Uint8Array() }),
    encode: () => Promise.resolve(new Uint8Array()),
  };

  Image.registerFormat(dummyFormat);

  const formatsAfter = Image.getFormats().length;
  assertEquals(formatsAfter, formatsBefore + 1);
});
