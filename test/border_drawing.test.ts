import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";

test("Image: border - adds uniform border to image", () => {
  // Create a 2x2 red image
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // red
    255,
    0,
    0,
    255, // red
    255,
    0,
    0,
    255, // red
    255,
    0,
    0,
    255, // red
  ]);

  const image = Image.fromRGBA(2, 2, data);

  // Add a 1-pixel black border
  image.border(1, 0, 0, 0, 255);

  // Image should now be 4x4 (2 + 1*2)
  assertEquals(image.width, 4);
  assertEquals(image.height, 4);

  // Check corners are black (border)
  const topLeft = image.getPixel(0, 0);
  assertEquals(topLeft, { r: 0, g: 0, b: 0, a: 255 });

  const topRight = image.getPixel(3, 0);
  assertEquals(topRight, { r: 0, g: 0, b: 0, a: 255 });

  const bottomLeft = image.getPixel(0, 3);
  assertEquals(bottomLeft, { r: 0, g: 0, b: 0, a: 255 });

  const bottomRight = image.getPixel(3, 3);
  assertEquals(bottomRight, { r: 0, g: 0, b: 0, a: 255 });

  // Check center is still red (original image)
  const center = image.getPixel(1, 1);
  assertEquals(center, { r: 255, g: 0, b: 0, a: 255 });
});

test("Image: border - adds colored border", () => {
  const image = Image.create(2, 2, 255, 255, 255, 255); // white

  // Add a 2-pixel blue border
  image.border(2, 0, 0, 255, 255);

  assertEquals(image.width, 6);
  assertEquals(image.height, 6);

  // Check border is blue
  const topLeft = image.getPixel(0, 0);
  assertEquals(topLeft, { r: 0, g: 0, b: 255, a: 255 });

  const topCenter = image.getPixel(3, 0);
  assertEquals(topCenter, { r: 0, g: 0, b: 255, a: 255 });

  // Check original image is still white
  const center = image.getPixel(3, 3);
  assertEquals(center, { r: 255, g: 255, b: 255, a: 255 });
});

test("Image: border - adds transparent border", () => {
  const image = Image.create(2, 2, 255, 0, 0, 255); // red

  // Add a 1-pixel transparent border
  image.border(1, 0, 0, 0, 0);

  assertEquals(image.width, 4);
  assertEquals(image.height, 4);

  // Check border is transparent
  const topLeft = image.getPixel(0, 0);
  assertEquals(topLeft, { r: 0, g: 0, b: 0, a: 0 });

  // Check original image is still red
  const center = image.getPixel(1, 1);
  assertEquals(center, { r: 255, g: 0, b: 0, a: 255 });
});

test("Image: borderSides - adds different border widths per side", () => {
  const image = Image.create(2, 2, 255, 0, 0, 255); // red

  // Add borders: top=1, right=2, bottom=3, left=4
  image.borderSides(1, 2, 3, 4, 0, 255, 0, 255); // green border

  // Width: 2 + 4 (left) + 2 (right) = 8
  // Height: 2 + 1 (top) + 3 (bottom) = 6
  assertEquals(image.width, 8);
  assertEquals(image.height, 6);

  // Check top border (1 pixel)
  const top = image.getPixel(4, 0);
  assertEquals(top, { r: 0, g: 255, b: 0, a: 255 });

  // Check left border (4 pixels)
  const left = image.getPixel(0, 2);
  assertEquals(left, { r: 0, g: 255, b: 0, a: 255 });

  // Check original image position (offset by left=4, top=1)
  const original = image.getPixel(4, 1);
  assertEquals(original, { r: 255, g: 0, b: 0, a: 255 });
});

