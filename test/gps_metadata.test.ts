import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";
import { JPEGFormat } from "../src/formats/jpeg.ts";

// Test GPS metadata through public API

test("GPS: Public API - setPosition and getPosition", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // New York City coordinates
  image.setPosition(40.7128, -74.0060);

  const position = image.getPosition();
  assertEquals(position?.latitude, 40.7128);
  assertEquals(position?.longitude, -74.0060);
});

test("GPS: Public API - getPosition returns undefined when not set", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  const position = image.getPosition();
  assertEquals(position, undefined);
});

test("GPS: Public API - setPosition is chainable", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Chain setPosition
  image
    .setPosition(51.5074, -0.1278) // London
    .setMetadata({ title: "London Photo" });

  assertEquals(image.getPosition()?.latitude, 51.5074);
  assertEquals(image.getPosition()?.longitude, -0.1278);
  assertEquals(image.metadata?.title, "London Photo");
});

test("GPS: Public API - various coordinate values", () => {
  const data = new Uint8Array([255, 0, 0, 255]);

  const testCases = [
    { lat: 0, lon: 0, name: "Null Island" },
    { lat: 90, lon: 0, name: "North Pole" },
    { lat: -90, lon: 0, name: "South Pole" },
    { lat: 35.6762, lon: 139.6503, name: "Tokyo" },
    { lat: -33.8688, lon: 151.2093, name: "Sydney" },
  ];

  for (const testCase of testCases) {
    const image = Image.fromRGBA(1, 1, data);
    image.setPosition(testCase.lat, testCase.lon);

    const pos = image.getPosition();
    assertEquals(pos?.latitude, testCase.lat, `Latitude for ${testCase.name}`);
    assertEquals(
      pos?.longitude,
      testCase.lon,
      `Longitude for ${testCase.name}`,
    );
  }
});

test("GPS: Metadata - coordinates via setMetadata", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  image.setMetadata({
    latitude: 48.8566,
    longitude: 2.3522,
  });

  const position = image.getPosition();
  assertEquals(position?.latitude, 48.8566);
  assertEquals(position?.longitude, 2.3522);
});

test("GPS: Metadata - partial coordinates (only latitude)", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  image.setMetadata({
    latitude: 40.7128,
    // No longitude
  });

  // getPosition should return undefined if either is missing
  const position = image.getPosition();
  assertEquals(position, undefined);
});

test("GPS: Metadata - partial coordinates (only longitude)", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  image.setMetadata({
    longitude: -74.0060,
    // No latitude
  });

  // getPosition should return undefined if either is missing
  const position = image.getPosition();
  assertEquals(position, undefined);
});

test("GPS: Metadata - preserved during clone", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const original = Image.fromRGBA(1, 1, data);

  original.setPosition(37.7749, -122.4194); // San Francisco

  const cloned = original.clone();

  const originalPos = original.getPosition();
  const clonedPos = cloned.getPosition();

  assertEquals(originalPos?.latitude, 37.7749);
  assertEquals(originalPos?.longitude, -122.4194);
  assertEquals(clonedPos?.latitude, 37.7749);
  assertEquals(clonedPos?.longitude, -122.4194);

  // Modifying clone shouldn't affect original
  cloned.setPosition(0, 0);
  assertEquals(original.getPosition()?.latitude, 37.7749);
  assertEquals(cloned.getPosition()?.latitude, 0);
});

test("GPS: Metadata - high precision coordinates", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Test with high precision (many decimal places)
  const lat = 40.712776;
  const lon = -74.005974;

  image.setPosition(lat, lon);

  const position = image.getPosition();
  assertEquals(position?.latitude, lat);
  assertEquals(position?.longitude, lon);
});

test("GPS: Metadata - coordinates with other metadata fields", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  image.setMetadata({
    latitude: 34.0522,
    longitude: -118.2437,
    title: "Los Angeles",
    author: "Test Photographer",
    creationDate: new Date("2024-06-15"),
  });

  const position = image.getPosition();
  assertEquals(position?.latitude, 34.0522);
  assertEquals(position?.longitude, -118.2437);
  assertEquals(image.metadata?.title, "Los Angeles");
  assertEquals(image.metadata?.author, "Test Photographer");
});

