import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { readFile } from "@cross/fs/io";
import { PNGFormat } from "../../src/formats/png.ts";
import { PNGBase } from "../../src/formats/png_base.ts";

/**
 * Test helper exposing PNGBase chunk/deflate utilities for building fixtures
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
  paeth(a: number, b: number, c: number): number {
    return this.paethPredictor(a, b, c);
  }
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

const helper = new PNGTestHelper();

const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

/** Apply PNG filter `type` to `raw` (RGBA8, bpp=4) given the previous raw line */
function filterLine(raw: Uint8Array, prev: Uint8Array | null, type: number): Uint8Array {
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const left = i >= 4 ? raw[i - 4] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= 4 ? prev[i - 4] : 0;
    let pred = 0;
    if (type === 1) pred = left;
    else if (type === 2) pred = up;
    else if (type === 3) pred = Math.floor((left + up) / 2);
    else if (type === 4) pred = helper.paeth(left, up, upLeft);
    out[i] = (raw[i] - pred) & 0xff;
  }
  return out;
}

/** Build an Adam7-interlaced RGBA8 PNG, cycling through all five filter types */
async function buildInterlacedRGBA(
  width: number,
  height: number,
  rgba: Uint8Array,
  ihdrOverride?: (ihdr: Uint8Array) => void,
  dropBytes = 0,
): Promise<Uint8Array> {
  const parts: number[] = [];
  let lineNo = 0;
  for (const [xs, ys, dx, dy] of ADAM7) {
    const pw = Math.ceil((width - xs) / dx);
    const ph = Math.ceil((height - ys) / dy);
    if (pw <= 0 || ph <= 0) continue;
    let prev: Uint8Array | null = null; // predictor resets at the start of each pass
    for (let py = 0; py < ph; py++) {
      const raw = new Uint8Array(pw * 4);
      const y = ys + py * dy;
      for (let px = 0; px < pw; px++) {
        const x = xs + px * dx;
        raw.set(rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), px * 4);
      }
      const type = lineNo++ % 5;
      parts.push(type, ...filterLine(raw, prev, type));
      prev = raw;
    }
  }

  const ihdr = new Uint8Array(13);
  helper.writeU32(ihdr, 0, width);
  helper.writeU32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[12] = 1; // Adam7
  ihdrOverride?.(ihdr);

  return helper.concatArrays([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    helper.buildChunk("IHDR", ihdr),
    helper.buildChunk(
      "IDAT",
      await helper.compress(new Uint8Array(parts.slice(0, parts.length - dropBytes))),
    ),
    helper.buildChunk("IEND", new Uint8Array(0)),
  ]);
}

function makePixels(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 37 + 11) & 0xff;
  return data;
}

for (const [w, h] of [[1, 1], [2, 3], [3, 3], [8, 8], [13, 11], [33, 17]]) {
  test(`PNG interlace: Adam7 RGBA8 ${w}x${h} decodes to source pixels`, async () => {
    const pixels = makePixels(w, h);
    const png = await buildInterlacedRGBA(w, h, pixels);
    const decoded = await new PNGFormat().decode(png);
    assertEquals(decoded.width, w);
    assertEquals(decoded.height, h);
    assertEquals(decoded.data, pixels);
  });
}

for (const name of ["rgba8", "rgb16", "pal", "g2"]) {
  test(`PNG interlace: fixture ${name} matches non-interlaced reference`, async () => {
    const format = new PNGFormat();
    const interlaced = await format.decode(
      await readFile(`test/fixtures/png/${name}_interlaced.png`),
    );
    const reference = await format.decode(await readFile(`test/fixtures/png/${name}.png`));
    assertEquals(interlaced.width, reference.width);
    assertEquals(interlaced.height, reference.height);
    assertEquals(interlaced.data, reference.data);
  });
}

test("PNG interlace: unknown interlace method throws", async () => {
  const png = await buildInterlacedRGBA(4, 4, makePixels(4, 4), (ihdr) => {
    ihdr[12] = 2;
  });
  await assertRejects(
    () => new PNGFormat().decode(png),
    Error,
    "Unsupported PNG interlace method",
  );
});

test("PNG interlace: truncated pass data throws", async () => {
  // Drop the tail of the last pass from the deflated stream
  const png = await buildInterlacedRGBA(8, 8, makePixels(8, 8), undefined, 5);
  await assertRejects(
    () => new PNGFormat().decode(png),
    Error,
    "PNG image data is truncated",
  );
});

test("PNG interlace: invalid filter type throws", async () => {
  const ihdr = new Uint8Array(13);
  helper.writeU32(ihdr, 0, 1);
  helper.writeU32(ihdr, 4, 1);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = helper.concatArrays([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    helper.buildChunk("IHDR", ihdr),
    helper.buildChunk("IDAT", await helper.compress(new Uint8Array([7, 1, 2, 3, 4]))),
    helper.buildChunk("IEND", new Uint8Array(0)),
  ]);
  await assertRejects(() => new PNGFormat().decode(png), Error, "Invalid PNG filter type: 7");
});

test("PNG: missing IDAT chunk throws instead of returning blank pixels", async () => {
  const ihdr = new Uint8Array(13);
  helper.writeU32(ihdr, 0, 4);
  helper.writeU32(ihdr, 4, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = helper.concatArrays([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    helper.buildChunk("IHDR", ihdr),
    helper.buildChunk("IEND", new Uint8Array(0)),
  ]);
  await assertRejects(() => new PNGFormat().decode(png), Error, "missing IDAT");
});
