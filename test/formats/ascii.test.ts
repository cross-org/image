import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { ASCIIFormat } from "../../src/formats/ascii.ts";
import { Image } from "../../src/image.ts";

test("ASCII: canDecode - valid ASCII signature", () => {
  const data = new TextEncoder().encode("ASCII\nwidth:80\nhello");
  const format = new ASCIIFormat();
  assertEquals(format.canDecode(data), true);
});

test("ASCII: canDecode - invalid signature", () => {
  const data = new TextEncoder().encode("NOTASCII\nwidth:80\nhello");
  const format = new ASCIIFormat();
  assertEquals(format.canDecode(data), false);
});

test("ASCII: canDecode - too short", () => {
  const data = new TextEncoder().encode("ASC");
  const format = new ASCIIFormat();
  assertEquals(format.canDecode(data), false);
});

test("ASCII: encode - simple charset with default options", async () => {
  // Create a 2x2 image with gradient (black to white)
  const data = new Uint8Array([
    0,
    0,
    0,
    255, // black
    85,
    85,
    85,
    255, // dark gray
    170,
    170,
    170,
    255, // light gray
    255,
    255,
    255,
    255, // white
  ]);

  const image = Image.fromRGBA(2, 2, data);
  const encoded = await image.save("ascii");
  const text = new TextDecoder().decode(encoded);

  // Should start with magic bytes
  assertEquals(text.startsWith("ASCII\n"), true);

  // Should contain options line
  assertEquals(text.includes("width:80"), true);
  assertEquals(text.includes("charset:simple"), true);

  // Should contain ASCII art
  const lines = text.split("\n");
  assertEquals(lines.length >= 3, true); // magic + options + at least 1 art line
});

test("ASCII: encode - with custom width", async () => {
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
  const encoded = await image.save("ascii", { width: 10 });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.includes("width:10"), true);
});

test("ASCII: encode - extended charset", async () => {
  const data = new Uint8Array([
    0,
    0,
    0,
    255,
    255,
    255,
    255,
    255,
  ]);

  const image = Image.fromRGBA(2, 1, data);
  const encoded = await image.save("ascii", { charset: "extended", width: 20 });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.includes("charset:extended"), true);
});

test("ASCII: encode - blocks charset", async () => {
  const data = new Uint8Array([
    0,
    0,
    0,
    255,
    64,
    64,
    64,
    255,
    128,
    128,
    128,
    255,
    192,
    192,
    192,
    255,
    255,
    255,
    255,
    255,
  ]);

  const image = Image.fromRGBA(5, 1, data);
  const encoded = await image.save("ascii", { charset: "blocks", width: 20 });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.includes("charset:blocks"), true);
  // Should contain block characters
  const hasBlocks = text.includes("░") || text.includes("▒") ||
    text.includes("▓") || text.includes("█");
  assertEquals(hasBlocks, true);
});

test("ASCII: encode - detailed charset", async () => {
  const data = new Uint8Array([
    0,
    0,
    0,
    255,
    128,
    128,
    128,
    255,
    255,
    255,
    255,
    255,
  ]);

  const image = Image.fromRGBA(3, 1, data);
  const encoded = await image.save("ascii", {
    charset: "detailed",
    width: 15,
  });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.includes("charset:detailed"), true);
});

test("ASCII: encode - inverted brightness", async () => {
  const data = new Uint8Array([
    0,
    0,
    0,
    255, // black
    255,
    255,
    255,
    255, // white
  ]);

  const image = Image.fromRGBA(2, 1, data);
  const encoded = await image.save("ascii", { invert: true, width: 10 });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.includes("invert:true"), true);
});

test("ASCII: encode - custom aspect ratio", async () => {
  const data = new Uint8Array([
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
  ]);

  const image = Image.fromRGBA(2, 2, data);
  const encoded = await image.save("ascii", { aspectRatio: 1.0, width: 10 });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.includes("aspectRatio:1"), true);
});

test("ASCII: decode - simple ASCII art", async () => {
  const content = `ASCII
width:4 charset:simple aspectRatio:0.5 invert:false
 .:#
@#:.`;

  const data = new TextEncoder().encode(content);
  const format = new ASCIIFormat();
  const imageData = await format.decode(data);

  // Should decode to a 4x2 image
  assertEquals(imageData.width, 4);
  assertEquals(imageData.height, 2);

  // Should have RGBA data
  assertEquals(imageData.data.length, 4 * 2 * 4);

  // First pixel should be darkest (space)
  const firstPixel = imageData.data[0];
  // Last pixel on first line should be brightest (#)
  const brightPixel = imageData.data[(3) * 4];

  assertEquals(firstPixel < brightPixel, true);
});

test("ASCII: decode - with inverted brightness", async () => {
  const content = `ASCII
width:2 charset:simple aspectRatio:0.5 invert:true
 @
@ `;

  const data = new TextEncoder().encode(content);
  const format = new ASCIIFormat();
  const imageData = await format.decode(data);

  assertEquals(imageData.width, 2);
  assertEquals(imageData.height, 2);

  // With invert:true, space should be brighter than @
  const spacePixel = imageData.data[0]; // First char is space
  const atPixel = imageData.data[4]; // Second char is @

  assertEquals(spacePixel > atPixel, true);
});

