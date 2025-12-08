#!/usr/bin/env -S deno run -A

/**
 * WebP Decoder Independent Test
 * Tests decoder with hand-crafted WebP data (not from our encoder)
 */

import { WebPDecoder } from "../../src/utils/webp_decoder.ts";

/**
 * Create a minimal valid WebP file manually
 * This tests if our decoder can handle externally-created WebP files
 */
function createMinimalWebP(): {
  data: Uint8Array;
  expected: { width: number; height: number; pixels: Uint8Array };
} {
  // Create a 1x1 red pixel WebP using simple Huffman codes
  // This is based on the WebP spec, not our encoder

  const bytes: number[] = [];

  // RIFF header
  bytes.push(0x52, 0x49, 0x46, 0x46); // "RIFF"
  bytes.push(0x1A, 0x00, 0x00, 0x00); // file size: 26 bytes
  bytes.push(0x57, 0x45, 0x42, 0x50); // "WEBP"

  // VP8L chunk
  bytes.push(0x56, 0x50, 0x38, 0x4C); // "VP8L"
  bytes.push(0x0D, 0x00, 0x00, 0x00); // chunk size: 13 bytes

  // VP8L data
  bytes.push(0x2F); // signature
  bytes.push(0x00, 0x00, 0x00, 0x00); // width=1, height=1, alpha=0, version=0

  // Image data: no transforms, no color cache, no meta Huffman
  bytes.push(0x00); // transforms = 0, color cache = 0

  // Simple Huffman for green (1 symbol: 255)
  bytes.push(0x90); // simple=1, num_symbols=0 (means 1), is_first_8bits=0
  bytes.push(0xFF); // symbol = 255

  // Simple Huffman for red (1 symbol: 255)
  bytes.push(0x90); // simple=1, num_symbols=0, is_first_8bits=0
  bytes.push(0xFF); // symbol = 255

  // Simple Huffman for blue (1 symbol: 0)
  bytes.push(0x90); // simple=1, num_symbols=0, is_first_8bits=0
  bytes.push(0x00); // symbol = 0

  // Simple Huffman for alpha (1 symbol: 255) - even though no alpha
  bytes.push(0x90); // simple=1, num_symbols=0, is_first_8bits=0
  bytes.push(0xFF); // symbol = 255

  // Padding to even length
  bytes.push(0x00);

  return {
    data: new Uint8Array(bytes),
    expected: {
      width: 1,
      height: 1,
      pixels: new Uint8Array([255, 255, 0, 255]), // R, G, B, A
    },
  };
}

/**
 * Create a 2x1 WebP with two colors (red and blue)
 */
function _createTwoColorWebP(): {
  data: Uint8Array;
  expected: { width: number; height: number; pixels: Uint8Array };
} {
  const bytes: number[] = [];

  // RIFF header
  bytes.push(0x52, 0x49, 0x46, 0x46); // "RIFF"
  bytes.push(0x1C, 0x00, 0x00, 0x00); // file size: 28 bytes
  bytes.push(0x57, 0x45, 0x42, 0x50); // "WEBP"

  // VP8L chunk
  bytes.push(0x56, 0x50, 0x38, 0x4C); // "VP8L"
  bytes.push(0x10, 0x00, 0x00, 0x00); // chunk size: 16 bytes

  // VP8L data
  bytes.push(0x2F); // signature
  // width=2 (1 + 1), height=1 (0 + 1), alpha=0, version=0
  // Bits: width-1 (14 bits) = 1, height-1 (14 bits) = 0, alpha (1 bit) = 0, version (3 bits) = 0
  // 0000 0000 0000 0001 0000 0000 0000 0001
  bytes.push(0x01, 0x40, 0x00, 0x00);

  // No transforms, no color cache
  bytes.push(0x00);

  // Simple Huffman for green (2 symbols: 255 and 0)
  bytes.push(0xB0); // simple=1, num_symbols=1 (means 2), is_first_8bits=0
  bytes.push(0xFF); // first symbol = 255
  bytes.push(0x00); // second symbol = 0

  // Simple Huffman for red (2 symbols: 255 and 0)
  bytes.push(0xB0);
  bytes.push(0xFF);
  bytes.push(0x00);

  // Simple Huffman for blue (2 symbols: 0 and 255)
  bytes.push(0xB0);
  bytes.push(0x00);
  bytes.push(0xFF);

  // Simple Huffman for alpha (1 symbol: 255)
  bytes.push(0x90);
  bytes.push(0xFF);

  // Pixel data: red (G=255, R=255, B=0), blue (G=0, R=0, B=255)
  // With 2-symbol simple Huffman: 0 = first symbol, 1 = second symbol
  // Red: G=1 (0), R=1 (0), B=0 (0) = bits: 1 0 0
  // Blue: G=0 (255), R=0 (255), B=1 (255) = bits: 0 0 1
  // Combined: 100001 = 0x21 (reading left to right in bit order)
  // But we need to think about bit packing...
  // Actually, for simple 2-symbol codes: bit 0 = first, bit 1 = second
  // Pixel 1 (red): green=1, red=1, blue=0
  // Pixel 2 (blue): green=0, red=0, blue=1
  bytes.push(0xA4); // Encoded pixels (this is a guess, may need adjustment)

  return {
    data: new Uint8Array(bytes),
    expected: {
      width: 2,
      height: 1,
      pixels: new Uint8Array([
        255,
        255,
        0,
        255, // red
        0,
        0,
        255,
        255, // blue
      ]),
    },
  };
}

function runDecoderTests() {
  console.log("WebP Decoder Independent Test Suite");
  console.log("=".repeat(70));
  console.log("Testing decoder with hand-crafted WebP data\n");

  let passCount = 0;
  let failCount = 0;

  const tests = [
    { name: "minimal_1x1_red", ...createMinimalWebP() },
    // Skip the two-color test for now as it requires precise bit encoding
    // { name: "two_color_2x1", ...createTwoColorWebP() },
  ];

  for (const test of tests) {
    console.log(`Test: ${test.name}`);
    console.log("-".repeat(70));

    try {
      const decoder = new WebPDecoder(test.data);
      const result = decoder.decode();

      console.log(`✓ Decoded: ${result.width}x${result.height}`);

      // Check dimensions
      if (
        result.width !== test.expected.width ||
        result.height !== test.expected.height
      ) {
        console.log(
          `✗ Dimension mismatch: got ${result.width}x${result.height}, expected ${test.expected.width}x${test.expected.height}`,
        );
        failCount++;
        continue;
      }

      // Check pixels
      let pixelsMatch = true;
      if (result.data.length !== test.expected.pixels.length) {
        console.log(
          `✗ Data length mismatch: got ${result.data.length}, expected ${test.expected.pixels.length}`,
        );
        pixelsMatch = false;
      } else {
        for (let i = 0; i < result.data.length; i++) {
          if (result.data[i] !== test.expected.pixels[i]) {
            console.log(
              `✗ Pixel mismatch at byte ${i}: got ${result.data[i]}, expected ${
                test.expected.pixels[i]
              }`,
            );
            pixelsMatch = false;
            if (i > 10) {
              console.log("  ... (more mismatches)");
              break;
            }
          }
        }
      }

      if (pixelsMatch) {
        console.log(`✓ Pixels match exactly`);
        passCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      console.log(`✗ Decode failed: ${e.message}`);
      console.error(e.stack);
      failCount++;
    }

    console.log();
  }

  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total tests: ${tests.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n✓ All decoder tests PASSED");
  } else {
    console.log("\n✗ Some decoder tests FAILED");
  }
}

if (import.meta.main) {
  runDecoderTests();
}
