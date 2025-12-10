import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";
import { JPEGFormat } from "../src/formats/jpeg.ts";

// Test camera metadata fields

test("Camera Metadata: JPEG - roundtrip camera settings", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(128),
    metadata: {
      cameraMake: "Canon",
      cameraModel: "EOS 5D Mark IV",
      iso: 1600,
      exposureTime: 0.0125, // 1/80s
      fNumber: 2.8,
      focalLength: 50,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.cameraMake, "Canon");
  assertEquals(decoded.metadata?.cameraModel, "EOS 5D Mark IV");
  assertEquals(decoded.metadata?.iso, 1600);

  // Allow small tolerance for rational conversions
  const expDiff = Math.abs((decoded.metadata?.exposureTime ?? 0) - 0.0125);
  assertEquals(expDiff < 0.0001, true);

  const fNumDiff = Math.abs((decoded.metadata?.fNumber ?? 0) - 2.8);
  assertEquals(fNumDiff < 0.01, true);

  const focalDiff = Math.abs((decoded.metadata?.focalLength ?? 0) - 50);
  assertEquals(focalDiff < 0.01, true);
});

test("Camera Metadata: JPEG - roundtrip lens information", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(128),
    metadata: {
      lensMake: "Canon",
      lensModel: "EF 50mm f/1.8 STM",
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.lensMake, "Canon");
  assertEquals(decoded.metadata?.lensModel, "EF 50mm f/1.8 STM");
});

test("Camera Metadata: JPEG - roundtrip flash and white balance", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(128),
    metadata: {
      flash: 1,
      whiteBalance: 0,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.flash, 1);
  assertEquals(decoded.metadata?.whiteBalance, 0);
});

test("Camera Metadata: JPEG - orientation", async () => {
  const format = new JPEGFormat();

  const testCases = [1, 3, 6, 8]; // Normal, 180°, 90° CW, 90° CCW

  for (const orientation of testCases) {
    const imageData = {
      width: 50,
      height: 50,
      data: new Uint8Array(50 * 50 * 4).fill(128),
      metadata: {
        orientation,
      },
    };

    const encoded = await format.encode(imageData);
    const decoded = await format.decode(encoded);

    assertEquals(decoded.metadata?.orientation, orientation);
  }
});

test("Camera Metadata: JPEG - software and user comment", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(128),
    metadata: {
      software: "Adobe Lightroom Classic 12.0",
      userComment: "Beautiful sunset at the beach 🌅",
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.software, "Adobe Lightroom Classic 12.0");
  assertEquals(
    decoded.metadata?.userComment,
    "Beautiful sunset at the beach 🌅",
  );
});

test("Camera Metadata: JPEG - combined metadata", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 4).fill(200),
    metadata: {
      // Camera settings
      cameraMake: "Nikon",
      cameraModel: "D850",
      lensMake: "Nikon",
      lensModel: "AF-S NIKKOR 24-70mm f/2.8E ED VR",
      iso: 400,
      exposureTime: 0.004, // 1/250s
      fNumber: 5.6,
      focalLength: 35,
      flash: 0,
      whiteBalance: 1,
      orientation: 1,
      software: "Capture One",
      userComment: "Test shot",
      // Basic metadata
      author: "John Photographer",
      copyright: "© 2024 John Doe",
      description: "Camera metadata test",
      creationDate: new Date("2024-06-15T14:30:00"),
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // Camera settings
  assertEquals(decoded.metadata?.cameraMake, "Nikon");
  assertEquals(decoded.metadata?.cameraModel, "D850");
  assertEquals(decoded.metadata?.lensMake, "Nikon");
  assertEquals(decoded.metadata?.lensModel, "AF-S NIKKOR 24-70mm f/2.8E ED VR");
  assertEquals(decoded.metadata?.iso, 400);
  assertEquals(decoded.metadata?.flash, 0);
  assertEquals(decoded.metadata?.whiteBalance, 1);
  assertEquals(decoded.metadata?.orientation, 1);
  assertEquals(decoded.metadata?.software, "Capture One");
  assertEquals(decoded.metadata?.userComment, "Test shot");

  // Basic metadata
  assertEquals(decoded.metadata?.author, "John Photographer");
  assertEquals(decoded.metadata?.copyright, "© 2024 John Doe");
  assertEquals(decoded.metadata?.description, "Camera metadata test");
  assertEquals(decoded.metadata?.creationDate?.getFullYear(), 2024);
});

test("Camera Metadata: JPEG via Image API", async () => {
  const data = new Uint8Array(64 * 64 * 4).fill(150);
  const image = Image.fromRGBA(64, 64, data);

  image.setMetadata({
    cameraMake: "Sony",
    cameraModel: "A7 III",
    iso: 800,
    exposureTime: 0.02, // 1/50s
    fNumber: 4,
    focalLength: 85,
  });

  const encoded = await image.save("jpeg");
  const loaded = await Image.read(encoded);

  assertEquals(loaded.metadata?.cameraMake, "Sony");
  assertEquals(loaded.metadata?.cameraModel, "A7 III");
  assertEquals(loaded.metadata?.iso, 800);

  const expDiff = Math.abs((loaded.metadata?.exposureTime ?? 0) - 0.02);
  assertEquals(expDiff < 0.0001, true);
});

test("Camera Metadata: getSupportedMetadata - JPEG", () => {
  const supported = Image.getSupportedMetadata("jpeg");

  assertEquals(supported?.includes("cameraMake"), true);
  assertEquals(supported?.includes("cameraModel"), true);
  assertEquals(supported?.includes("iso"), true);
  assertEquals(supported?.includes("exposureTime"), true);
  assertEquals(supported?.includes("fNumber"), true);
  assertEquals(supported?.includes("focalLength"), true);
  assertEquals(supported?.includes("flash"), true);
  assertEquals(supported?.includes("whiteBalance"), true);
  assertEquals(supported?.includes("lensMake"), true);
  assertEquals(supported?.includes("lensModel"), true);
  assertEquals(supported?.includes("orientation"), true);
  assertEquals(supported?.includes("software"), true);
  assertEquals(supported?.includes("userComment"), true);
});

test("Camera Metadata: getSupportedMetadata - PNG", () => {
  const supported = Image.getSupportedMetadata("png");

  // PNG doesn't support camera metadata in EXIF
  assertEquals(supported?.includes("cameraMake"), false);
  assertEquals(supported?.includes("iso"), false);

  // But it supports basic metadata
  assertEquals(supported?.includes("creationDate"), true);
  assertEquals(supported?.includes("latitude"), true);
  assertEquals(supported?.includes("longitude"), true);
});

test("Camera Metadata: getSupportedMetadata - WebP", () => {
  const supported = Image.getSupportedMetadata("webp");

  // WebP doesn't support camera metadata
  assertEquals(supported?.includes("cameraMake"), false);
  assertEquals(supported?.includes("iso"), false);

  // But it supports basic metadata via XMP and EXIF
  assertEquals(supported?.includes("creationDate"), true);
  assertEquals(supported?.includes("title"), true);
  assertEquals(supported?.includes("author"), true);
});
