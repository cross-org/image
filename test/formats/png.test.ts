import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { PNGFormat } from "../../src/formats/png.ts";
import { PNGBase } from "../../src/formats/png_base.ts";

/**
 * Test helper that exposes PNGBase protected methods needed to build indexed PNG fixtures
 */
class PNGTestHelper extends PNGBase {
  buildChunk(type: string, data: Uint8Array): Uint8Array {
    return this.createChunk(type, data);
  }
  concatArrays(arrays: Uint8Array[]): Uint8Array {
    return this.concatenateArrays(arrays);
  }
  compress(data: Uint8Array): Promise<Uint8Array> {
    return this.deflate(data);
  }
  writeU32(data: Uint8Array, offset: number, value: number): void {
    this.writeUint32(data, offset, value);
  }
  // Required abstract stubs (not used in tests)
  canDecode(): boolean {
    return false;
  }
  decode(): Promise<never> {
    return Promise.reject(new Error("Not implemented in test helper"));
  }
  encode(): Promise<never> {
    return Promise.reject(new Error("Not implemented in test helper"));
  }
}

/**
 * Build a minimal indexed PNG binary for testing.
 * @param width Image width
 * @param height Image height
 * @param bitDepth Bit depth (1, 2, 4, or 8)
 * @param palette RGB palette entries [[R,G,B], ...]
 * @param alphas Optional alpha values per palette entry
 * @param indices Pixel indices in row-major order
 */
async function buildIndexedPNG(
  width: number,
  height: number,
  bitDepth: number,
  palette: [number, number, number][],
  alphas: number[] | null,
  indices: number[],
): Promise<Uint8Array> {
  const helper = new PNGTestHelper();

  // IHDR
  const ihdr = new Uint8Array(13);
  helper.writeU32(ihdr, 0, width);
  helper.writeU32(ihdr, 4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = 3; // indexed
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // PLTE
  const plte = new Uint8Array(palette.length * 3);
  for (let i = 0; i < palette.length; i++) {
    plte[i * 3] = palette[i][0];
    plte[i * 3 + 1] = palette[i][1];
    plte[i * 3 + 2] = palette[i][2];
  }

  // Raw scanlines (filter byte 0 = None, then packed pixel indices)
  if (bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8) {
    throw new Error(`Invalid bit depth for indexed PNG: ${bitDepth}`);
  }
  const scanlineBytes = bitDepth === 8 ? width : Math.ceil(width * bitDepth / 8);
  const rawData = new Uint8Array(height * (1 + scanlineBytes));
  let pos = 0;
  const pixelsPerByte = 8 / bitDepth;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // filter type: None
    if (bitDepth === 8) {
      for (let x = 0; x < width; x++) {
        rawData[pos++] = indices[y * width + x];
      }
    } else {
      for (let b = 0; b < scanlineBytes; b++) {
        let byte = 0;
        for (let p = 0; p < pixelsPerByte; p++) {
          const x = b * pixelsPerByte + p;
          if (x < width) {
            const idx = indices[y * width + x] & ((1 << bitDepth) - 1);
            byte |= idx << (8 - bitDepth * (p + 1));
          }
        }
        rawData[pos++] = byte;
      }
    }
  }

  const compressed = await helper.compress(rawData);

  const chunks: Uint8Array[] = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    helper.buildChunk("IHDR", ihdr),
    helper.buildChunk("PLTE", plte),
  ];
  if (alphas) {
    chunks.push(helper.buildChunk("tRNS", new Uint8Array(alphas)));
  }
  chunks.push(helper.buildChunk("IDAT", compressed));
  chunks.push(helper.buildChunk("IEND", new Uint8Array(0)));

  return helper.concatArrays(chunks);
}

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

