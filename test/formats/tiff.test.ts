import { assertEquals, assertRejects } from "@std/assert";
import { test } from "@cross/test";
import { TIFFFormat } from "../../src/formats/tiff.ts";

test("TIFF: canDecode - valid TIFF signature (little-endian)", () => {
  const validTIFF = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(validTIFF), true);
});

test("TIFF: canDecode - valid TIFF signature (big-endian)", () => {
  const validTIFF = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 0]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(validTIFF), true);
});

test("TIFF: canDecode - invalid signature", () => {
  const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(invalid), false);
});

test("TIFF: canDecode - too short", () => {
  const tooShort = new Uint8Array([0x49, 0x49]);
  const format = new TIFFFormat();

  assertEquals(format.canDecode(tooShort), false);
});

test("TIFF: decode - invalid data throws", async () => {
  const format = new TIFFFormat();
  const invalid = new Uint8Array([0, 1, 2, 3]);

  await assertRejects(
    async () => await format.decode(invalid),
    Error,
    "Invalid TIFF signature",
  );
});

test("TIFF: encode and decode - small image", async () => {
  const format = new TIFFFormat();

  // Create a simple 2x2 RGBA image
  const imageData = {
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
  };

  // Encode
  const encoded = await format.encode(imageData);

  // Check it starts with TIFF signature (little-endian)
  assertEquals(encoded[0], 0x49);
  assertEquals(encoded[1], 0x49);
  assertEquals(encoded[2], 0x2a);
  assertEquals(encoded[3], 0x00);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);
});

test("TIFF: properties", () => {
  const format = new TIFFFormat();

  assertEquals(format.name, "tiff");
  assertEquals(format.mimeType, "image/tiff");
});

test("TIFF: encode - single pixel", async () => {
  const format = new TIFFFormat();

  const imageData = {
    width: 1,
    height: 1,
    data: new Uint8Array([128, 128, 128, 255]),
  };

  const encoded = await format.encode(imageData);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);
});

test("TIFF: encode - larger image", async () => {
  const format = new TIFFFormat();

  // Create a 10x10 gradient image
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x / width) * 255; // R
      data[i + 1] = (y / height) * 255; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode
  const encoded = await format.encode(imageData);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);
});

test("TIFF: encode with LZW compression - small image", async () => {
  const format = new TIFFFormat();

  // Create a simple 2x2 RGBA image
  const imageData = {
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
  };

  // Encode with LZW compression
  const encoded = await format.encode(imageData, { compression: "lzw" });

  // Check it starts with TIFF signature (little-endian)
  assertEquals(encoded[0], 0x49);
  assertEquals(encoded[1], 0x49);
  assertEquals(encoded[2], 0x2a);
  assertEquals(encoded[3], 0x00);

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);

  // Decode and verify dimensions and content match
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, imageData.width);
  assertEquals(decoded.height, imageData.height);
  assertEquals(decoded.data.length, imageData.data.length);

  // Verify pixel data matches exactly (LZW is lossless)
  for (let i = 0; i < imageData.data.length; i++) {
    assertEquals(
      decoded.data[i],
      imageData.data[i],
      `Pixel mismatch at index ${i}`,
    );
  }
});

test("TIFF: LZW roundtrip - larger image", async () => {
  const format = new TIFFFormat();

  // Create a 10x10 gradient image
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x / width) * 255; // R
      data[i + 1] = (y / height) * 255; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode with LZW compression
  const encoded = await format.encode(imageData, { compression: "lzw" });

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, data.length);

  // Verify pixel data matches exactly
  for (let i = 0; i < data.length; i++) {
    assertEquals(decoded.data[i], data[i], `Pixel mismatch at index ${i}`);
  }
});

test("TIFF: LZW compression reduces size for uniform images", async () => {
  const format = new TIFFFormat();

  // Create a 50x50 solid color image (highly compressible)
  const width = 50;
  const height = 50;
  const data = new Uint8Array(width * height * 4);

  // Fill with solid red
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 255; // A
  }

  const imageData = { width, height, data };

  // Encode uncompressed and LZW
  const uncompressed = await format.encode(imageData, { compression: "none" });
  const lzwCompressed = await format.encode(imageData, { compression: "lzw" });

  // LZW should be smaller for uniform images
  console.log(
    `Uncompressed: ${uncompressed.length}, LZW: ${lzwCompressed.length}`,
  );
  assertEquals(lzwCompressed.length < uncompressed.length, true);
});

test("TIFF: LZW roundtrip - pattern image", async () => {
  const format = new TIFFFormat();

  // Create a checkerboard pattern
  const width = 8;
  const height = 8;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isWhite = (x + y) % 2 === 0;
      const value = isWhite ? 255 : 0;
      data[i] = value; // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode with LZW
  const encoded = await format.encode(imageData, { compression: "lzw" });

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);
  assertEquals(decoded.data.length, data.length);

  // Verify pixel data matches exactly
  for (let i = 0; i < data.length; i++) {
    assertEquals(decoded.data[i], data[i], `Pixel mismatch at index ${i}`);
  }
});

test("TIFF: encode defaults to uncompressed when no options", async () => {
  const format = new TIFFFormat();

  const imageData = {
    width: 2,
    height: 2,
    data: new Uint8Array([
      255,
      0,
      0,
      255,
      0,
      255,
      0,
      255,
      0,
      0,
      255,
      255,
      255,
      255,
      0,
      255,
    ]),
  };

  // Encode without options (should be uncompressed)
  const encoded = await format.encode(imageData);

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, imageData.width);
  assertEquals(decoded.height, imageData.height);
  assertEquals(decoded.data.length, imageData.data.length);

  // Verify pixel data matches exactly
  for (let i = 0; i < imageData.data.length; i++) {
    assertEquals(
      decoded.data[i],
      imageData.data[i],
      `Pixel mismatch at index ${i}`,
    );
  }
});

