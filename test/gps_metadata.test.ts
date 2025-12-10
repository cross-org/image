import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

// Test GPS metadata through public API
// Note: GPS coordinates are stored in ImageMetadata but may not be persisted
// in EXIF format currently. These tests document the expected behavior.

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