test("PNG: indexed color (type 3) - 8-bit depth, no transparency", async () => {
  const format = new PNGFormat();

  // 2x2 image with 4 distinct palette colors
  const palette: [number, number, number][] = [
    [255, 0, 0], // index 0: red
    [0, 255, 0], // index 1: green
    [0, 0, 255], // index 2: blue
    [255, 255, 0], // index 3: yellow
  ];
  const indices = [0, 1, 2, 3]; // row-major: [red, green, blue, yellow]

  const pngData = await buildIndexedPNG(2, 2, 8, palette, null, indices);
  const decoded = await format.decode(pngData);

  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
  assertEquals(decoded.data.length, 16); // 2x2 * 4 bytes RGBA

  // Pixel 0: red
  assertEquals(decoded.data[0], 255);
  assertEquals(decoded.data[1], 0);
  assertEquals(decoded.data[2], 0);
  assertEquals(decoded.data[3], 255);

  // Pixel 1: green
  assertEquals(decoded.data[4], 0);
  assertEquals(decoded.data[5], 255);
  assertEquals(decoded.data[6], 0);
  assertEquals(decoded.data[7], 255);

  // Pixel 2: blue
  assertEquals(decoded.data[8], 0);
  assertEquals(decoded.data[9], 0);
  assertEquals(decoded.data[10], 255);
  assertEquals(decoded.data[11], 255);

  // Pixel 3: yellow
  assertEquals(decoded.data[12], 255);
  assertEquals(decoded.data[13], 255);
  assertEquals(decoded.data[14], 0);
  assertEquals(decoded.data[15], 255);
});

test("PNG: indexed color (type 3) - 8-bit depth, with tRNS transparency", async () => {
  const format = new PNGFormat();

  const palette: [number, number, number][] = [
    [255, 0, 0], // index 0: red, fully opaque
    [0, 0, 255], // index 1: blue, semi-transparent
  ];
  const alphas = [255, 128]; // index 0 opaque, index 1 semi-transparent
  const indices = [0, 1]; // 1x2: red, blue

  const pngData = await buildIndexedPNG(1, 2, 8, palette, alphas, indices);
  const decoded = await format.decode(pngData);

  assertEquals(decoded.width, 1);
  assertEquals(decoded.height, 2);

  // Pixel 0: red, alpha=255
  assertEquals(decoded.data[0], 255);
  assertEquals(decoded.data[1], 0);
  assertEquals(decoded.data[2], 0);
  assertEquals(decoded.data[3], 255);

  // Pixel 1: blue, alpha=128
  assertEquals(decoded.data[4], 0);
  assertEquals(decoded.data[5], 0);
  assertEquals(decoded.data[6], 255);
  assertEquals(decoded.data[7], 128);
});

test("PNG: indexed color (type 3) - 4-bit depth", async () => {
  const format = new PNGFormat();

  // 4x1 image with 4 colors (2 pixels per byte at 4-bit depth)
  const palette: [number, number, number][] = [
    [255, 0, 0], // index 0: red
    [0, 255, 0], // index 1: green
    [0, 0, 255], // index 2: blue
    [128, 128, 0], // index 3: olive
  ];
  const indices = [0, 1, 2, 3];

  const pngData = await buildIndexedPNG(4, 1, 4, palette, null, indices);
  const decoded = await format.decode(pngData);

  assertEquals(decoded.width, 4);
  assertEquals(decoded.height, 1);

  // Pixel 0: red
  assertEquals(decoded.data[0], 255);
  assertEquals(decoded.data[1], 0);
  assertEquals(decoded.data[2], 0);
  assertEquals(decoded.data[3], 255);

  // Pixel 1: green
  assertEquals(decoded.data[4], 0);
  assertEquals(decoded.data[5], 255);
  assertEquals(decoded.data[6], 0);
  assertEquals(decoded.data[7], 255);

  // Pixel 2: blue
  assertEquals(decoded.data[8], 0);
  assertEquals(decoded.data[9], 0);
  assertEquals(decoded.data[10], 255);
  assertEquals(decoded.data[11], 255);

  // Pixel 3: olive
  assertEquals(decoded.data[12], 128);
  assertEquals(decoded.data[13], 128);
  assertEquals(decoded.data[14], 0);
  assertEquals(decoded.data[15], 255);
});

