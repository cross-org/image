import { assertEquals, assertThrows } from "@std/assert";
import { test } from "@cross/test";

import { decodeBase64, encodeBase64, parseDataUrl, toDataUrl } from "../mod.ts";

test("Base64: encode/decode roundtrip", () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 254, 255]);
  const b64 = encodeBase64(bytes);
  const decoded = decodeBase64(b64);
  assertEquals(decoded, bytes);
});

test("Base64: decode accepts base64url without padding", () => {
  // "AQID" is [1,2,3]
  const decoded1 = decodeBase64("AQID");
  assertEquals(decoded1, new Uint8Array([1, 2, 3]));

  // url-safe variant for "////" -> "____"
  const decoded2 = decodeBase64("____");
  assertEquals(decoded2, new Uint8Array([255, 255, 255]));
});

test("Base64: invalid input throws", () => {
  assertThrows(() => decodeBase64("a"));
  assertThrows(() => decodeBase64("AA=A"));
  assertThrows(() => decodeBase64("AA==BB=="));
});

test("Data URL: toDataUrl/parseDataUrl", () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const url = toDataUrl("image/png", bytes);
  const parsed = parseDataUrl(url);
  assertEquals(parsed.mime, "image/png");
  assertEquals(parsed.bytes, bytes);
});
