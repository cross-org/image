---
title: "Multi-Frame Images"
parent: "Examples"
---

# Multi-Frame Images

Examples of working with animated GIFs, APNGs, and multi-page TIFFs.

## Animated GIFs

### Decode GIF Frames

```ts
import { Image } from "jsr:@cross/image";

// Decode all frames from animated GIF
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

console.log(`Canvas size: ${multiFrame.width}x${multiFrame.height}`);
console.log(`Number of frames: ${multiFrame.frames.length}`);

// Access individual frames
for (let i = 0; i < multiFrame.frames.length; i++) {
  const frame = multiFrame.frames[i];
  console.log(`Frame ${i}:`);
  console.log(`  Size: ${frame.width}x${frame.height}`);
  console.log(`  Delay: ${frame.frameMetadata?.delay}ms`);
  console.log(`  Disposal: ${frame.frameMetadata?.disposal}`);
}
```

### Extract Single Frame

```ts
import { Image } from "jsr:@cross/image";

const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Get first frame
const firstFrame = multiFrame.frames[0];
const image = Image.fromRGBA(
  firstFrame.width,
  firstFrame.height,
  firstFrame.data,
);

// Save as static image
await Deno.writeFile("first-frame.png", await image.encode("png"));
```

### Extract All Frames

```ts
import { Image } from "jsr:@cross/image";

const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Save each frame
for (let i = 0; i < multiFrame.frames.length; i++) {
  const frame = multiFrame.frames[i];
  const image = Image.fromRGBA(frame.width, frame.height, frame.data);

  const filename = `frame-${String(i).padStart(3, "0")}.png`;
  await Deno.writeFile(filename, await image.encode("png"));

  console.log(`Saved ${filename}`);
}
```

### Create Animated GIF

```ts
import { Image } from "jsr:@cross/image";

// Create frames
const frame1 = Image.create(200, 200, 255, 0, 0); // Red
const frame2 = Image.create(200, 200, 0, 255, 0); // Green
const frame3 = Image.create(200, 200, 0, 0, 255); // Blue

// Build multi-frame structure
const multiFrame = {
  width: 200,
  height: 200,
  frames: [
    {
      width: 200,
      height: 200,
      data: frame1.data,
      frameMetadata: { delay: 500, disposal: 0 },
    },
    {
      width: 200,
      height: 200,
      data: frame2.data,
      frameMetadata: { delay: 500, disposal: 0 },
    },
    {
      width: 200,
      height: 200,
      data: frame3.data,
      frameMetadata: { delay: 500, disposal: 0 },
    },
  ],
};

// Encode as animated GIF
const gifData = await Image.encodeFrames("gif", multiFrame);
await Deno.writeFile("animated.gif", gifData);
```

### Control GIF Loop Count

```ts
import { Image } from "jsr:@cross/image";

// Create frames
const frame1 = Image.create(200, 200, 255, 0, 0); // Red
const frame2 = Image.create(200, 200, 0, 0, 255); // Blue

const multiFrame = {
  width: 200,
  height: 200,
  frames: [
    {
      width: 200,
      height: 200,
      data: frame1.data,
      frameMetadata: { delay: 500 },
    },
    {
      width: 200,
      height: 200,
      data: frame2.data,
      frameMetadata: { delay: 500 },
    },
  ],
};

// Infinite loop (default)
const gifInfinite = await Image.encodeFrames("gif", multiFrame);
await Deno.writeFile("infinite.gif", gifInfinite);

// Loop 3 times then stop
const gif3Times = await Image.encodeFrames("gif", multiFrame, { loop: 3 });
await Deno.writeFile("loop-3-times.gif", gif3Times);

// Play once without looping
const gifOnce = await Image.encodeFrames("gif", multiFrame, { loop: 1 });
await Deno.writeFile("play-once.gif", gifOnce);
```

### Process Each Frame

```ts
import { Image } from "jsr:@cross/image";

// Load animated GIF
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Process each frame
const processedFrames = multiFrame.frames.map((frame) => {
  const image = Image.fromRGBA(frame.width, frame.height, frame.data);

  // Apply processing
  image.brightness(0.1).contrast(0.2).sharpen(0.5);

  return {
    width: frame.width,
    height: frame.height,
    data: image.data,
    frameMetadata: frame.frameMetadata,
  };
});

// Create new multi-frame
const processed = {
  width: multiFrame.width,
  height: multiFrame.height,
  frames: processedFrames,
};

// Save processed GIF
const output = await Image.encodeFrames("gif", processed);
await Deno.writeFile("processed.gif", output);
```

## Animated PNGs (APNG)

