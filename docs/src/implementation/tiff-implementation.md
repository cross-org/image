---
title: "TIFF"
parent: "Implementation Notes"
nav_order: 3
---

# TIFF Pure-JS Implementation Notes

## Current Status

The TIFF format handler implements a **pure-JS encoder and decoder** for
uncompressed and LZW-compressed RGB/RGBA images with multi-page support:

### Decoder

- ✅ TIFF 6.0 baseline - **fully implemented**
- ✅ Little-endian and big-endian byte order - **fully implemented**
- ✅ Uncompressed RGB/RGBA (compression=1) - **fully implemented**
- ✅ LZW compressed RGB/RGBA (compression=5) - **fully implemented**
- ✅ Multi-page/Multi-IFD TIFF files - **fully implemented**
- ✅ Metadata extraction (DPI, description, author, copyright, creation date) -
  **fully implemented**
- ✅ Single strip images - **fully implemented**
- ✅ Photometric interpretation RGB (type=2) - **fully implemented**
- ✅ 8-bit per channel images - **fully implemented**
- ✅ Both RGB (3 samples) and RGBA (4 samples) - **fully implemented**
- ⚠️ JPEG compression (compression=7) - **fallback to ImageDecoder API**
- ⚠️ PackBits compression (compression=32773) - **fallback to ImageDecoder API**
- ❌ TIFF tiles (tiled images) - **not yet implemented**
- ❌ Multiple strips per image - **not yet implemented**
- ❌ CMYK color space - **not yet implemented**
- ❌ Palette/indexed color - **not yet implemented**
- ❌ Grayscale images - **not yet implemented**
- ❌ 16-bit per channel images - **not yet implemented**

### Encoder

- ✅ TIFF 6.0 baseline - **fully implemented**
- ✅ Little-endian byte order - **fully implemented**
- ✅ Uncompressed RGBA (compression=1) - **fully implemented**
- ✅ LZW compressed RGBA (compression=5) - **fully implemented**
- ✅ Multi-page/Multi-IFD encoding - **fully implemented**
- ✅ Metadata injection (DPI, description, author, copyright, creation date) -
  **fully implemented**
- ✅ Single strip encoding - **fully implemented**
- ✅ ExtraSamples tag for alpha channel - **fully implemented**
- ✅ Rational DPI values - **fully implemented**
- ❌ RGB-only encoding (without alpha) - **always encodes RGBA**
- ❌ Big-endian byte order - **little-endian only**
- ❌ Multiple strips per image - **not yet implemented**
- ❌ TIFF tiles - **not yet implemented**
- ❌ Other compression methods - **not yet implemented**

This produces valid TIFF 6.0 files that decode correctly across all platforms
and are compatible with all major image viewers and applications.

## Technical Implementation Details

### TIFF Structure

TIFF files consist of:

1. **Header (8 bytes)**:
   - Byte order indicator: "II" (little-endian) or "MM" (big-endian)
   - Magic number: 42
   - Offset to first IFD (Image File Directory)

2. **IFD (Image File Directory)**:
   - Number of directory entries
   - Array of 12-byte directory entries (tags)
   - Offset to next IFD (0 if none)

3. **Image data**: Pixel data, typically in strips or tiles

### Supported TIFF Tags

#### Required Tags (Always Written)

- `0x0100` ImageWidth - Width of the image in pixels
- `0x0101` ImageLength - Height of the image in pixels (called "length" in TIFF
  spec)
- `0x0102` BitsPerSample - Number of bits per channel (8,8,8,8 for RGBA)
- `0x0103` Compression - Compression method (1=none, 5=LZW)
- `0x0106` PhotometricInterpretation - Color space (2=RGB)
- `0x0111` StripOffsets - Offset to image data
- `0x0115` SamplesPerPixel - Number of channels (4 for RGBA)
- `0x0116` RowsPerStrip - Number of rows per strip (equals ImageLength for
  single strip)
