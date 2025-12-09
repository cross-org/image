import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Image: rotate() with 90 degrees", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.rotate(90);

  assertEquals(image.width, 1);
  assertEquals(image.height, 2);
});

test("Image: rotate() with 180 degrees", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.rotate(180);

  assertEquals(image.width, 2);
  assertEquals(image.height, 1);
});

test("Image: rotate() with 270 degrees", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.rotate(270);

  assertEquals(image.width, 1);
  assertEquals(image.height, 2);
});

test("Image: rotate() with -90 degrees (counter-clockwise)", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // red
    0,
    255,
    0,
    255, // green
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.rotate(-90);

  // -90 is same as 270
  assertEquals(image.width, 1);
  assertEquals(image.height, 2);
});

test("Image: rotate() with 0 degrees (no rotation)", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  const originalData = new Uint8Array(image.data);
  image.rotate(0);

  assertEquals(image.width, 2);
  assertEquals(image.height, 1);
  assertEquals(image.data, originalData);
});

test("Image: rotate() with 360 degrees (full rotation)", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.rotate(360);

  assertEquals(image.width, 2);
  assertEquals(image.height, 1);
});

test("Image: rotate() rounds to nearest 90 degrees", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  // 44 degrees should round to 0 (nearest)
  const image1 = Image.fromRGBA(2, 1, new Uint8Array(data));
  image1.rotate(44);
  assertEquals(image1.width, 2);
  assertEquals(image1.height, 1);

  // 135 degrees should round to 180
  const image2 = Image.fromRGBA(2, 1, new Uint8Array(data));
  image2.rotate(135);
  assertEquals(image2.width, 2);
  assertEquals(image2.height, 1);

  // 46 degrees should round to 90
  const image3 = Image.fromRGBA(2, 1, new Uint8Array(data));
  image3.rotate(46);
  assertEquals(image3.width, 1);
  assertEquals(image3.height, 2);
});

test("Image: rotate() handles large angles", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  // 450 degrees = 90 degrees
  const image = Image.fromRGBA(2, 1, data);
  image.rotate(450);

  assertEquals(image.width, 1);
  assertEquals(image.height, 2);
});

test("Image: rotate() is chainable", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.rotate(90).rotate(90);

  // Two 90-degree rotations = 180 degrees
  assertEquals(image.width, 2);
  assertEquals(image.height, 1);
});

test("Image: rotate() preserves metadata", () => {
  const data = new Uint8Array([
    255,
    0,
    0,
    255,
    0,
    255,
    0,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  image.setMetadata({ title: "Test", author: "Tester" });
  image.rotate(90);

  assertEquals(image.metadata?.title, "Test");
  assertEquals(image.metadata?.author, "Tester");
});