test("ASCII: encode and decode roundtrip", async () => {
  // Create a simple gradient image
  const data = new Uint8Array([
    0,
    0,
    0,
    255,
    85,
    85,
    85,
    255,
    170,
    170,
    170,
    255,
    255,
    255,
    255,
    255,
  ]);

  const original = Image.fromRGBA(4, 1, data);

  // Encode to ASCII
  const encoded = await original.save("ascii", { width: 8, charset: "simple" });

  // Decode back
  const decoded = await Image.read(encoded, "ascii");

  // Width should match or be close
  assertEquals(decoded.width >= 4, true);
  assertEquals(decoded.height >= 1, true);

  // Should have valid RGBA data
  assertEquals(decoded.data.length, decoded.width * decoded.height * 4);
});

test("ASCII: decode - invalid format throws", async () => {
  const data = new TextEncoder().encode("NOTASCII\ngarbage");
  const format = new ASCIIFormat();

  try {
    await format.decode(data);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Invalid ASCII art"), true);
  }
});

test("ASCII: decode - empty content throws", async () => {
  const content = `ASCII
width:10 charset:simple aspectRatio:0.5 invert:false
`;

  const data = new TextEncoder().encode(content);
  const format = new ASCIIFormat();

  try {
    await format.decode(data);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("No ASCII art content"), true);
  }
});

test("ASCII: properties", () => {
  const format = new ASCIIFormat();
  assertEquals(format.name, "ascii");
  assertEquals(format.mimeType, "text/plain");
});

test("ASCII: grayscale conversion from RGB", async () => {
  // Create image with known RGB values
  const data = new Uint8Array([
    255,
    0,
    0,
    255, // pure red
    0,
    255,
    0,
    255, // pure green
    0,
    0,
    255,
    255, // pure blue
  ]);

  const image = Image.fromRGBA(3, 1, data);
  const encoded = await image.save("ascii", { width: 6, charset: "simple" });
  const text = new TextDecoder().decode(encoded);

  // Should produce ASCII art
  const lines = text.split("\n");
  const artLine = lines[lines.length - 1]; // Last line should be the art

  // Green should be brightest in grayscale (0.587 weight)
  // Red should be medium (0.299 weight)
  // Blue should be darkest (0.114 weight)
  assertEquals(artLine.length >= 3, true);
});

test("ASCII: encode - aspect ratio affects height", async () => {
  // Create a square image
  const data = new Uint8Array(100 * 100 * 4).fill(128);
  const image = Image.fromRGBA(100, 100, data);

  // Encode with different aspect ratios
  const encoded1 = await image.save("ascii", {
    width: 40,
    aspectRatio: 0.5,
  });
  const encoded2 = await image.save("ascii", { width: 40, aspectRatio: 1.0 });

  const text1 = new TextDecoder().decode(encoded1);
  const text2 = new TextDecoder().decode(encoded2);

  const lines1 = text1.split("\n").filter((l) => l.length > 0);
  const lines2 = text2.split("\n").filter((l) => l.length > 0);

  // Higher aspect ratio should produce more lines
  assertEquals(lines2.length > lines1.length, true);
});

test("ASCII: decode - handles unknown characters", async () => {
  const content = `ASCII
width:5 charset:simple aspectRatio:0.5 invert:false
!?*XY
abcde`;

  const data = new TextEncoder().encode(content);
  const format = new ASCIIFormat();
  const imageData = await format.decode(data);

  // Should not throw and produce a valid image
  assertEquals(imageData.width, 5);
  assertEquals(imageData.height, 2);
  assertEquals(imageData.data.length, 5 * 2 * 4);
});

test("ASCII: encode - single pixel image", async () => {
  const data = new Uint8Array([128, 128, 128, 255]);
  const image = Image.fromRGBA(1, 1, data);

  const encoded = await image.save("ascii", { width: 5 });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.startsWith("ASCII\n"), true);
  const lines = text.split("\n");
  assertEquals(lines.length >= 3, true);
});

test("ASCII: encode - large image", async () => {
  // Create a 200x200 gradient image
  const data = new Uint8Array(200 * 200 * 4);
  for (let i = 0; i < 200 * 200; i++) {
    const gray = Math.floor((i / (200 * 200)) * 255);
    data[i * 4] = gray;
    data[i * 4 + 1] = gray;
    data[i * 4 + 2] = gray;
    data[i * 4 + 3] = 255;
  }

  const image = Image.fromRGBA(200, 200, data);
  const encoded = await image.save("ascii", { width: 100 });
  const text = new TextDecoder().decode(encoded);

  assertEquals(text.startsWith("ASCII\n"), true);
  assertEquals(text.includes("width:100"), true);

  // Should have many lines
  const lines = text.split("\n");
  assertEquals(lines.length > 10, true);
});
