/**
 * Test progressive JPEG decoding with multiple scans
 */

import { assertEquals, assertGreater } from "@std/assert";
import { test } from "@cross/test";
import { JPEGDecoder } from "../../src/utils/jpeg_decoder.ts";
import { JPEGEncoder } from "../../src/utils/jpeg_encoder.ts";

/**
 * Helper function to check if a JPEG has SOF2 marker (progressive JPEG)
 */
function hasProgressiveMarker(data: Uint8Array): boolean {
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0xff && data[i + 1] === 0xc2) {
      return true;
    }
  }
  return false;
}

function parseSOSHeaders(
  data: Uint8Array,
): Array<{ Ns: number; Ss: number; Se: number }> {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    throw new Error("Not a JPEG (missing SOI)");
  }

  const sos: Array<{ Ns: number; Ss: number; Se: number }> = [];
  let i = 2;

  while (i + 1 < data.length) {
    // Find next marker (0xFF ..)
    while (i < data.length && data[i] !== 0xff) i++;
    if (i + 1 >= data.length) break;

    // Skip fill bytes (0xFF 0xFF ...)
    while (i + 1 < data.length && data[i] === 0xff && data[i + 1] === 0xff) i++;
    if (i + 1 >= data.length) break;

    const marker = (data[i] << 8) | data[i + 1];
    i += 2;

    // Markers without length
    if (marker === 0xffd8 || marker === 0xffd9) {
      if (marker === 0xffd9) break;
      continue;
    }
    if (marker >= 0xffd0 && marker <= 0xffd7) {
      continue;
    }
    if (marker === 0xff01) {
      continue;
    }

    if (i + 1 >= data.length) break;
    const length = (data[i] << 8) | data[i + 1];
    if (length < 2) throw new Error("Invalid segment length");

    // Start of Scan: record header fields, then skip entropy-coded data.
    if (marker === 0xffda) {
      // i points at SOS length MSB
      const ns = data[i + 2];
      const compsEnd = i + 3 + ns * 2;
      const ss = data[compsEnd];
      const se = data[compsEnd + 1];
      sos.push({ Ns: ns, Ss: ss, Se: se });

      // Move to end of SOS header
      i += length;

      // Skip entropy-coded data until next marker (0xFF followed by non-0x00)
      while (i + 1 < data.length) {
        if (data[i] === 0xff) {
          const next = data[i + 1];
          if (next === 0x00) {
            i += 2;
            continue;
          }
          if (next === 0xff) {
            i += 1;
            continue;
          }
          // Restart markers can appear inside entropy-coded data
          if (next >= 0xd0 && next <= 0xd7) {
            i += 2;
            continue;
          }
          // Found a real marker; leave i at 0xFF so outer loop consumes it.
          break;
        }
        i += 1;
      }

      continue;
    }

    i += length;
  }

  return sos;
}

test(
  "Progressive JPEG: decoder correctly accumulates coefficients across scans",
  () => {
    // Create a test pattern with clear features
    const width = 32;
    const height = 32;
    const data = new Uint8Array(width * height * 4);

    // Create a checkerboard pattern with gradients
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const checkerboard = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
        const base = checkerboard ? 200 : 50;

        data[i] = base + Math.floor((x / width) * 50); // R
        data[i + 1] = base + Math.floor((y / height) * 50); // G
        data[i + 2] = base; // B
        data[i + 3] = 255; // A
      }
    }

    // Encode as progressive JPEG
    const encoder = new JPEGEncoder({
      quality: 85,
      progressive: true,
    });
    const encoded = encoder.encode(width, height, data);

    // Verify it's progressive (has SOF2 marker)
    assertEquals(
      hasProgressiveMarker(encoded),
      true,
      "Should be a progressive JPEG",
    );

    // Decode the progressive JPEG
    const decoder = new JPEGDecoder(encoded);
    const decoded = decoder.decode();

    // Verify dimensions
    assertEquals(decoded.length, width * height * 4);

    // Verify the pattern is recognizable
    // Check that corner pixels have expected characteristics
    const topLeft = decoded[0]; // R channel of top-left
    const topRight = decoded[(width - 1) * 4]; // R channel of top-right

    // Top-left should have lower R value than top-right (gradient)
    assertGreater(topRight, topLeft, "Gradient should be preserved");

    // Bottom-left should have different G value than top-left (vertical gradient)
    const topLeftG = decoded[1];
    const bottomLeftG = decoded[((height - 1) * width) * 4 + 1];
    assertGreater(
      bottomLeftG,
      topLeftG,
      "Vertical gradient should be preserved",
    );

    // Verify we don't have all-gray or all-zero image (common failure modes)
    const NEUTRAL_GRAY = 128;
    let hasVariation = false;
    for (let i = 0; i < Math.min(100, decoded.length / 4); i++) {
      const idx = i * 4;
      const r = decoded[idx];
      const g = decoded[idx + 1];
      const b = decoded[idx + 2];
      if (r !== g || g !== b || r !== NEUTRAL_GRAY) {
        hasVariation = true;
        break;
      }
    }
    assertEquals(hasVariation, true, "Image should not be all gray");
  },
);

