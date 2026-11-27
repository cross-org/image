/**
 * Adversarial input tests: truncated files, corrupted bytes, and crafted headers.
 *
 * Every pure-JS decoder must either decode to a well-formed image
 * (data.length === width * height * 4) or reject with a plain `Error`.
 * TypeErrors/RangeErrors, hangs, or malformed output indicate a parser bug.
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../mod.ts";
import { LZWDecoder, LZWEncoder } from "../src/utils/lzw.ts";
import { MAX_IMAGE_DIMENSION } from "../src/utils/security.ts";

const PURE_JS_FORMATS = [
  "png",
  "apng",
  "bmp",
  "gif",
  "tiff",
  "ico",
  "pam",
  "pcx",
  "ppm",
  "pgm",
  "pbm",
  "qoi",
  "jpeg",
  "webp",
];

/** Deterministic PRNG (LCG) so failures are reproducible across runtimes */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function sampleImage(): Image {
  const w = 16, h = 12;
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < px.length; i++) px[i] = (i * 37 + 11) & 0xff;
  return Image.fromRGBA(w, h, px);
}

/** Decode and assert the outcome is either a well-formed image or a plain Error */
async function expectCleanOutcome(data: Uint8Array, format: string, label: string) {
  try {
    const img = await Image.decode(data, format);
    assertEquals(
      img.data.length,
      img.width * img.height * 4,
      `${label}: decoded buffer size does not match dimensions`,
    );
  } catch (e) {
    assert(e instanceof Error, `${label}: threw a non-Error value: ${String(e)}`);
    assertEquals(
      e.constructor,
      Error,
      `${label}: threw ${e.constructor.name} instead of Error: ${e.message}`,
    );
  }
}

for (const format of PURE_JS_FORMATS) {
  test(`Adversarial: ${format} - truncated input fails cleanly`, async () => {
    const encoded = await sampleImage().encode(format);
    const step = Math.max(1, Math.floor(encoded.length / 40));
    for (let n = 0; n < encoded.length; n += step) {
      await expectCleanOutcome(encoded.slice(0, n), format, `${format} truncated to ${n}`);
    }
  });

  test(`Adversarial: ${format} - random byte corruption fails cleanly`, async () => {
    const encoded = await sampleImage().encode(format);
    const rng = makeRng(0xC0FFEE ^ format.length);
    for (let iter = 0; iter < 60; iter++) {
      const mutated = encoded.slice();
      const flips = 1 + Math.floor(rng() * 4);
      for (let k = 0; k < flips; k++) {
        mutated[Math.floor(rng() * mutated.length)] = Math.floor(rng() * 256);
      }
      await expectCleanOutcome(mutated, format, `${format} mutation #${iter}`);
    }
  });
}

test("Adversarial: PNG with truncated IDAT is rejected instead of zero-filled", async () => {
  const png = await sampleImage().encode("png");
  // Remove IEND (12 bytes) and the last bytes of the IDAT chunk
  await assertRejects(() => Image.decode(png.slice(0, png.length - 20), "png"), Error);
});

test("Adversarial: APNG without IEND still decodes its frames", async () => {
  const source = sampleImage();
  const apng = await source.encode("apng");
  const decoded = await Image.decode(apng.slice(0, apng.length - 12), "apng");
  assertEquals(decoded.data, source.data);
});

test("Adversarial: APNG with no frame data is rejected with a clean Error", async () => {
  const apng = await sampleImage().encode("apng");
  // Keep signature + IHDR + acTL (+ fcTL), drop the image data
  await assertRejects(
    () => Image.decode(apng.slice(0, 8 + 25 + 20), "apng"),
    Error,
    "no decodable frames",
  );
});

test("Adversarial: BMP with truncated pixel array is rejected", async () => {
  const bmp = await sampleImage().encode("bmp");
  await assertRejects(
    () => Image.decode(bmp.slice(0, bmp.length - 100), "bmp"),
    Error,
    "BMP pixel data is truncated",
  );
});

test("Adversarial: crafted near-limit dimensions are rejected before allocation", async () => {
  const huge = MAX_IMAGE_DIMENSION + 1;

  // QOI header: "qoif", width, height (big-endian), channels, colorspace
  const qoi = new Uint8Array(22);
  qoi.set([0x71, 0x6f, 0x69, 0x66]);
  new DataView(qoi.buffer).setUint32(4, huge);
  new DataView(qoi.buffer).setUint32(8, huge);
  qoi[12] = 4;
  await assertRejects(() => Image.decode(qoi, "qoi"), Error);

  // Netpbm headers with huge dimensions and no pixel data
  const enc = new TextEncoder();
  for (const [fmt, magic] of [["ppm", "P6"], ["pgm", "P5"], ["pbm", "P4"]]) {
    const header = fmt === "pbm"
      ? `${magic}\n${huge} ${huge}\n`
      : `${magic}\n${huge} ${huge}\n255\n`;
    await assertRejects(() => Image.decode(enc.encode(header), fmt), Error);
  }

  // PAM header with huge dimensions
  const pam = enc.encode(
    `P7\nWIDTH ${huge}\nHEIGHT ${huge}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`,
  );
  await assertRejects(() => Image.decode(pam, "pam"), Error);
});

test("Adversarial: PNG chunk length with the high bit set does not hang", async () => {
  const png = await sampleImage().encode("png");
  const crafted = png.slice();
  // First chunk after the signature is IHDR; set its length to 0x80000000+
  crafted[8] = 0x80;
  await assertRejects(() => Image.decode(crafted, "png"), Error);
});

// --- L7: regression for LZW call-stack overflow (push(...entry)) ---

test("Regression: LZW decodes maximal-length dictionary entries without stack overflow", () => {
  // A long uniform run makes the encoder emit codes for ever-longer strings,
  // producing dictionary entries thousands of bytes long.
  const input = new Uint8Array(2_000_000);
  const compressed = new LZWEncoder(8).compress(input);
  const output = new LZWDecoder(8, compressed).decompress();
  assertEquals(output.length, input.length);
  assert(output.every((v) => v === 0));
});

test("Regression: GIF decoder handles large uniform frames (long LZW entries)", async () => {
  const w = 1024, h = 1024;
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 200;
    px[i + 1] = 40;
    px[i + 2] = 10;
    px[i + 3] = 255;
  }
  const gif = await Image.fromRGBA(w, h, px).encode("gif");
  const decoded = await Image.decode(gif, "gif");
  assertEquals(decoded.width, w);
  assertEquals(decoded.height, h);
  for (let i = 0; i < decoded.data.length; i += 4) {
    if (
      decoded.data[i] !== 200 || decoded.data[i + 1] !== 40 || decoded.data[i + 2] !== 10
    ) {
      throw new Error(`Pixel mismatch at ${i / 4}`);
    }
  }
});
