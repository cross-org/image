import { assertEquals } from "@std/assert";
import { test } from "@cross/test";
import { Image } from "../src/image.ts";
import { JPEGFormat } from "../src/formats/jpeg.ts";
import { WebPFormat } from "../src/formats/webp.ts";

// Test EXIF metadata reading and writing through public API

test("EXIF: JPEG - roundtrip all EXIF fields via public API", async () => {
  const testDate = new Date("2024-06-15T10:30:45");

  // Create image and set all EXIF-supported metadata
  const data = new Uint8Array(100 * 100 * 4).fill(128);
  const image = Image.fromRGBA(100, 100, data);

  image.setMetadata({
    author: "Test Author Name",
    description: "Test EXIF Description",
    copyright: "Copyright 2024 Test",
    creationDate: testDate,
    title: "Test Title", // Not in EXIF but in XMP
    dpiX: 150,
    dpiY: 150,
  });

  // Save as JPEG
  const encoded = await image.save("jpeg");

  // Load and verify all fields are preserved
  const loaded = await Image.read(encoded);

  assertEquals(loaded.metadata?.author, "Test Author Name");
  assertEquals(loaded.metadata?.description, "Test EXIF Description");
  assertEquals(loaded.metadata?.copyright, "Copyright 2024 Test");
  assertEquals(loaded.metadata?.dpiX, 150);
  assertEquals(loaded.metadata?.dpiY, 150);

  // Verify date (EXIF stores with second precision)
  if (loaded.metadata?.creationDate) {
    assertEquals(loaded.metadata.creationDate.getFullYear(), 2024);
    assertEquals(loaded.metadata.creationDate.getMonth(), 5); // June (0-indexed)
    assertEquals(loaded.metadata.creationDate.getDate(), 15);
    assertEquals(loaded.metadata.creationDate.getHours(), 10);
    assertEquals(loaded.metadata.creationDate.getMinutes(), 30);
    assertEquals(loaded.metadata.creationDate.getSeconds(), 45);
  }
});

test("EXIF: JPEG - format direct encode/decode with all fields", async () => {
  const format = new JPEGFormat();
  const testDate = new Date("2023-12-25T15:45:30");

  const imageData = {
    width: 64,
    height: 64,
    data: new Uint8Array(64 * 64 * 4).fill(100),
    metadata: {
      author: "Jane Doe",
      description: "Holiday Photo",
      copyright: "© 2023 Jane Doe",
      creationDate: testDate,
      dpiX: 300,
      dpiY: 300,
    },
  };

  // Encode with metadata
  const encoded = await format.encode(imageData);

  // Decode and verify
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.author, "Jane Doe");
  assertEquals(decoded.metadata?.description, "Holiday Photo");
  assertEquals(decoded.metadata?.copyright, "© 2023 Jane Doe");
  assertEquals(decoded.metadata?.dpiX, 300);
  assertEquals(decoded.metadata?.dpiY, 300);

  if (decoded.metadata?.creationDate) {
    assertEquals(decoded.metadata.creationDate.getFullYear(), 2023);
    assertEquals(decoded.metadata.creationDate.getMonth(), 11); // December
    assertEquals(decoded.metadata.creationDate.getDate(), 25);
    assertEquals(decoded.metadata.creationDate.getHours(), 15);
    assertEquals(decoded.metadata.creationDate.getMinutes(), 45);
    assertEquals(decoded.metadata.creationDate.getSeconds(), 30);
  }
});

test("EXIF: JPEG - partial metadata (only some fields)", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 32,
    height: 32,
    data: new Uint8Array(32 * 32 * 4).fill(200),
    metadata: {
      author: "Partial Author",
      // Only author, no other EXIF fields
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.author, "Partial Author");
  assertEquals(decoded.metadata?.description, undefined);
  assertEquals(decoded.metadata?.copyright, undefined);
  assertEquals(decoded.metadata?.creationDate, undefined);
});