test("Progressive JPEG: AC scans are non-interleaved (compat)", () => {
  const width = 16;
  const height = 16;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 1] = 20;
    data[i + 2] = 100;
    data[i + 3] = 255;
  }

  const encoder = new JPEGEncoder({ quality: 85, progressive: true });
  const encoded = encoder.encode(width, height, data);

  assertEquals(hasProgressiveMarker(encoded), true);

  const scans = parseSOSHeaders(encoded);
  assertGreater(scans.length, 1);

  // For broad reader compatibility, progressive AC scans should be single-component.
  for (const scan of scans) {
    if (scan.Ss > 0) {
      assertEquals(
        scan.Ns,
        1,
        `Expected Ns=1 for AC scan (Ss=${scan.Ss}, Se=${scan.Se})`,
      );
    }
  }
});

test("Progressive JPEG: roundtrip preserves image quality", () => {
  // Create a more complex pattern
  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  // Create concentric circles pattern
  const centerX = width / 2;
  const centerY = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const value = Math.floor(128 + 127 * Math.sin(dist / 4));

      data[i] = value; // R
      data[i + 1] = 255 - value; // G (inverse)
      data[i + 2] = 128; // B (constant)
      data[i + 3] = 255; // A
    }
  }

  // Encode as progressive
  const encoder = new JPEGEncoder({
    quality: 90,
    progressive: true,
  });
  const encoded = encoder.encode(width, height, data);

  // Decode
  const decoder = new JPEGDecoder(encoded);
  const decoded = decoder.decode();

  assertEquals(decoded.length, width * height * 4);

  // Verify center pixel has expected characteristics
  const centerIdx = (Math.floor(centerY) * width + Math.floor(centerX)) * 4;
  const centerR = decoded[centerIdx];
  const centerG = decoded[centerIdx + 1];

  // Center should be roughly in the middle range (not 0 or 255)
  assertGreater(centerR, 50, "Center R should not be too dark");
  assertGreater(250, centerR, "Center R should not be too bright");
  assertGreater(centerG, 50, "Center G should not be too dark");
  assertGreater(250, centerG, "Center G should not be too bright");
});

test(
  "Progressive JPEG: handles grayscale progressive images",
  () => {
    // Create a grayscale gradient
    const width = 32;
    const height = 32;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const gray = Math.floor((x / width) * 255);

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        data[i + 3] = 255;
      }
    }

    // Encode as progressive
    const encoder = new JPEGEncoder({
      quality: 85,
      progressive: true,
    });
    const encoded = encoder.encode(width, height, data);

    // Decode
    const decoder = new JPEGDecoder(encoded);
    const decoded = decoder.decode();

    assertEquals(decoded.length, width * height * 4);

    // Verify gradient is preserved
    const leftEdge = decoded[0]; // First pixel R
    const rightEdge = decoded[(width - 1) * 4]; // Last pixel in first row R

    assertGreater(rightEdge, leftEdge + 100, "Gradient should be significant");
  },
);