### Decode APNG Frames

```ts
import { Image } from "jsr:@cross/image";

// Decode all frames from APNG
const apngData = await Deno.readFile("animated.png");
const multiFrame = await Image.decodeFrames(apngData);

console.log(`Canvas size: ${multiFrame.width}x${multiFrame.height}`);
console.log(`Number of frames: ${multiFrame.frames.length}`);

// Process frames
for (let i = 0; i < multiFrame.frames.length; i++) {
  const frame = multiFrame.frames[i];
  console.log(`Frame ${i}: ${frame.width}x${frame.height}`);
  console.log(`  Delay: ${frame.frameMetadata?.delay}ms`);
}
```

### Create Animated PNG

```ts
import { Image } from "jsr:@cross/image";

// Create animation frames
const frames = [];
for (let i = 0; i < 10; i++) {
  const frame = Image.create(200, 200, i * 25, 100, 255 - i * 25);
  frames.push({
    width: 200,
    height: 200,
    data: frame.data,
    frameMetadata: { delay: 100, disposal: 0 },
  });
}

// Build multi-frame structure
const multiFrame = {
  width: 200,
  height: 200,
  frames,
};

// Encode as APNG
const apngData = await Image.encodeFrames("apng", multiFrame);
await Deno.writeFile("animated.png", apngData);
```

### Convert GIF to APNG

```ts
import { Image } from "jsr:@cross/image";

// Load GIF
const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Re-encode as APNG (higher quality)
const apngData = await Image.encodeFrames("apng", multiFrame);
await Deno.writeFile("animated.png", apngData);

console.log("Converted GIF to APNG");
```

## Multi-Page TIFFs

### Decode TIFF Pages

```ts
import { Image } from "jsr:@cross/image";

// Decode all pages from multi-page TIFF
const tiffData = await Deno.readFile("document.tiff");
const multiPage = await Image.decodeFrames(tiffData);

console.log(`Number of pages: ${multiPage.frames.length}`);

// Access individual pages
for (let i = 0; i < multiPage.frames.length; i++) {
  const page = multiPage.frames[i];
  console.log(`Page ${i + 1}: ${page.width}x${page.height}`);
}
```

### Extract TIFF Pages

```ts
import { Image } from "jsr:@cross/image";

const tiffData = await Deno.readFile("multipage.tiff");
const multiPage = await Image.decodeFrames(tiffData);

// Save each page as PNG
for (let i = 0; i < multiPage.frames.length; i++) {
  const page = multiPage.frames[i];
  const image = Image.fromRGBA(page.width, page.height, page.data);

  const filename = `page-${i + 1}.png`;
  await Deno.writeFile(filename, await image.encode("png"));

  console.log(`Saved ${filename}`);
}
```

### Create Multi-Page TIFF

```ts
import { Image } from "jsr:@cross/image";

// Create pages
const page1 = Image.create(800, 600, 255, 255, 255);
page1.fillRect(100, 100, 200, 200, 255, 0, 0);

const page2 = Image.create(800, 600, 255, 255, 255);
page2.fillRect(200, 200, 200, 200, 0, 255, 0);

const page3 = Image.create(800, 600, 255, 255, 255);
page3.fillRect(300, 300, 200, 200, 0, 0, 255);

// Build multi-page structure
const multiPage = {
  width: 800,
  height: 600,
  frames: [
    { width: 800, height: 600, data: page1.data },
    { width: 800, height: 600, data: page2.data },
    { width: 800, height: 600, data: page3.data },
  ],
};

// Encode as multi-page TIFF with LZW compression
const tiffData = await Image.encodeFrames("tiff", multiPage, {
  compression: "lzw",
});
await Deno.writeFile("multipage.tiff", tiffData);
```

### Create Document from Images

```ts
import { Image } from "jsr:@cross/image";

// Load individual images
const files = ["scan1.png", "scan2.png", "scan3.png"];
const pages = [];

for (const file of files) {
  const data = await Deno.readFile(file);
  const image = await Image.decode(data);

  pages.push({
    width: image.width,
    height: image.height,
    data: image.data,
  });
}

// Create multi-page TIFF
const multiPage = {
  width: pages[0].width,
  height: pages[0].height,
  frames: pages,
};

const tiffData = await Image.encodeFrames("tiff", multiPage, {
  compression: "lzw",
});
await Deno.writeFile("document.tiff", tiffData);

console.log(`Created document with ${pages.length} pages`);
```

## Frame Manipulation

### Resize All Frames

