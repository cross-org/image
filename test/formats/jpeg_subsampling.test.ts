import { assertEquals } from "@std/assert";
import { test } from "@cross/test";

import { JPEGFormat } from "../../src/formats/jpeg.ts";
import { Image } from "../../src/image.ts";
import { withoutOffscreenCanvas } from "../test_utils.ts";

/**
 * Tests for JPEG chroma subsampling support (4:4:4, 4:2:2, 4:2:0)
 *
 * These tests verify that the pure-JS JPEG decoder correctly handles
 * images with different chroma subsampling modes.
 */

test("JPEG subsampling: decode 4:4:4 (no subsampling)", async () => {
  const data = await Deno.readFile("test/fixtures/jpeg/test_444.jpg");
  const format = new JPEGFormat();

  const decoded = await withoutOffscreenCanvas(async () => {
    return await format.decode(data);
  });

  assertEquals(decoded.width, 32);
  assertEquals(decoded.height, 32);
  assertEquals(decoded.data.length, 32 * 32 * 4);

  // Verify first pixel has reasonable values (it should be near 0,0,128 for our gradient)
  const r = decoded.data[0];
  const g = decoded.data[1];
  const b = decoded.data[2];
  const a = decoded.data[3];

  assertEquals(a, 255, "Alpha channel should be 255");
  // Allow tolerance for JPEG compression
  assertEquals(
    r >= 0 && r <= 50,
    true,
    `Red channel should be near 0, got ${r}`,
  );
  assertEquals(
    g >= 0 && g <= 50,
    true,
    `Green channel should be near 0, got ${g}`,
  );
  assertEquals(
    b >= 100 && b <= 150,
    true,
    `Blue channel should be near 128, got ${b}`,
  );
});

test("JPEG subsampling: decode 4:2:2 (horizontal subsampling)", async () => {
  const data = await Deno.readFile("test/fixtures/jpeg/test_422.jpg");
  const format = new JPEGFormat();

  const decoded = await withoutOffscreenCanvas(async () => {
    return await format.decode(data);
  });

  assertEquals(decoded.width, 32);
  assertEquals(decoded.height, 32);
  assertEquals(decoded.data.length, 32 * 32 * 4);

  // Verify the image decoded successfully
  // Check a middle pixel for reasonable gradient values
  const midX = 16;
  const midY = 16;
  const offset = (midY * 32 + midX) * 4;

  const r = decoded.data[offset];
  const g = decoded.data[offset + 1];
  const b = decoded.data[offset + 2];
  const a = decoded.data[offset + 3];

  assertEquals(a, 255, "Alpha channel should be 255");
  // Middle pixel should have R and G around 128 (half of 255) with tolerance
  assertEquals(
    r >= 80 && r <= 170,
    true,
    `Red channel at center should be near 128, got ${r}`,
  );
  assertEquals(
    g >= 80 && g <= 170,
    true,
    `Green channel at center should be near 128, got ${g}`,
  );
  assertEquals(
    b >= 100 && b <= 150,
    true,
    `Blue channel should be near 128, got ${b}`,
  );
});

test("JPEG subsampling: decode 4:2:0 (horizontal and vertical subsampling)", async () => {
  const data = await Deno.readFile("test/fixtures/jpeg/test_420.jpg");
  const format = new JPEGFormat();

  const decoded = await withoutOffscreenCanvas(async () => {
    return await format.decode(data);
  });

  assertEquals(decoded.width, 32);
  assertEquals(decoded.height, 32);
  assertEquals(decoded.data.length, 32 * 32 * 4);

  // Verify corners and center have expected gradient values
  // Top-left corner (0,0) - should be dark (R~0, G~0, B~128)
  const tl_offset = 0;
  assertEquals(
    decoded.data[tl_offset + 3],
    255,
    "Alpha channel should be 255",
  );
  assertEquals(
    decoded.data[tl_offset] <= 50,
    true,
    `Top-left red should be dark, got ${decoded.data[tl_offset]}`,
  );

  // Bottom-right corner (31,31) - should be bright (R~255, G~255, B~128)
  const br_offset = (31 * 32 + 31) * 4;
  assertEquals(
    decoded.data[br_offset + 3],
    255,
    "Alpha channel should be 255",
  );
  assertEquals(
    decoded.data[br_offset] >= 200,
    true,
    `Bottom-right red should be bright, got ${decoded.data[br_offset]}`,
  );
  assertEquals(
    decoded.data[br_offset + 1] >= 200,
    true,
    `Bottom-right green should be bright, got ${decoded.data[br_offset + 1]}`,
  );
});