test("Image: borderSides - preserves metadata", () => {
  const image = Image.create(100, 100, 255, 255, 255, 255);
  image.setDPI(72);

  const originalDpiX = image.metadata?.dpiX;
  const originalDpiY = image.metadata?.dpiY;

  image.borderSides(10, 10, 10, 10, 0, 0, 0, 255);

  assertEquals(image.metadata?.dpiX, originalDpiX);
  assertEquals(image.metadata?.dpiY, originalDpiY);
  // Physical dimensions should be updated
  assertEquals(image.metadata?.physicalWidth, 120 / 72);
  assertEquals(image.metadata?.physicalHeight, 120 / 72);
});

test("Image: drawLine - draws horizontal line", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw a red horizontal line from (2, 5) to (7, 5)
  image.drawLine(2, 5, 7, 5, 255, 0, 0, 255);

  // Check pixels on the line
  for (let x = 2; x <= 7; x++) {
    const pixel = image.getPixel(x, 5);
    assertEquals(pixel, { r: 255, g: 0, b: 0, a: 255 }, `Pixel at (${x}, 5)`);
  }

  // Check pixels not on the line are still white
  const above = image.getPixel(5, 4);
  assertEquals(above, { r: 255, g: 255, b: 255, a: 255 });

  const below = image.getPixel(5, 6);
  assertEquals(below, { r: 255, g: 255, b: 255, a: 255 });
});

test("Image: drawLine - draws vertical line", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw a blue vertical line from (5, 2) to (5, 7)
  image.drawLine(5, 2, 5, 7, 0, 0, 255, 255);

  // Check pixels on the line
  for (let y = 2; y <= 7; y++) {
    const pixel = image.getPixel(5, y);
    assertEquals(pixel, { r: 0, g: 0, b: 255, a: 255 }, `Pixel at (5, ${y})`);
  }

  // Check pixels not on the line are still white
  const left = image.getPixel(4, 5);
  assertEquals(left, { r: 255, g: 255, b: 255, a: 255 });

  const right = image.getPixel(6, 5);
  assertEquals(right, { r: 255, g: 255, b: 255, a: 255 });
});

test("Image: drawLine - draws diagonal line", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw a green diagonal line from (2, 2) to (7, 7)
  image.drawLine(2, 2, 7, 7, 0, 255, 0, 255);

  // Check some pixels on the diagonal
  const start = image.getPixel(2, 2);
  assertEquals(start, { r: 0, g: 255, b: 0, a: 255 });

  const middle = image.getPixel(4, 4);
  assertEquals(middle, { r: 0, g: 255, b: 0, a: 255 });

  const end = image.getPixel(7, 7);
  assertEquals(end, { r: 0, g: 255, b: 0, a: 255 });
});

test("Image: drawLine - handles negative direction", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw line from right to left
  image.drawLine(7, 5, 2, 5, 255, 0, 0, 255);

  // Check pixels on the line
  for (let x = 2; x <= 7; x++) {
    const pixel = image.getPixel(x, 5);
    assertEquals(pixel, { r: 255, g: 0, b: 0, a: 255 });
  }
});

test("Image: drawLine - clips to bounds", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw line that extends beyond image bounds
  image.drawLine(-5, 5, 15, 5, 255, 0, 0, 255);

  // Check that only in-bounds pixels are drawn
  const leftEdge = image.getPixel(0, 5);
  assertEquals(leftEdge, { r: 255, g: 0, b: 0, a: 255 });

  const rightEdge = image.getPixel(9, 5);
  assertEquals(rightEdge, { r: 255, g: 0, b: 0, a: 255 });
});

test("Image: drawCircle - draws circle outline", () => {
  const image = Image.create(20, 20, 255, 255, 255, 255); // white

  // Draw a red circle outline at center with radius 5
  image.drawCircle(10, 10, 5, 255, 0, 0, 255, false);

  // Check that center is still white (not filled)
  const center = image.getPixel(10, 10);
  assertEquals(center, { r: 255, g: 255, b: 255, a: 255 });

  // Check that some points on the circle are red
  const top = image.getPixel(10, 5);
  assertEquals(top, { r: 255, g: 0, b: 0, a: 255 });

  const right = image.getPixel(15, 10);
  assertEquals(right, { r: 255, g: 0, b: 0, a: 255 });

  const bottom = image.getPixel(10, 15);
  assertEquals(bottom, { r: 255, g: 0, b: 0, a: 255 });

  const left = image.getPixel(5, 10);
  assertEquals(left, { r: 255, g: 0, b: 0, a: 255 });
});