- `0x0117` StripByteCounts - Size of compressed/uncompressed image data
- `0x011a` XResolution - Horizontal resolution (DPI)
- `0x011b` YResolution - Vertical resolution (DPI)
- `0x0152` ExtraSamples - How to interpret extra samples (2=unassociated alpha)

#### Optional Metadata Tags (Written if metadata present)

- `0x010e` ImageDescription - Text description of the image
- `0x013b` Artist - Author/creator name
- `0x0132` DateTime - Creation timestamp (format: "YYYY:MM:DD HH:MM:SS")
- `0x8298` Copyright - Copyright notice

### LZW Compression Implementation

The LZW (Lempel-Ziv-Welch) compression used in TIFF differs from GIF's LZW:

#### Key Differences from GIF LZW

1. **Bit ordering**: TIFF uses MSB-first (big-endian bits), GIF uses LSB-first
2. **Initial code size**: TIFF typically starts with 9-bit codes, GIF varies
   based on palette size
3. **Code values**: TIFF uses 256 (clear), 257 (EOI), 258+ (dictionary)

#### Compression Process

```typescript
// Example: LZW compression
const format = new TIFFFormat();
const imageData = {
  width: 100,
  height: 100,
  data: rgbaPixelData, // Uint8Array with RGBA pixel data (width * height * 4 bytes)
};

// Compress with LZW
const compressed = await format.encode(imageData, { compression: "lzw" });
```

The encoder:

1. Initializes dictionary with single-byte entries (0-255)
2. Sets clear code (256) and EOI code (257)
3. Starts with 9-bit codes, increasing to 10, 11, 12 bits as dictionary grows
4. Writes clear code, then compressed data, then EOI code
5. Uses MSB-first bit packing

The decoder:

1. Reads codes MSB-first
2. Handles clear codes to reset dictionary
3. Handles EOI code to stop decompression
4. Dynamically increases code size as dictionary grows
5. Handles special case where code references not-yet-added entry

### Multi-Page TIFF Support

Multi-page TIFFs contain multiple IFDs (Image File Directories) linked together:

```typescript
// Encode multi-page TIFF
const multiFrameData = {
  width: 100,
  height: 100,
  frames: [
    { width: 100, height: 100, data: page1Data },
    { width: 100, height: 100, data: page2Data },
    { width: 100, height: 100, data: page3Data },
  ],
  metadata: {
    description: "Multi-page document",
  },
};

const tiff = await Image.saveFrames("tiff", multiFrameData);

// Decode all pages
const pages = await Image.readFrames(tiff);
console.log(`Decoded ${pages.frames.length} pages`);
```

#### Implementation Details

- Each page has its own IFD with independent dimensions and compression
- IFDs are linked via NextIFDOffset field
- Pixel data for all pages is written first, then all IFDs
- Metadata is stored only in the first IFD
- All pages use the same compression method

### Metadata Handling

TIFF metadata is stored in IFD tags and converted to/from the library's standard
metadata format:

```typescript
const imageData = {
  width: 800,
  height: 600,
  data: rgbaData,
  metadata: {
    dpiX: 300,
    dpiY: 300,
    description: "High-resolution photo",
    author: "Jane Smith",
    copyright: "© 2024 Jane Smith",
    creationDate: new Date(),
  },
};

const tiff = await format.encode(imageData);
```

#### Metadata Tag Mapping

- `dpiX` / `dpiY` → XResolution / YResolution (stored as rational: numerator/1)
- `description` → ImageDescription (ASCII string)
- `author` → Artist (ASCII string)
- `copyright` → Copyright (ASCII string)
- `creationDate` → DateTime (formatted as "YYYY:MM:DD HH:MM:SS")

### Fallback to ImageDecoder API

For compressed TIFF formats not supported by the pure-JS decoder (JPEG,
PackBits, etc.), the implementation automatically falls back to the runtime's
ImageDecoder API:

