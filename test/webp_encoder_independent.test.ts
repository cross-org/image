#!/usr/bin/env -S deno run -A

/**
 * Comprehensive WebP encoder test without using our decoder
 * Creates WebP files and validates them structurally
 */

import { WebPEncoder } from "../src/utils/webp_encoder.ts";

interface TestCase {
  name: string;
  width: number;
  height: number;
  data: Uint8Array;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: "solid_red",
    width: 1,
    height: 1,
    data: new Uint8Array([255, 0, 0, 255]),
    description: "Single red pixel - simplest possible case",
  },
  {
    name: "two_colors",
    width: 2,
    height: 1,
    data: new Uint8Array([
      255,
      0,
      0,
      255, // red
      0,
      0,
      255,
      255, // blue
    ]),
    description: "Two colors - tests simple Huffman (2 symbols)",
  },
  {
    name: "four_colors",
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
    description: "Four colors - requires complex Huffman (>2 symbols)",
  },
  {
    name: "gradient_small",
    width: 4,
    height: 4,
    data: (() => {
      const d = new Uint8Array(4 * 4 * 4);
      for (let i = 0; i < 16; i++) {
        d[i * 4] = i * 17; // 0, 17, 34, ...
        d[i * 4 + 1] = i * 17;
        d[i * 4 + 2] = i * 17;
        d[i * 4 + 3] = 255;
      }
      return d;
    })(),
    description: "Small gradient - many unique colors, complex Huffman",
  },
];

function validateWebPStructure(data: Uint8Array, test: TestCase): boolean {
  console.log(`\nValidating ${test.name}: ${test.description}`);
  console.log("=".repeat(70));

  let valid = true;

  // Check RIFF header
  if (data.length < 12) {
    console.log("✗ File too small (< 12 bytes)");
    return false;
  }

  const riff = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (riff !== "RIFF") {
    console.log(`✗ Invalid RIFF signature: "${riff}"`);
    valid = false;
  } else {
    console.log(`✓ RIFF signature correct`);
  }

  const fileSize = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
  const expectedSize = data.length - 8;
  if (fileSize !== expectedSize) {
    console.log(
      `✗ File size mismatch: header says ${fileSize}, actual is ${expectedSize}`,
    );
    valid = false;
  } else {
    console.log(`✓ File size correct: ${fileSize} bytes`);
  }

  const webp = String.fromCharCode(data[8], data[9], data[10], data[11]);
  if (webp !== "WEBP") {
    console.log(`✗ Invalid WEBP signature: "${webp}"`);
    valid = false;
  } else {
    console.log(`✓ WEBP signature correct`);
  }

  // Check VP8L chunk
  if (data.length < 20) {
    console.log("✗ File too small for VP8L chunk");
    return false;
  }

  const vp8l = String.fromCharCode(data[12], data[13], data[14], data[15]);
  if (vp8l !== "VP8L") {
    console.log(`✗ Invalid chunk type: "${vp8l}" (expected VP8L)`);
    valid = false;
  } else {
    console.log(`✓ VP8L chunk type correct`);
  }

  const chunkSize = data[16] | (data[17] << 8) | (data[18] << 16) |
    (data[19] << 24);
  // Actual chunk data size (from byte 20 onwards, excluding padding)
  const actualDataSize = data.length - 20;
  // RIFF chunks are padded to even length, but size field contains unpadded size
  const expectedDataSize = chunkSize + (chunkSize % 2);
  if (actualDataSize !== expectedDataSize) {
    console.log(
      `✗ VP8L chunk size mismatch: header says ${chunkSize}, actual data is ${actualDataSize} bytes (expected ${expectedDataSize} with padding)`,
    );
    valid = false;
  } else {
    console.log(
      `✓ VP8L chunk size correct: ${chunkSize} bytes (${actualDataSize} with padding)`,
    );
  }

  // Check VP8L signature byte
  const signature = data[20];
  if (signature !== 0x2f) {
    console.log(
      `✗ Invalid VP8L signature: 0x${signature.toString(16)} (expected 0x2f)`,
    );
    valid = false;
  } else {
    console.log(`✓ VP8L signature correct: 0x2f`);
  }

  // Parse dimensions
  const bits = data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
  const width = (bits & 0x3fff) + 1;
  const height = ((bits >> 14) & 0x3fff) + 1;
  const hasAlpha = (bits >> 28) & 1;
  const version = (bits >> 29) & 7;

  if (width !== test.width) {
    console.log(`✗ Width mismatch: encoded ${width}, expected ${test.width}`);
    valid = false;
  } else {
    console.log(`✓ Width correct: ${width}`);
  }

  if (height !== test.height) {
    console.log(
      `✗ Height mismatch: encoded ${height}, expected ${test.height}`,
    );
    valid = false;
  } else {
    console.log(`✓ Height correct: ${height}`);
  }

  console.log(`  Has alpha: ${hasAlpha}`);
  console.log(`  Version: ${version}`);

  // Show hex dump of first few bytes of image data
  console.log("\nImage data header (bytes 25-40):");
  const imageDataStart = data.slice(25, Math.min(41, data.length));
  const hex = Array.from(imageDataStart)
    .map((b, i) => {
      const h = b.toString(16).padStart(2, "0");
      return ((i % 16 === 0 && i > 0) ? "\n  " : "") + h + " ";
    })
    .join("");
  console.log(`  ${hex}`);

  console.log(`\nTotal file size: ${data.length} bytes`);
  console.log(`Validation: ${valid ? "✓ PASSED" : "✗ FAILED"}`);

  return valid;
}

async function runEncoderTests() {
  console.log("WebP Encoder Independent Test Suite");
  console.log("=".repeat(70));
  console.log("Testing encoder WITHOUT using our decoder\n");

  let passCount = 0;
  let failCount = 0;

  for (const test of testCases) {
    const encoder = new WebPEncoder(test.width, test.height, test.data);
    const encoded = encoder.encode(100); // quality 100 = lossless

    // Save to file for external validation
    // Note: Using /tmp for test files (Unix/Linux/macOS). On Windows, tests may need adjustment.
    const filename = `/tmp/encoder_test_${test.name}.webp`;
    await Deno.writeFile(filename, encoded);
    console.log(`Saved to: ${filename}`);

    const valid = validateWebPStructure(encoded, test);

    if (valid) {
      passCount++;
    } else {
      failCount++;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n✓ All encoder tests PASSED");
    console.log("\nYou can validate these files with external tools:");
    console.log("  - Open in a web browser");
    console.log("  - Use: file /tmp/encoder_test_*.webp");
    console.log("  - Use: dwebp /tmp/encoder_test_*.webp -o /tmp/test_*.png");
    console.log("  - Use: identify /tmp/encoder_test_*.webp  (ImageMagick)");
  } else {
    console.log("\n✗ Some encoder tests FAILED");
    console.log("Review the output above for details");
  }
}

if (import.meta.main) {
  await runEncoderTests();
}
