import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { PNGFormat } from "../../src/formats/png.ts";

test("PNG: canDecode - valid PNG signature", () => {
  const validPNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]);
  const format = new PNGFormat();

  assertEquals(format.canDecode(validPNG), true);
});

test("PNG: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new PNGFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("PNG: canDecode - too short", () => {
  const tooShort = new Uint8Array([137, 80, 78]);
  const format = new PNGFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("PNG: decode - invalid data throws", async () => {
  const format = new PNGFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid PNG signature",
  );
});

test("PNG: encode and decode - small image", async () => {
  const format = new PNGFormat();

  // Create a simple 2x2 RGBA image
  const imageData = {
    width: 2,
    height: 2,
    data: new Uint8Array([
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
    ]),
  };

  // Encode
  const encoded = await format.encode(imageData);

  // Check it starts with PNG signature
  assertEquals(encoded[0], 137);
  assertEquals(encoded[1], 80);
  assertEquals(encoded[2], 78);
  assertEquals(encoded[3], 71);

  // Decode
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
  assertEquals(decoded.data.length, 16); // 2x2 * 4 bytes

  // Check colors are preserved
  assertEquals(decoded.data[0], 255); // red R
  assertEquals(decoded.data[1], 0); // red G
  assertEquals(decoded.data[2], 0); // red B
  assertEquals(decoded.data[3], 255); // red A
});

test("PNG: properties", () => {
  const format = new PNGFormat();

  assertEquals(format.name, "png");
  assertEquals(format.mimeType, "image/png");
});

test("PNG: encode - single pixel", async () => {
  const format = new PNGFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 128, 128, 255]),
  };

  const encoded = await format.encode(imageData);

  // Should be a valid PNG
  assertEquals(format.canDecode(encoded), true);

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, 1);
  assertEquals(decoded.height, 1);
});

test("PNG: encode and decode - larger image", async () => {
  const format = new PNGFormat();

  // Create a 10x10 gradient image
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x / width) * 255; // R
      data[i + 1] = (y / height) * 255; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode and decode
  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, width * height * 4);
});

test("PNG: metadata - DPI preservation", async () => {
  const format = new PNGFormat();

  const imageData = {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 4).fill(255),
    metadata: {
      dpiX: 300,
      dpiY: 300,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.dpiX, 300);
  assertEquals(decoded.metadata?.dpiY, 300);
});

test("PNG: metadata - text fields preservation", async () => {
  const format = new PNGFormat();

  const imageData = {
    width: 10,
    height: 10,
    data: new Uint8Array(10 * 10 * 4).fill(255),
    metadata: {
      title: "Test Image",
      author: "Test Author",
      description: "A test description",
      copyright: "Copyright 2024",
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.title, "Test Image");
  assertEquals(decoded.metadata?.author, "Test Author");
  assertEquals(decoded.metadata?.description, "A test description");
  assertEquals(decoded.metadata?.copyright, "Copyright 2024");
});

test("PNG: metadata - custom fields preservation", async () => {
  const format = new PNGFormat();

  const imageData = {
    width: 10,
    height: 10,
    data: new Uint8Array(10 * 10 * 4).fill(255),
    metadata: {
      custom: {
        Camera: "Canon EOS",
        ISO: "400",
        Flash: "false",
      },
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.custom?.Camera, "Canon EOS");
  assertEquals(decoded.metadata?.custom?.ISO, "400");
  assertEquals(decoded.metadata?.custom?.Flash, "false");
});

test("PNG: metadata - creation date preservation", async () => {
  const format = new PNGFormat();

  const testDate = new Date("2024-01-15T12:30:45");
  const imageData = {
    width: 10,
    height: 10,
    data: new Uint8Array(10 * 10 * 4).fill(255),
    metadata: {
      creationDate: testDate,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Compare timestamps (may have some precision loss)
  assertEquals(decoded.metadata?.creationDate?.getFullYear(), 2024);
  assertEquals(decoded.metadata?.creationDate?.getMonth(), 0); // January
  assertEquals(decoded.metadata?.creationDate?.getDate(), 15);
  assertEquals(decoded.metadata?.creationDate?.getHours(), 12);
  assertEquals(decoded.metadata?.creationDate?.getMinutes(), 30);
  assertEquals(decoded.metadata?.creationDate?.getSeconds(), 45);
});

test("PNG: metadata - no metadata when not provided", async () => {
  const format = new PNGFormat();

  const imageData = {
    width: 10,
    height: 10,
    data: new Uint8Array(10 * 10 * 4).fill(255),
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata, undefined);
});