```typescript
// This TIFF uses JPEG compression - will use ImageDecoder
const decoded = await format.decode(jpegCompressedTiff);
```

The fallback ensures broad compatibility while maintaining pure-JS support for
the most common TIFF variants (uncompressed and LZW).

## Code Examples

### Basic Encoding and Decoding

```typescript
import { Image } from "@cross/image";

// Create an image
const img = Image.create(200, 150, 255, 255, 255);

// Save as TIFF (uncompressed by default)
const tiff = await img.encode("tiff");
await Deno.writeFile("output.tiff", tiff);

// Load and decode
const data = await Deno.readFile("output.tiff");
const loaded = await Image.decode(data);
console.log(`Loaded ${loaded.width}x${loaded.height} TIFF`);
```

### LZW Compression

```typescript
import { TIFFFormat } from "@cross/image";

const format = new TIFFFormat();

// Create test image
const imageData = {
  width: 100,
  height: 100,
  data: new Uint8Array(100 * 100 * 4),
};

// Encode with LZW compression
const lzwTiff = await format.encode(imageData, { compression: "lzw" });

// Encode without compression
const uncompressedTiff = await format.encode(imageData, {
  compression: "none",
});

console.log(`Uncompressed: ${uncompressedTiff.length} bytes`);
console.log(`LZW compressed: ${lzwTiff.length} bytes`);
```

### Multi-Page TIFF

```typescript
import { Image } from "@cross/image";

// Create multiple pages
const pages = {
  width: 200,
  height: 200,
  frames: [
    { width: 200, height: 200, data: page1Rgba },
    { width: 200, height: 200, data: page2Rgba },
    { width: 200, height: 200, data: page3Rgba },
  ],
};

// Save multi-page TIFF
const tiff = await Image.saveFrames("tiff", pages);

// Read all pages
const decoded = await Image.readFrames(tiff);
console.log(`Read ${decoded.frames.length} pages`);

// Access individual pages
for (let i = 0; i < decoded.frames.length; i++) {
  const frame = decoded.frames[i];
  console.log(`Page ${i + 1}: ${frame.width}x${frame.height}`);
}
```

### Metadata

```typescript
import { Image } from "@cross/image";

const img = Image.create(800, 600, 255, 255, 255);

// Add metadata
img.metadata = {
  dpiX: 300,
  dpiY: 300,
  description: "High-resolution image",
  author: "John Doe",
  copyright: "© 2024",
  creationDate: new Date(),
};

// Save TIFF with metadata
const tiff = await img.encode("tiff");

// Read back and access metadata
const loaded = await Image.decode(tiff);
console.log(`DPI: ${loaded.metadata?.dpiX}x${loaded.metadata?.dpiY}`);
console.log(`Author: ${loaded.metadata?.author}`);
console.log(`Description: ${loaded.metadata?.description}`);
```

## Future Enhancements

Potential improvements to the TIFF implementation:

1. **Tiled TIFF support** - More efficient for large images
2. **Multiple strips** - Better compatibility with some TIFF producers
3. **Grayscale images** - Reduce file size for monochrome images
4. **16-bit per channel** - HDR and high-precision imaging
5. **CMYK color space** - Print industry support
6. **Palette/indexed color** - Smaller files for limited color images
7. **Predictor (compression=2)** - Better LZW compression for continuous-tone
   images
8. **RGB-only encoding** - Save space when alpha channel is not needed
9. **Big-endian encoding** - Better compatibility with certain systems
10. **PackBits compression** - Pure-JS implementation for additional compression
    option

## References

- [TIFF 6.0 Specification](https://www.adobe.io/content/dam/udp/en/open/standards/tiff/TIFF6.pdf)
- [LZW Compression](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)
- [TIFF Tag Reference](https://www.awaresystems.be/imaging/tiff/tifftags.html)
