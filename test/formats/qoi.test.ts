import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { QOIFormat } from "../../src/formats/qoi.ts";

test("QOI: canDecode - valid signature", () => {
  const data = new Uint8Array([
    0x71,
    0x6f,
    0x69,
    0x66, // "qoif"
    0,
    0,
    0,
    4, // width=4
    0,
    0,
    0,
    4, // height=4
    4, // channels=4 (RGBA)
    0, // colorspace=sRGB
  ]);
  const format = new QOIFormat();

  assertEquals(format.canDecode(data), true);
});

test("QOI: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const format = new QOIFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("QOI: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x71, 0x6f, 0x69, 0x66]);
  const format = new QOIFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("QOI: decode - invalid data throws", async () => {
  const format = new QOIFormat();

  await assertRejects(
    async () => await format.decode(new Uint8Array([0, 1, 2, 3])),
    Error,
    "Invalid QOI signature",
  );
});

test("QOI: encode and decode - single pixel", async () => {
  const format = new QOIFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 64, 32, 255]),
  };

  const encoded = await format.encode(imageData);
  assertEquals(format.canDecode(encoded), true);

  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, 1);
  assertEquals(decoded.height, 1);
  assertEquals(decoded.data[0], 128);
  assertEquals(decoded.data[1], 64);
  assertEquals(decoded.data[2], 32);
  assertEquals(decoded.data[3], 255);
});

test("QOI: encode and decode - solid color (uses RUN encoding)", async () => {
  const format = new QOIFormat();

  // All red pixels — encoder should use QOI_OP_RUN for most
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }

  const encoded = await format.encode({ width, height, data });
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  for (let i = 0; i < width * height; i++) {
    assertEquals(decoded.data[i * 4], 255, `pixel ${i} R`);
    assertEquals(decoded.data[i * 4 + 1], 0, `pixel ${i} G`);
    assertEquals(decoded.data[i * 4 + 2], 0, `pixel ${i} B`);
    assertEquals(decoded.data[i * 4 + 3], 255, `pixel ${i} A`);
  }
});

test("QOI: encode and decode - gradient image", async () => {
  const format = new QOIFormat();

  const width = 16;
  const height = 16;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / (width - 1)) * 255);
      data[i + 1] = Math.floor((y / (height - 1)) * 255);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  const encoded = await format.encode({ width, height, data });
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  for (let i = 0; i < width * height; i++) {
    assertEquals(decoded.data[i * 4], data[i * 4], `pixel ${i} R mismatch`);
    assertEquals(decoded.data[i * 4 + 1], data[i * 4 + 1], `pixel ${i} G mismatch`);
    assertEquals(decoded.data[i * 4 + 2], data[i * 4 + 2], `pixel ${i} B mismatch`);
    assertEquals(decoded.data[i * 4 + 3], data[i * 4 + 3], `pixel ${i} A mismatch`);
  }
});

test("QOI: encode and decode - alpha channel preserved", async () => {
  const format = new QOIFormat();

  const imageData = {
    width: 2,
    height: 2,
    data: new Uint8Array([
      255,
      0,
      0,
      255, // opaque red
      0,
      255,
      0,
      128, // semi-transparent green
      0,
      0,
      255,
      0, // transparent blue
      255,
      255,
      0,
      200, // mostly-opaque yellow
    ]),
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.data[3], 255);
  assertEquals(decoded.data[7], 128);
  assertEquals(decoded.data[11], 0);
  assertEquals(decoded.data[15], 200);
});

test("QOI: encode - header format", async () => {
  const format = new QOIFormat();

  const imageData = {
    width: 3,
    height: 5,
    data: new Uint8Array(3 * 5 * 4).fill(0),
  };

  const encoded = await format.encode(imageData);

  // Check magic bytes "qoif"
  assertEquals(encoded[0], 0x71);
  assertEquals(encoded[1], 0x6f);
  assertEquals(encoded[2], 0x69);
  assertEquals(encoded[3], 0x66);

  // Check width (big-endian): 3
  assertEquals(encoded[4], 0);
  assertEquals(encoded[5], 0);
  assertEquals(encoded[6], 0);
  assertEquals(encoded[7], 3);

  // Check height (big-endian): 5
  assertEquals(encoded[8], 0);
  assertEquals(encoded[9], 0);
  assertEquals(encoded[10], 0);
  assertEquals(encoded[11], 5);

  // Channels = 4 (RGBA)
  assertEquals(encoded[12], 4);
});