```ts
import { Image } from "jsr:@cross/image";

const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Resize all frames
const targetSize = { width: 400, height: 300 };
const resizedFrames = multiFrame.frames.map((frame) => {
  const image = Image.fromRGBA(frame.width, frame.height, frame.data);
  image.resize(targetSize);

  return {
    width: targetSize.width,
    height: targetSize.height,
    data: image.data,
    frameMetadata: frame.frameMetadata,
  };
});

// Create resized animation
const resized = {
  width: targetSize.width,
  height: targetSize.height,
  frames: resizedFrames,
};

const output = await Image.encodeFrames("gif", resized);
await Deno.writeFile("resized.gif", output);
```

### Apply Filter to Animation

```ts
import { Image } from "jsr:@cross/image";

const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Apply grayscale to all frames
const filteredFrames = multiFrame.frames.map((frame) => {
  const image = Image.fromRGBA(frame.width, frame.height, frame.data);
  image.grayscale();

  return {
    width: frame.width,
    height: frame.height,
    data: image.data,
    frameMetadata: frame.frameMetadata,
  };
});

// Create filtered animation
const filtered = {
  width: multiFrame.width,
  height: multiFrame.height,
  frames: filteredFrames,
};

const output = await Image.encodeFrames("gif", filtered);
await Deno.writeFile("grayscale.gif", output);
```

### Adjust Frame Delays

```ts
import { Image } from "jsr:@cross/image";

const gifData = await Deno.readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

// Double all frame delays (slow down)
const slowedFrames = multiFrame.frames.map((frame) => ({
  ...frame,
  frameMetadata: {
    ...frame.frameMetadata,
    delay: (frame.frameMetadata?.delay || 100) * 2,
  },
}));

// Create slowed animation
const slowed = {
  width: multiFrame.width,
  height: multiFrame.height,
  frames: slowedFrames,
};

const output = await Image.encodeFrames("gif", slowed);
await Deno.writeFile("slowed.gif", output);
```

## Batch Processing

### Convert Multiple GIFs

```ts
import { Image } from "jsr:@cross/image";

const files = ["anim1.gif", "anim2.gif", "anim3.gif"];

for (const file of files) {
  const gifData = await Deno.readFile(file);
  const multiFrame = await Image.decodeFrames(gifData);

  // Convert to APNG
  const apngData = await Image.encodeFrames("apng", multiFrame);
  const outputFile = file.replace(".gif", ".png");
  await Deno.writeFile(outputFile, apngData);

  console.log(`Converted ${file} to ${outputFile}`);
}
```

### Extract First Frames

```ts
import { Image } from "jsr:@cross/image";

const files = ["anim1.gif", "anim2.gif", "anim3.gif"];

for (const file of files) {
  const gifData = await Deno.readFile(file);
  const multiFrame = await Image.decodeFrames(gifData);

  // Extract first frame
  const frame = multiFrame.frames[0];
  const image = Image.fromRGBA(frame.width, frame.height, frame.data);

  const outputFile = file.replace(".gif", "-thumb.png");
  await Deno.writeFile(outputFile, await image.encode("png"));

  console.log(`Extracted thumbnail from ${file}`);
}
```

## Node.js Examples

### Decode GIF in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "cross-image";

const gifData = await readFile("animated.gif");
const multiFrame = await Image.decodeFrames(gifData);

console.log(`Frames: ${multiFrame.frames.length}`);

// Extract first frame
const frame = multiFrame.frames[0];
const image = Image.fromRGBA(frame.width, frame.height, frame.data);

const pngData = await image.encode("png");
await writeFile("first-frame.png", pngData);
```

### Create TIFF in Node.js

```ts
import { readFile, writeFile } from "node:fs/promises";
import { Image } from "cross-image";

const page1Data = await readFile("page1.png");
const page1 = await Image.decode(page1Data);

const page2Data = await readFile("page2.png");
const page2 = await Image.decode(page2Data);

const multiPage = {
  width: page1.width,
  height: page1.height,
  frames: [
    { width: page1.width, height: page1.height, data: page1.data },
    { width: page2.width, height: page2.height, data: page2.data },
  ],
};

const tiffData = await Image.encodeFrames("tiff", multiPage, {
  compression: "lzw",
});
await writeFile("document.tiff", tiffData);
```

## Bun Examples

### Process GIF in Bun

```ts
import { Image } from "cross-image";

const file = Bun.file("animated.gif");
const gifData = new Uint8Array(await file.arrayBuffer());
const multiFrame = await Image.decodeFrames(gifData);

console.log(`Frames: ${multiFrame.frames.length}`);

// Convert to APNG
const apngData = await Image.encodeFrames("apng", multiFrame);
await Bun.write("animated.png", apngData);
```