test("TIFF: encode and decode grayscale image", async () => {
  const format = new TIFFFormat();

  // Create a simple 4x4 grayscale gradient
  const width = 4;
  const height = 4;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = Math.floor((x + y * width) / (width * height - 1) * 255);
      data[i] = gray; // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode as grayscale
  const encoded = await format.encode(imageData, { grayscale: true });

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Verify grayscale values are preserved (allowing for small rounding differences)
  for (let i = 0; i < width * height; i++) {
    const srcGray = data[i * 4]; // Original R value
    const dstGray = decoded.data[i * 4]; // Decoded R value
    const diff = Math.abs(srcGray - dstGray);
    assertEquals(
      diff <= 1,
      true,
      `Grayscale mismatch at pixel ${i}: ${srcGray} vs ${dstGray}`,
    );
  }
});

test("TIFF: grayscale encoding is smaller than RGBA", async () => {
  const format = new TIFFFormat();

  // Create a simple grayscale image
  const width = 50;
  const height = 50;
  const data = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const gray = 128;
    data[i * 4] = gray;
    data[i * 4 + 1] = gray;
    data[i * 4 + 2] = gray;
    data[i * 4 + 3] = 255;
  }

  const imageData = { width, height, data };

  // Encode as RGBA and grayscale
  const rgbaEncoded = await format.encode(imageData);
  const grayEncoded = await format.encode(imageData, { grayscale: true });

  console.log(
    `RGBA: ${rgbaEncoded.length} bytes, Grayscale: ${grayEncoded.length} bytes`,
  );

  // Grayscale should be smaller (1 byte per pixel vs 4)
  assertEquals(grayEncoded.length < rgbaEncoded.length, true);
});

test("TIFF: grayscale with LZW compression", async () => {
  const format = new TIFFFormat();

  // Create a grayscale pattern
  const width = 8;
  const height = 8;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = (x + y) % 2 === 0 ? 255 : 0;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
  }

  const imageData = { width, height, data };

  // Encode as grayscale with LZW
  const encoded = await format.encode(imageData, {
    grayscale: true,
    compression: "lzw",
  });

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Verify pattern is preserved
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const expectedGray = (x + y) % 2 === 0 ? 255 : 0;
      const actualGray = decoded.data[i];
      assertEquals(actualGray, expectedGray, `Pattern mismatch at ${x},${y}`);
    }
  }
});

test("TIFF: encode and decode RGB (no alpha) image", async () => {
  const format = new TIFFFormat();

  // Create a colorful 4x4 image
  const width = 4;
  const height = 4;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x * 60; // R varies by x
      data[i + 1] = y * 60; // G varies by y
      data[i + 2] = 128; // B constant
      data[i + 3] = 255; // A (will be dropped)
    }
  }

  const imageData = { width, height, data };

  // Encode as RGB (no alpha)
  const encoded = await format.encode(imageData, { rgb: true });

  // Should be a valid TIFF
  assertEquals(format.canDecode(encoded), true);

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Verify RGB values are preserved (alpha should be 255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      assertEquals(decoded.data[i], data[i], `R mismatch at ${x},${y}`);
      assertEquals(decoded.data[i + 1], data[i + 1], `G mismatch at ${x},${y}`);
      assertEquals(decoded.data[i + 2], data[i + 2], `B mismatch at ${x},${y}`);
      assertEquals(
        decoded.data[i + 3],
        255,
        `Alpha should be 255 at ${x},${y}`,
      );
    }
  }
});

test("TIFF: RGB encoding is smaller than RGBA", async () => {
  const format = new TIFFFormat();

  // Create a color image
  const width = 50;
  const height = 50;
  const data = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255; // R
    data[i * 4 + 1] = 128; // G
    data[i * 4 + 2] = 64; // B
    data[i * 4 + 3] = 255; // A
  }

  const imageData = { width, height, data };

  // Encode as RGBA and RGB
  const rgbaEncoded = await format.encode(imageData);
  const rgbEncoded = await format.encode(imageData, { rgb: true });

  console.log(
    `RGBA: ${rgbaEncoded.length} bytes, RGB: ${rgbEncoded.length} bytes`,
  );

  // RGB should be smaller (3 bytes per pixel vs 4)
  assertEquals(rgbEncoded.length < rgbaEncoded.length, true);
});

test("TIFF: RGB with LZW compression", async () => {
  const format = new TIFFFormat();

  // Create a color pattern
  const width = 8;
  const height = 8;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isRed = (x + y) % 2 === 0;
      data[i] = isRed ? 255 : 0; // R
      data[i + 1] = isRed ? 0 : 255; // G
      data[i + 2] = 0; // B
      data[i + 3] = 255; // A
    }
  }

  const imageData = { width, height, data };

  // Encode as RGB with LZW
  const encoded = await format.encode(imageData, {
    rgb: true,
    compression: "lzw",
  });

  // Decode and verify
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, width);
  assertEquals(decoded.height, height);

  // Verify pattern is preserved
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isRed = (x + y) % 2 === 0;
      assertEquals(
        decoded.data[i],
        isRed ? 255 : 0,
        `R mismatch at ${x},${y}`,
      );
      assertEquals(
        decoded.data[i + 1],
        isRed ? 0 : 255,
        `G mismatch at ${x},${y}`,
      );
      assertEquals(decoded.data[i + 2], 0, `B mismatch at ${x},${y}`);
    }
  }
});