test("PNG: indexed color (type 3) - 1-bit depth", async () => {
  const format = new PNGFormat();

  // 8x1 image alternating between two colors at 1-bit depth
  const palette: [number, number, number][] = [
    [0, 0, 0], // index 0: black
    [255, 255, 255], // index 1: white
  ];
  const indices = [0, 1, 0, 1, 0, 1, 0, 1];

  const pngData = await buildIndexedPNG(8, 1, 1, palette, null, indices);
  const decoded = await format.decode(pngData);

  assertEquals(decoded.width, 8);
  assertEquals(decoded.height, 1);

  // Check alternating black/white pattern
  for (let i = 0; i < 8; i++) {
    const expected = i % 2 === 0 ? 0 : 255;
    assertEquals(decoded.data[i * 4], expected); // R
    assertEquals(decoded.data[i * 4 + 1], expected); // G
    assertEquals(decoded.data[i * 4 + 2], expected); // B
    assertEquals(decoded.data[i * 4 + 3], 255); // A
  }
});

test("PNG: indexed color (type 3) - missing PLTE chunk throws", async () => {
  const format = new PNGFormat();
  const helper = new PNGTestHelper();

  // Build an indexed PNG without a PLTE chunk
  const ihdr = new Uint8Array(13);
  helper.writeU32(ihdr, 0, 2);
  helper.writeU32(ihdr, 4, 1);
  ihdr[8] = 8; // bitDepth
  ihdr[9] = 3; // color type: indexed

  // scanline: filter=0, then 2 indices
  const rawData = new Uint8Array([0, 0, 1]);
  const compressed = await helper.compress(rawData);

  const chunks: Uint8Array[] = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    helper.buildChunk("IHDR", ihdr),
    // PLTE intentionally omitted
    helper.buildChunk("IDAT", compressed),
    helper.buildChunk("IEND", new Uint8Array(0)),
  ];

  await assertRejects(
    async () => await format.decode(helper.concatArrays(chunks)),
    Error,
    "PLTE chunk",
  );
});

test("PNG: indexed color (type 3) - PLTE length not divisible by 3 throws", async () => {
  const format = new PNGFormat();
  const helper = new PNGTestHelper();

  const ihdr = new Uint8Array(13);
  helper.writeU32(ihdr, 0, 1);
  helper.writeU32(ihdr, 4, 1);
  ihdr[8] = 8;
  ihdr[9] = 3;

  // Invalid PLTE: 5 bytes (not a multiple of 3)
  const badPlte = new Uint8Array([255, 0, 0, 0, 255]);

  const rawData = new Uint8Array([0, 0]);
  const compressed = await helper.compress(rawData);

  const chunks: Uint8Array[] = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    helper.buildChunk("IHDR", ihdr),
    helper.buildChunk("PLTE", badPlte),
    helper.buildChunk("IDAT", compressed),
    helper.buildChunk("IEND", new Uint8Array(0)),
  ];

  await assertRejects(
    async () => await format.decode(helper.concatArrays(chunks)),
    Error,
    "multiple of 3",
  );
});

test("PNG: indexed color (type 3) - out-of-range palette index throws", async () => {
  const format = new PNGFormat();
  const helper = new PNGTestHelper();

  const ihdr = new Uint8Array(13);
  helper.writeU32(ihdr, 0, 1);
  helper.writeU32(ihdr, 4, 1);
  ihdr[8] = 8;
  ihdr[9] = 3;

  // Palette with only 2 colors (indices 0 and 1)
  const plte = new Uint8Array([255, 0, 0, 0, 255, 0]);

  // Pixel references index 5 which is out of range
  const rawData = new Uint8Array([0, 5]);
  const compressed = await helper.compress(rawData);

  const chunks: Uint8Array[] = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    helper.buildChunk("IHDR", ihdr),
    helper.buildChunk("PLTE", plte),
    helper.buildChunk("IDAT", compressed),
    helper.buildChunk("IEND", new Uint8Array(0)),
  ];

  await assertRejects(
    async () => await format.decode(helper.concatArrays(chunks)),
    Error,
    "out of range",
  );
});