test("QOI: encode - end marker present", async () => {
  const format = new QOIFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([255, 0, 0, 255]),
  };

  const encoded = await format.encode(imageData);

  // Last 8 bytes should be the QOI end marker: 7 zeros followed by 0x01
  const end = encoded.slice(-8);
  assertEquals(end[0], 0x00);
  assertEquals(end[1], 0x00);
  assertEquals(end[2], 0x00);
  assertEquals(end[3], 0x00);
  assertEquals(end[4], 0x00);
  assertEquals(end[5], 0x00);
  assertEquals(end[6], 0x00);
  assertEquals(end[7], 0x01);
});

test("QOI: encode and decode - repeated colors use INDEX", async () => {
  const format = new QOIFormat();

  // Create image where the same colors repeat (exercises QOI_OP_INDEX)
  const width = 4;
  const height = 4;
  const data = new Uint8Array(width * height * 4);
  const colors = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
  ];
  for (let i = 0; i < width * height; i++) {
    const color = colors[i % 4];
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = color[3];
  }

  const encoded = await format.encode({ width, height, data });
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  for (let i = 0; i < width * height; i++) {
    const expected = colors[i % 4];
    assertEquals(decoded.data[i * 4], expected[0], `pixel ${i} R`);
    assertEquals(decoded.data[i * 4 + 1], expected[1], `pixel ${i} G`);
    assertEquals(decoded.data[i * 4 + 2], expected[2], `pixel ${i} B`);
    assertEquals(decoded.data[i * 4 + 3], expected[3], `pixel ${i} A`);
  }
});

test("QOI: encode and decode - large run (>62 pixels)", async () => {
  const format = new QOIFormat();

  // 100 pixels of the same color — exercises run length > 62
  const width = 100;
  const height = 1;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 123;
    data[i * 4 + 1] = 45;
    data[i * 4 + 2] = 67;
    data[i * 4 + 3] = 200;
  }

  const encoded = await format.encode({ width, height, data });
  const decoded = await format.decode(encoded);

  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  for (let i = 0; i < width; i++) {
    assertEquals(decoded.data[i * 4], 123);
    assertEquals(decoded.data[i * 4 + 1], 45);
    assertEquals(decoded.data[i * 4 + 2], 67);
    assertEquals(decoded.data[i * 4 + 3], 200);
  }
});

test("QOI: encode - data length mismatch", async () => {
  const format = new QOIFormat();

  await assertRejects(
    async () =>
      await format.encode({
        width: 2,
        height: 2,
        data: new Uint8Array([255, 0, 0]),
      }),
    Error,
    "Data length mismatch",
  );
});

test("QOI: properties", () => {
  const format = new QOIFormat();

  assertEquals(format.name, "qoi");
  assertEquals(format.mimeType, "image/qoi");
});

test("QOI: extractMetadata - RGBA", async () => {
  const format = new QOIFormat();

  const imageData = {
    width: 4,
    height: 4,
    data: new Uint8Array(4 * 4 * 4).fill(128),
  };

  const encoded = await format.encode(imageData);
  const metadata = await format.extractMetadata(encoded);

  assertEquals(metadata?.format, "qoi");
  assertEquals(metadata?.colorType, "rgba");
  assertEquals(metadata?.bitDepth, 8);
  assertEquals(metadata?.compression, "none");
  assertEquals(metadata?.frameCount, 1);
});

test("QOI: extractMetadata - invalid data returns undefined", async () => {
  const format = new QOIFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  const metadata = await format.extractMetadata(invalid);
  assertEquals(metadata, undefined);
});

test("QOI: getSupportedMetadata", () => {
  const format = new QOIFormat();
  assertEquals(format.getSupportedMetadata(), []);
});