test("JPEG subsampling: decode 4:2:0 larger image (64x64)", async () => {
  const data = await Deno.readFile("test/fixtures/jpeg/test_420_64x64.jpg");
  const format = new JPEGFormat();

  const decoded = await withoutOffscreenCanvas(async () => {
    return await format.decode(data);
  });

  assertEquals(decoded.width, 64);
  assertEquals(decoded.height, 64);
  assertEquals(decoded.data.length, 64 * 64 * 4);

  // Verify decoding worked - check that we have varied pixel values
  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;

  for (let i = 0; i < decoded.data.length; i += 4) {
    const r = decoded.data[i];
    const g = decoded.data[i + 1];
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minG = Math.min(minG, g);
    maxG = Math.max(maxG, g);
  }

  // Should have a range of colors (gradient)
  assertEquals(
    maxR - minR > 100,
    true,
    `Should have red gradient range, got ${minR}-${maxR}`,
  );
  assertEquals(
    maxG - minG > 100,
    true,
    `Should have green gradient range, got ${minG}-${maxG}`,
  );
});

test("JPEG subsampling: decode 4:2:0 with odd dimensions (33x17)", async () => {
  const data = await Deno.readFile("test/fixtures/jpeg/test_420_odd.jpg");
  const format = new JPEGFormat();

  const decoded = await withoutOffscreenCanvas(async () => {
    return await format.decode(data);
  });

  // Verify odd dimensions are handled correctly
  assertEquals(decoded.width, 33);
  assertEquals(decoded.height, 17);
  assertEquals(decoded.data.length, 33 * 17 * 4);

  // Verify the image decoded successfully
  // Check first pixel - should have low red value (left edge of horizontal gradient)
  assertEquals(decoded.data[3], 255, "Alpha should be 255");
  assertEquals(
    decoded.data[0] <= 50,
    true,
    `First pixel red should be dark, got ${decoded.data[0]}`,
  );

  // Check top-right pixel (should have high red value - right edge of horizontal gradient)
  const topRightOffset = (0 * 33 + 32) * 4;
  assertEquals(decoded.data[topRightOffset + 3], 255, "Alpha should be 255");
  assertEquals(
    decoded.data[topRightOffset] >= 200,
    true,
    `Top-right pixel red should be bright, got ${decoded.data[topRightOffset]}`,
  );

  // Verify alpha channel is correctly set throughout the image
  for (let i = 3; i < decoded.data.length; i += 4) {
    assertEquals(decoded.data[i], 255, `Alpha at position ${i} should be 255`);
  }
});

test("JPEG subsampling: Image class integration with 4:2:0", async () => {
  const data = await Deno.readFile("test/fixtures/jpeg/test_420.jpg");

  const image = await withoutOffscreenCanvas(async () => {
    return await Image.read(data);
  });

  assertEquals(image.width, 32);
  assertEquals(image.height, 32);
  assertEquals(image.data.length, 32 * 32 * 4);

  // Verify we can re-encode the decoded image
  const reencoded = await withoutOffscreenCanvas(async () => {
    return await image.save("jpeg");
  });

  assertEquals(reencoded[0], 0xff);
  assertEquals(reencoded[1], 0xd8);
  assertEquals(reencoded[2], 0xff);
});

test("JPEG subsampling: roundtrip 4:2:0 to 4:4:4 and back", async () => {
  // Load a 4:2:0 image
  const data420 = await Deno.readFile("test/fixtures/jpeg/test_420.jpg");

  const image = await withoutOffscreenCanvas(async () => {
    return await Image.read(data420);
  });

  // Re-encode (will use 4:4:4 as that's what our encoder produces)
  const reencoded = await withoutOffscreenCanvas(async () => {
    return await image.save("jpeg");
  });

  // Decode the re-encoded image
  const decoded = await withoutOffscreenCanvas(async () => {
    return await Image.read(reencoded);
  });

  assertEquals(decoded.width, 32);
  assertEquals(decoded.height, 32);

  // Colors should be similar (within lossy compression tolerance)
  // Check center pixel
  const centerOffset = (16 * 32 + 16) * 4;
  const origCenter = [
    image.data[centerOffset],
    image.data[centerOffset + 1],
    image.data[centerOffset + 2],
  ];
  const newCenter = [
    decoded.data[centerOffset],
    decoded.data[centerOffset + 1],
    decoded.data[centerOffset + 2],
  ];

  // Allow up to 50 tolerance for double JPEG compression
  const tolerance = 50;
  for (let i = 0; i < 3; i++) {
    const diff = Math.abs(origCenter[i] - newCenter[i]);
    assertEquals(
      diff <= tolerance,
      true,
      `Channel ${i} difference ${diff} exceeds tolerance ${tolerance}`,
    );
  }
});