test("GPS: Metadata - update position after initial set", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Set initial position
  image.setPosition(40.7128, -74.0060);
  assertEquals(image.getPosition()?.latitude, 40.7128);

  // Update position
  image.setPosition(51.5074, -0.1278);
  assertEquals(image.getPosition()?.latitude, 51.5074);
  assertEquals(image.getPosition()?.longitude, -0.1278);
});

test("GPS: Metadata - negative coordinates", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  // Negative latitude (Southern hemisphere) and longitude (Western hemisphere)
  image.setPosition(-34.6037, -58.3816); // Buenos Aires

  const position = image.getPosition();
  assertEquals(position?.latitude, -34.6037);
  assertEquals(position?.longitude, -58.3816);
});

// GPS Persistence Tests

test("GPS: JPEG - roundtrip GPS coordinates", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(128),
    metadata: {
      latitude: 40.7128,
      longitude: -74.0060,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // GPS coordinates should be preserved
  assertEquals(decoded.metadata?.latitude, 40.7128);
  assertEquals(decoded.metadata?.longitude, -74.0060);
});

test("GPS: JPEG - roundtrip with various coordinates", async () => {
  const format = new JPEGFormat();

  const testCases = [
    { lat: 0, lon: 0, name: "Null Island" },
    { lat: 90, lon: 0, name: "North Pole" },
    { lat: -90, lon: 0, name: "South Pole" },
    { lat: 35.6762, lon: 139.6503, name: "Tokyo" },
    { lat: -33.8688, lon: 151.2093, name: "Sydney" },
    { lat: 51.5074, lon: -0.1278, name: "London" },
  ];

  for (const testCase of testCases) {
    const imageData = {
      width: 10,
      height: 10,
      data: new Uint8Array(10 * 10 * 4).fill(100),
      metadata: {
        latitude: testCase.lat,
        longitude: testCase.lon,
      },
    };

    const encoded = await format.encode(imageData);
    const decoded = await format.decode(encoded);

    const latDiff = Math.abs((decoded.metadata?.latitude ?? 0) - testCase.lat);
    const lonDiff = Math.abs((decoded.metadata?.longitude ?? 0) - testCase.lon);

    // Allow small rounding error due to DMS conversion
    assertEquals(
      latDiff < 0.001,
      true,
      `${testCase.name} latitude: expected ${testCase.lat}, got ${decoded.metadata?.latitude}`,
    );
    assertEquals(
      lonDiff < 0.001,
      true,
      `${testCase.name} longitude: expected ${testCase.lon}, got ${decoded.metadata?.longitude}`,
    );
  }
});

