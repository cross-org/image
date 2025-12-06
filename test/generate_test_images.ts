/**
 * Generate comprehensive test images for verifying pure-JS decoders
 * This script creates various test images that exercise different aspects of each format
 */

import { Image } from "../mod.ts";

async function generateTestImages() {
  console.log("Generating test images...");

  // 1. Simple solid color image (2x2)
  const solid = Image.fromRGBA(2, 2, new Uint8Array([
    255, 0, 0, 255,  // red
    0, 255, 0, 255,  // green
    0, 0, 255, 255,  // blue
    255, 255, 0, 255 // yellow
  ]));
  
  // 2. Gradient image (100x100)
  const gradientData = new Uint8Array(100 * 100 * 4);
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const i = (y * 100 + x) * 4;
      gradientData[i] = Math.floor((x / 100) * 255);     // R gradient
      gradientData[i + 1] = Math.floor((y / 100) * 255); // G gradient
      gradientData[i + 2] = 128;                          // B constant
      gradientData[i + 3] = 255;                          // A opaque
    }
  }
  const gradient = Image.fromRGBA(100, 100, gradientData);

  // 3. Pattern image (64x64) with checkerboard
  const patternData = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const isBlack = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const val = isBlack ? 0 : 255;
      patternData[i] = val;
      patternData[i + 1] = val;
      patternData[i + 2] = val;
      patternData[i + 3] = 255;
    }
  }
  const pattern = Image.fromRGBA(64, 64, patternData);

  // 4. Large image (256x256) with various colors
  const largeData = new Uint8Array(256 * 256 * 4);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      largeData[i] = x;                                // R
      largeData[i + 1] = y;                            // G
      largeData[i + 2] = (x + y) % 256;                // B
      largeData[i + 3] = 255;                          // A
    }
  }
  const large = Image.fromRGBA(256, 256, largeData);

  // Generate images in each format
  const formats = ["png", "bmp", "gif", "jpeg", "tiff"];
  const images = [
    { name: "solid", image: solid },
    { name: "gradient", image: gradient },
    { name: "pattern", image: pattern },
    { name: "large", image: large }
  ];

  for (const format of formats) {
    console.log(`Generating ${format} images...`);
    for (const { name, image } of images) {
      const encoded = await image.save(format);
      await Deno.writeFile(`test_images/${name}.${format}`, encoded);
      console.log(`  - ${name}.${format} (${encoded.length} bytes)`);
    }
  }

  console.log("Test images generated successfully!");
}

if (import.meta.main) {
  await generateTestImages();
}
