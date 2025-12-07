import { assertEquals } from "../test/assert.ts";
import { test } from "../test/test_runner.ts";
import { LZWDecoder, LZWEncoder } from "../src/utils/lzw.ts";

test("LZW: 4-color pattern synchronization (edge case)", () => {
  // This test specifically targets the code size increase synchronization issue
  // that occurs with a simple 4-color pattern (minCodeSize=2)
  const minCodeSize = 2; // 4 colors need 2 bits
  const pattern = new Uint8Array([0, 1, 2, 3, 0, 1, 2, 3]);

  const encoder = new LZWEncoder(minCodeSize);
  const compressed = encoder.compress(pattern);

  const decoder = new LZWDecoder(minCodeSize, compressed);
  const decompressed = decoder.decompress();

  // Verify dimensions match
  assertEquals(
    decompressed.length,
    pattern.length,
    `Length mismatch: expected ${pattern.length}, got ${decompressed.length}`,
  );

  // Verify data matches exactly
  for (let i = 0; i < pattern.length; i++) {
    assertEquals(
      decompressed[i],
      pattern[i],
      `Mismatch at index ${i}: expected ${pattern[i]}, got ${decompressed[i]}`,
    );
  }
});

test("LZW: longer 4-color pattern", () => {
  const minCodeSize = 2;
  // Create a longer pattern to stress test the synchronization
  const pattern = new Uint8Array(
    Array(32).fill(0).map((_, i) => i % 4),
  );

  const encoder = new LZWEncoder(minCodeSize);
  const compressed = encoder.compress(pattern);

  const decoder = new LZWDecoder(minCodeSize, compressed);
  const decompressed = decoder.decompress();

  assertEquals(decompressed.length, pattern.length);
  for (let i = 0; i < pattern.length; i++) {
    assertEquals(
      decompressed[i],
      pattern[i],
      `Mismatch at index ${i}`,
    );
  }
});

test("LZW: 2-color pattern (minCodeSize=1)", () => {
  const minCodeSize = 1; // 2 colors need 1 bit
  const pattern = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1]);

  const encoder = new LZWEncoder(minCodeSize);
  const compressed = encoder.compress(pattern);

  const decoder = new LZWDecoder(minCodeSize, compressed);
  const decompressed = decoder.decompress();

  assertEquals(decompressed.length, pattern.length);
  for (let i = 0; i < pattern.length; i++) {
    assertEquals(
      decompressed[i],
      pattern[i],
      `Mismatch at index ${i}`,
    );
  }
});

test("LZW: 8-color pattern (minCodeSize=3)", () => {
  const minCodeSize = 3; // 8 colors need 3 bits
  const pattern = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3]);

  const encoder = new LZWEncoder(minCodeSize);
  const compressed = encoder.compress(pattern);

  const decoder = new LZWDecoder(minCodeSize, compressed);
  const decompressed = decoder.decompress();

  assertEquals(decompressed.length, pattern.length);
  for (let i = 0; i < pattern.length; i++) {
    assertEquals(
      decompressed[i],
      pattern[i],
      `Mismatch at index ${i}`,
    );
  }
});