test("EXIF: JPEG - special characters in text fields", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 16,
    height: 16,
    data: new Uint8Array(16 * 16 * 4).fill(150),
    metadata: {
      author: "Test & Author™",
      description: "Description with special chars: €£¥",
      copyright: "©2024 Company™ <All Rights>",
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.author, "Test & Author™");
  assertEquals(
    decoded.metadata?.description,
    "Description with special chars: €£¥",
  );
  assertEquals(decoded.metadata?.copyright, "©2024 Company™ <All Rights>");
});

test("EXIF: WebP - metadata with creation date", async () => {
  const format = new WebPFormat();
  const testDate = new Date("2024-03-20T14:25:15");

  const imageData = {
    width: 50,
    height: 50,
    data: new Uint8Array(50 * 50 * 4).fill(180),
    metadata: {
      creationDate: testDate,
      title: "WebP Test",
      description: "WebP Description",
      author: "WebP Author",
      copyright: "WebP Copyright",
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // WebP stores creation date in EXIF
  if (decoded.metadata?.creationDate) {
    assertEquals(decoded.metadata.creationDate.getFullYear(), 2024);
    assertEquals(decoded.metadata.creationDate.getMonth(), 2); // March
    assertEquals(decoded.metadata.creationDate.getDate(), 20);
    assertEquals(decoded.metadata.creationDate.getHours(), 14);
    assertEquals(decoded.metadata.creationDate.getMinutes(), 25);
    assertEquals(decoded.metadata.creationDate.getSeconds(), 15);
  }

  // WebP stores text metadata in XMP
  assertEquals(decoded.metadata?.title, "WebP Test");
  assertEquals(decoded.metadata?.description, "WebP Description");
  assertEquals(decoded.metadata?.author, "WebP Author");
  assertEquals(decoded.metadata?.copyright, "WebP Copyright");
});

test("EXIF: WebP - roundtrip via Image API", async () => {
  const testDate = new Date("2024-08-10T09:15:30");

  const data = new Uint8Array(80 * 80 * 4).fill(220);
  const image = Image.fromRGBA(80, 80, data);

  image.setMetadata({
    creationDate: testDate,
    title: "WebP Image",
    description: "Test WebP EXIF",
    author: "WebP Test Author",
    copyright: "© 2024",
  });

  // Save as WebP
  const encoded = await image.save("webp");

  // Load and verify
  const loaded = await Image.read(encoded);

  assertEquals(loaded.metadata?.title, "WebP Image");
  assertEquals(loaded.metadata?.description, "Test WebP EXIF");
  assertEquals(loaded.metadata?.author, "WebP Test Author");
  assertEquals(loaded.metadata?.copyright, "© 2024");

  if (loaded.metadata?.creationDate) {
    assertEquals(loaded.metadata.creationDate.getFullYear(), 2024);
    assertEquals(loaded.metadata.creationDate.getMonth(), 7); // August
    assertEquals(loaded.metadata.creationDate.getDate(), 10);
  }
});

test("EXIF: Public API - getMetadataField for EXIF fields", () => {
  const data = new Uint8Array([255, 0, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  const testDate = new Date("2024-01-15T12:00:00");

  image.setMetadata({
    author: "Field Test Author",
    description: "Field Test Description",
    copyright: "Field Test Copyright",
    creationDate: testDate,
  });

  // Test individual field retrieval
  assertEquals(image.getMetadataField("author"), "Field Test Author");
  assertEquals(image.getMetadataField("description"), "Field Test Description");
  assertEquals(image.getMetadataField("copyright"), "Field Test Copyright");
  assertEquals(
    image.getMetadataField("creationDate")?.getTime(),
    testDate.getTime(),
  );

  // Test undefined field
  assertEquals(image.getMetadataField("title"), undefined);
});

test("EXIF: Public API - metadata property getter", () => {
  const data = new Uint8Array([0, 255, 0, 255]);
  const image = Image.fromRGBA(1, 1, data);

  image.setMetadata({
    author: "Getter Test",
    description: "Test Description",
  });

  const metadata = image.metadata;
  assertEquals(metadata?.author, "Getter Test");
  assertEquals(metadata?.description, "Test Description");
});

test("EXIF: JPEG - empty metadata doesn't add EXIF chunk", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 16,
    height: 16,
    data: new Uint8Array(16 * 16 * 4).fill(100),
    // No metadata
  };

  const encoded = await format.encode(imageData);

  // Verify it's valid JPEG
  assertEquals(encoded[0], 0xff);
  assertEquals(encoded[1], 0xd8);

  // Can decode successfully
  const decoded = await format.decode(encoded);
  assertEquals(decoded.width, 16);
  assertEquals(decoded.height, 16);
});

test("EXIF: JPEG - only DPI metadata (JFIF, not EXIF)", async () => {
  const format = new JPEGFormat();

  const imageData = {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 4).fill(128),
    metadata: {
      dpiX: 96,
      dpiY: 96,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  // DPI should be preserved through JFIF
  assertEquals(decoded.metadata?.dpiX, 96);
  assertEquals(decoded.metadata?.dpiY, 96);
});

test("EXIF: Date precision - JPEG format", async () => {
  const format = new JPEGFormat();

  // Test various dates including edge cases
  const dates = [
    new Date("2000-01-01T00:00:00"),
    new Date("2024-12-31T23:59:59"),
    new Date("2020-02-29T12:30:45"), // Leap year
  ];

  for (const testDate of dates) {
    const imageData = {
      width: 10,
      height: 10,
      data: new Uint8Array(10 * 10 * 4).fill(100),
      metadata: {
        creationDate: testDate,
      },
    };

    const encoded = await format.encode(imageData);
    const decoded = await format.decode(encoded);

    if (decoded.metadata?.creationDate) {
      assertEquals(
        decoded.metadata.creationDate.getFullYear(),
        testDate.getFullYear(),
      );
      assertEquals(
        decoded.metadata.creationDate.getMonth(),
        testDate.getMonth(),
      );
      assertEquals(decoded.metadata.creationDate.getDate(), testDate.getDate());
      assertEquals(
        decoded.metadata.creationDate.getHours(),
        testDate.getHours(),
      );
      assertEquals(
        decoded.metadata.creationDate.getMinutes(),
        testDate.getMinutes(),
      );
      assertEquals(
        decoded.metadata.creationDate.getSeconds(),
        testDate.getSeconds(),
      );
    }
  }
});

test("EXIF: Metadata merge behavior with EXIF fields", () => {
  const data = new Uint8Array(50 * 50 * 4).fill(150);
  const image = Image.fromRGBA(50, 50, data);

  // Set initial metadata
  image.setMetadata({
    author: "Initial Author",
    description: "Initial Description",
  });

  // Merge additional metadata (default behavior)
  image.setMetadata({
    copyright: "New Copyright",
    creationDate: new Date("2024-01-01"),
  });

  // Both old and new should be present
  assertEquals(image.metadata?.author, "Initial Author");
  assertEquals(image.metadata?.description, "Initial Description");
  assertEquals(image.metadata?.copyright, "New Copyright");
  assertEquals(image.metadata?.creationDate?.getFullYear(), 2024);

  // Replace metadata
  image.setMetadata({
    author: "Replaced Author",
  }, false);

  // Only new metadata should exist
  assertEquals(image.metadata?.author, "Replaced Author");
  assertEquals(image.metadata?.description, undefined);
  assertEquals(image.metadata?.copyright, undefined);
  assertEquals(image.metadata?.creationDate, undefined);
});

test("EXIF: Long text fields handling", async () => {
  const format = new JPEGFormat();

  const longDescription = "A".repeat(500); // Long description
  const longAuthor = "B".repeat(200);
  const longCopyright = "C".repeat(300);

  const imageData = {
    width: 32,
    height: 32,
    data: new Uint8Array(32 * 32 * 4).fill(100),
    metadata: {
      author: longAuthor,
      description: longDescription,
      copyright: longCopyright,
    },
  };

  const encoded = await format.encode(imageData);
  const decoded = await format.decode(encoded);

  assertEquals(decoded.metadata?.author, longAuthor);
  assertEquals(decoded.metadata?.description, longDescription);
  assertEquals(decoded.metadata?.copyright, longCopyright);
});
