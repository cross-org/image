import { assertEquals, assertRejects } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { GIFFormat } from "../src/formats/gif.ts";

test("GIF: canDecode - valid GIF89a signature", () => {
  const validGIF = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61,
    0,
    0,
    0,
    0,
  ]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(validGIF), true);
});

test("GIF: canDecode - valid GIF87a signature", () => {
  const validGIF = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x37,
    0x61,
    0,
    0,
    0,
    0,
  ]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(validGIF), true);
});

test("GIF: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("GIF: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x47, 0x49, 0x46]);
  const format = new GIFFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("GIF: decode - invalid data throws", async () => {
  const format = new GIFFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid GIF signature",
  );
});

test("GIF: properties", () => {
  const format = new GIFFormat();

  assertEquals(format.name, "gif");
  assertEquals(format.mimeType, "image/gif");
});