test("Image: drawCircle - draws filled circle", () => {
  const image = Image.create(20, 20, 255, 255, 255, 255); // white

  // Draw a filled blue circle at center with radius 5
  image.drawCircle(10, 10, 5, 0, 0, 255, 255, true);

  // Check that center is blue (filled)
  const center = image.getPixel(10, 10);
  assertEquals(center, { r: 0, g: 0, b: 255, a: 255 });

  // Check that edge points are blue
  const top = image.getPixel(10, 5);
  assertEquals(top, { r: 0, g: 0, b: 255, a: 255 });

  const right = image.getPixel(15, 10);
  assertEquals(right, { r: 0, g: 0, b: 255, a: 255 });

  // Check that points outside radius are still white
  const outside = image.getPixel(10, 2);
  assertEquals(outside, { r: 255, g: 255, b: 255, a: 255 });
});

test("Image: drawCircle - clips to bounds", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw a circle partially outside bounds
  image.drawCircle(5, 5, 10, 255, 0, 0, 255, true);

  // Should not throw, just clip to bounds
  const topLeft = image.getPixel(0, 0);
  assertEquals(topLeft, { r: 255, g: 0, b: 0, a: 255 });

  const center = image.getPixel(5, 5);
  assertEquals(center, { r: 255, g: 0, b: 0, a: 255 });
});

test("Image: drawCircle - draws small circle", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw a very small circle (radius 1)
  image.drawCircle(5, 5, 1, 0, 255, 0, 255, false);

  // Check that at least the center point is drawn
  const center = image.getPixel(5, 5);
  assertEquals(center?.g, 255); // Green component should be 255
});

test("Image: border and drawing - chaining operations", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Chain operations: add border, draw line, draw circle
  image
    .border(2, 0, 0, 0, 255) // black border
    .drawLine(5, 5, 10, 10, 255, 0, 0, 255) // red line
    .drawCircle(7, 7, 3, 0, 255, 0, 255, false); // green circle

  // Image should be 14x14 after border
  assertEquals(image.width, 14);
  assertEquals(image.height, 14);

  // Check border is black
  const corner = image.getPixel(0, 0);
  assertEquals(corner, { r: 0, g: 0, b: 0, a: 255 });
});

test("Image: drawLine - supports transparency", () => {
  const image = Image.create(10, 10, 255, 255, 255, 255); // white

  // Draw a semi-transparent red line
  image.drawLine(0, 5, 9, 5, 255, 0, 0, 128);

  const pixel = image.getPixel(5, 5);
  assertEquals(pixel, { r: 255, g: 0, b: 0, a: 128 });
});

test("Image: drawCircle - supports transparency", () => {
  const image = Image.create(20, 20, 255, 255, 255, 255); // white

  // Draw a semi-transparent blue circle
  image.drawCircle(10, 10, 5, 0, 0, 255, 128, true);

  const center = image.getPixel(10, 10);
  assertEquals(center, { r: 0, g: 0, b: 255, a: 128 });
});

test("Image: border - encode and decode roundtrip", async () => {
  const image = Image.create(10, 10, 255, 0, 0, 255); // red
  image.border(2, 0, 255, 0, 255); // green border

  const encoded = await image.encode("png");
  const decoded = await Image.decode(encoded);

  assertEquals(decoded.width, 14);
  assertEquals(decoded.height, 14);

  // Check border
  const corner = decoded.getPixel(0, 0);
  assertEquals(corner, { r: 0, g: 255, b: 0, a: 255 });

  // Check original image
  const center = decoded.getPixel(7, 7);
  assertEquals(center, { r: 255, g: 0, b: 0, a: 255 });
});
