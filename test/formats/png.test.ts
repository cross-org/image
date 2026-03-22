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

// Test PNG colorType 4 (grayscale+alpha, 8-bit) decoding.
// This was previously unsupported and threw an error.
// Binary: 2x1 PNG, colorType=4 (grayscale+alpha), bitDepth=8
// Pixels: (gray=128, alpha=200), (gray=64, alpha=255)
const GA8_PNG = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10, // PNG signature
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
  2,
  0,
  0,
  0,
  1,
  8,
  4,
  0,
  0,
  0,
  94,
  43,
  183,
  1, // IHDR: 2x1, bitDepth=8, colorType=4
  0,
  0,
  0,
  13,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  104,
  56,
  225,
  240,
  31,
  0,
  5,
  220,
  2,
  136,
  238,
  166,
  2,
  103, // IDAT
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130, // IEND
]);

test("PNG: decode colorType 4 (grayscale+alpha 8-bit)", async () => {
  const format = new PNGFormat();
  const decoded = await format.decode(GA8_PNG);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 1);
  // Pixel 1: gray=128, alpha=200 -> RGBA=(128,128,128,200)
  assertEquals(decoded.data[0], 128);
  assertEquals(decoded.data[1], 128);
  assertEquals(decoded.data[2], 128);
  assertEquals(decoded.data[3], 200);
  // Pixel 2: gray=64, alpha=255 -> RGBA=(64,64,64,255)
  assertEquals(decoded.data[4], 64);
  assertEquals(decoded.data[5], 64);
  assertEquals(decoded.data[6], 64);
  assertEquals(decoded.data[7], 255);
});

// Test PNG 16-bit RGBA (colorType=6, bitDepth=16) decoding.
// Previously the pixel stride was wrong (x*4 instead of x*8), causing corruption.
// Binary: 2x1 PNG, colorType=6, bitDepth=16
// Pixel 1 raw: R=0xFF00, G=0x0000, B=0x7F00, A=0xFF00 -> high bytes: R=255,G=0,B=127,A=255
// Pixel 2 raw: R=0x8000, G=0x4000, B=0x2000, A=0xFF00 -> high bytes: R=128,G=64,B=32,A=255
const RGBA16_PNG = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10, // PNG signature
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
  2,
  0,
  0,
  0,
  1,
  16,
  6,
  0,
  0,
  0,
  164,
  178,
  163,
  201, // IHDR: 2x1, bitDepth=16, colorType=6
  0,
  0,
  0,
  24,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  248,
  207,
  192,
  192,
  80,
  207,
  240,
  159,
  161,
  129,
  193,
  129,
  65,
  1,
  72,
  3,
  0,
  39,
  233,
  4,
  93,
  204,
  55,
  1,
  237, // IDAT
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130, // IEND
]);

test("PNG: decode 16-bit RGBA (colorType=6, bitDepth=16)", async () => {
  const format = new PNGFormat();
  const decoded = await format.decode(RGBA16_PNG);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 1);
  // Pixel 1: high bytes R=255, G=0, B=127, A=255
  assertEquals(decoded.data[0], 255);
  assertEquals(decoded.data[1], 0);
  assertEquals(decoded.data[2], 127);
  assertEquals(decoded.data[3], 255);
  // Pixel 2: high bytes R=128, G=64, B=32, A=255
  assertEquals(decoded.data[4], 128);
  assertEquals(decoded.data[5], 64);
  assertEquals(decoded.data[6], 32);
  assertEquals(decoded.data[7], 255);
});

// Test PNG 4-bit grayscale (colorType=0, bitDepth=4) decoding.
// Previously scanlineLength was computed as width*1=4 bytes instead of ceil(4*4/8)=2 bytes,
// causing read-past-end and wrong pixel values.
// Binary: 4x1 PNG, colorType=0, bitDepth=4
// Packed pixels: 0,5,10,15 -> scaled to 8-bit: 0,85,170,255
const GRAY4_PNG = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10, // PNG signature
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
  4,
  0,
  0,
  0,
  1,
  4,
  0,
  0,
  0,
  0,
  25,
  167,
  189,
  16, // IHDR: 4x1, bitDepth=4, colorType=0
  0,
  0,
  0,
  11,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  96,
  93,
  15,
  0,
  0,
  188,
  0,
  181,
  130,
  65,
  130,
  156, // IDAT
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130, // IEND
]);

test("PNG: decode 4-bit grayscale (colorType=0, bitDepth=4)", async () => {
  const format = new PNGFormat();
  const decoded = await format.decode(GRAY4_PNG);

  assertEquals(decoded.width, 4);
  assertEquals(decoded.height, 1);
  // Pixel 0: gray=0 -> RGBA=(0,0,0,255)
  assertEquals(decoded.data[0], 0);
  assertEquals(decoded.data[3], 255);
  // Pixel 1: gray=85 -> RGBA=(85,85,85,255)
  assertEquals(decoded.data[4], 85);
  assertEquals(decoded.data[7], 255);
  // Pixel 2: gray=170 -> RGBA=(170,170,170,255)
  assertEquals(decoded.data[8], 170);
  // Pixel 3: gray=255 -> RGBA=(255,255,255,255)
  assertEquals(decoded.data[12], 255);
});