test("GPS: JPEG - GPS with other metadata", async () => {
  const format = new JPEGFormat();
  const testDate = new Date("2024-06-15T10:30:00");

  const imageData = {
    width: 32,
    height: 32,
    data: new Uint8Array(32 * 32 * 4).fill(150),
    metadata: {
      latitude: 48.8566,
      longitude: 2.3522,
      author: "Test Photographer",
      description: "Photo from Paris",
      copyright: "© 2024",
      creationDate: testDate,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // All metadata should be preserved (with tolerance for GPS coordinates)
  const latDiff = Math.abs((decoded.metadata?.latitude ?? 0) - 48.8566);
  const lonDiff = Math.abs((decoded.metadata?.longitude ?? 0) - 2.3522);
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
  assertEquals(decoded.metadata?.author, "Test Photographer");
  assertEquals(decoded.metadata?.description, "Photo from Paris");
  assertEquals(decoded.metadata?.copyright, "© 2024");
  assertEquals(decoded.metadata?.creationDate?.getFullYear(), 2024);
});

test("GPS: JPEG via Image API - roundtrip", async () => {
  const data = new Uint8Array(64 * 64 * 4).fill(200);
  const image = Image.fromRGBA(64, 64, data);

  image.setPosition(37.7749, -122.4194); // San Francisco
  image.setMetadata({
    author: "Test Author",
    title: "SF Photo",
  });

  // Save as JPEG
  const encoded = await image.save("jpeg");

  // Load and verify
  const loaded = await Image.read(encoded);

  const position = loaded.getPosition();
  const latDiff = Math.abs((position?.latitude ?? 0) - 37.7749);
  const lonDiff = Math.abs((position?.longitude ?? 0) - (-122.4194));
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
  assertEquals(loaded.metadata?.author, "Test Author");
});

test("GPS: JPEG - only GPS metadata", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 16,
    height: 16,
    data: new Uint8Array(16 * 16 * 4).fill(100),
    metadata: {
      latitude: 34.0522,
      longitude: -118.2437,
      // No other metadata
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  const latDiff = Math.abs((decoded.metadata?.latitude ?? 0) - 34.0522);
  const lonDiff = Math.abs((decoded.metadata?.longitude ?? 0) - (-118.2437));
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
  assertEquals(decoded.metadata?.author, undefined);
  assertEquals(decoded.metadata?.description, undefined);
});

test("GPS: JPEG - high precision coordinates", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 10,
    height: 10,
    data: new Uint8Array(10 * 10 * 4).fill(128),
    metadata: {
      latitude: 51.5074123456,
      longitude: -0.1277583456,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // High precision should be preserved (within reasonable tolerance)
  const latDiff = Math.abs((decoded.metadata?.latitude ?? 0) - 51.5074123456);
  const lonDiff = Math.abs(
    (decoded.metadata?.longitude ?? 0) - (-0.1277583456),
  );

  // GPS uses microsecond precision which is about 6 decimal places
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
});

// PNG GPS tests

test("GPS: PNG - roundtrip GPS coordinates", async () => {
  const PNGFormat = (await import("../src/formats/png.ts")).PNGFormat;
  const format = new PNGFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(128),
    metadata: {
      latitude: 40.7128,
      longitude: -74.0060,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // GPS coordinates should be preserved
  const latDiff = Math.abs((decoded.metadata?.latitude ?? 0) - 40.7128);
  const lonDiff = Math.abs((decoded.metadata?.longitude ?? 0) - (-74.0060));
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
});

test("GPS: PNG via Image API - roundtrip", async () => {
  const data = new Uint8Array(64 * 64 * 4).fill(200);
  const image = Image.fromRGBA(64, 64, data);

  image.setPosition(35.6762, 139.6503); // Tokyo
  image.setMetadata({
    creationDate: new Date("2024-01-01"),
  });

  // Save as PNG
  const encoded = await image.save("png");

  // Load and verify
  const loaded = await Image.read(encoded);

  const position = loaded.getPosition();
  const latDiff = Math.abs((position?.latitude ?? 0) - 35.6762);
  const lonDiff = Math.abs((position?.longitude ?? 0) - 139.6503);
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
});

// WebP GPS tests

test("GPS: WebP - roundtrip GPS coordinates", async () => {
  const WebPFormat = (await import("../src/formats/webp.ts")).WebPFormat;
  const format = new WebPFormat();

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(128),
    metadata: {
      latitude: -33.8688,
      longitude: 151.2093,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // GPS coordinates should be preserved
  const latDiff = Math.abs((decoded.metadata?.latitude ?? 0) - (-33.8688));
  const lonDiff = Math.abs((decoded.metadata?.longitude ?? 0) - 151.2093);
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
});

test("GPS: WebP via Image API - roundtrip", async () => {
  const data = new Uint8Array(64 * 64 * 4).fill(200);
  const image = Image.fromRGBA(64, 64, data);

  image.setPosition(51.5074, -0.1278); // London
  image.setMetadata({
    creationDate: new Date("2024-06-15"),
    title: "London Photo",
  });

  // Save as WebP
  const encoded = await image.save("webp");

  // Load and verify
  const loaded = await Image.read(encoded);

  const position = loaded.getPosition();
  const latDiff = Math.abs((position?.latitude ?? 0) - 51.5074);
  const lonDiff = Math.abs((position?.longitude ?? 0) - (-0.1278));
  assertEquals(latDiff < 0.000001, true);
  assertEquals(lonDiff < 0.000001, true);
  assertEquals(loaded.metadata?.title, "London Photo");
});
