---
title: "Format Support"
nav_order: 3
---

# Format Support

This page details the image formats supported by @cross/image, their features,
and runtime compatibility.

## Format Support Matrix

This table shows which image formats are supported and their implementation
status:

| Format | Read | Write | Pure-JS Decode | Pure-JS Encode | Native API Decode | Native API Encode  | Notes                                        |
| ------ | ---- | ----- | -------------- | -------------- | ----------------- | ------------------ | -------------------------------------------- |
| PNG    | ✅   | ✅    | ✅ Full        | ✅ Full        | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation              |
| APNG   | ✅   | ✅    | ✅ Full        | ✅ Full        | ✅ ImageDecoder   | N/A                | Animated PNG with multi-frame support        |
| BMP    | ✅   | ✅    | ✅ Full        | ✅ Full        | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation              |
| DNG    | ✅   | ✅    | ✅ Full        | ✅ Full        | N/A               | N/A                | Linear DNG (Uncompressed RGBA)               |
| PAM    | ✅   | ✅    | ✅ Full        | ✅ Full        | N/A               | N/A                | Netpbm PAM (Portable Arbitrary Map)          |
| PPM    | ✅   | ✅    | ✅ Full        | ✅ Full        | N/A               | N/A                | Netpbm PPM (Portable PixMap) P3/P6 formats   |
| PCX    | ✅   | ✅    | ✅ Full        | ✅ Full        | N/A               | N/A                | ZSoft PCX (RLE compressed)                   |
| ASCII  | ✅   | ✅    | ✅ Full        | ✅ Full        | N/A               | N/A                | Text-based ASCII art representation          |
| JPEG   | ✅   | ✅    | ⚠️ Baseline    | ⚠️ Baseline    | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS for baseline DCT only                |
| GIF    | ✅   | ✅    | ✅ Full        | ✅ Full        | ✅ ImageDecoder   | ✅ OffscreenCanvas | Complete pure-JS implementation              |
| WebP   | ✅   | ✅    | ⚠️ Lossless    | ⚠️ Quantized   | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS VP8L with quality-based quantization |
| TIFF   | ✅   | ✅    | ⚠️ Basic       | ⚠️ Basic       | ✅ ImageDecoder   | ✅ OffscreenCanvas | Pure-JS for uncompressed, LZW, & grayscale   |

**Legend:**

- ✅ **Full support** - Complete implementation with all common features
- ⚠️ **Limited support** - Partial implementation with restrictions
- ❌ **Not supported** - Feature not available in pure-JS, requires native APIs
- **Pure-JS** - Works in all JavaScript runtimes without native dependencies
- **Native API** - Uses runtime APIs like ImageDecoder (decode) or
  OffscreenCanvas (encode)

## Format Specifications Supported

This table shows which format standards and variants are supported:

| Format | Specification/Variant               | Support Level     | Implementation |
| ------ | ----------------------------------- | ----------------- | -------------- |
| PNG    | PNG 1.2 (ISO/IEC 15948)             | ✅ Full           | Pure-JS        |
|        | - Interlaced (Adam7)                | ❌ Not Yet        | -              |
|        | - Color types: Grayscale, RGB, RGBA | ✅ Full           | Pure-JS        |
|        | - Metadata: pHYs, tEXt, iTXt, eXIf  | ✅ Full           | Pure-JS        |
| APNG   | APNG (Animated PNG)                 | ✅ Full           | Pure-JS        |
|        | - acTL, fcTL, fdAT chunks           | ✅ Full           | Pure-JS        |
|        | - Multi-frame animation decode      | ✅ Full           | Pure-JS        |
|        | - Multi-frame animation encode      | ✅ Full           | Pure-JS        |
|        | - Frame disposal methods            | ✅ Full           | Pure-JS        |
|        | - Metadata: pHYs, tEXt, iTXt, eXIf  | ✅ Full           | Pure-JS        |
| BMP    | Windows BMP (BITMAPINFOHEADER)      | ✅ Full           | Pure-JS        |
|        | - 24-bit RGB                        | ✅ Full           | Pure-JS        |
|        | - 32-bit RGBA                       | ✅ Full           | Pure-JS        |
|        | - Compressed variants (RLE)         | ❌ Not Yet        | -              |
| JPEG   | JPEG/JFIF Baseline DCT              | ✅ Full           | Pure-JS        |
|        | Progressive DCT                     | ⚠️ Native only    | ImageDecoder   |
|        | - EXIF metadata                     | ✅ Full           | Pure-JS        |
|        | - JFIF (APP0) with DPI              | ✅ Full           | Pure-JS        |
| WebP   | WebP Lossless (VP8L)                | ⚠️ Basic          | Pure-JS        |
|        | - Simple Huffman coding             | ✅ Full           | Pure-JS        |
|        | - LZ77 backward references          | ❌ Not in encoder | -              |
|        | - Color cache                       | ❌ Not in encoder | -              |
|        | - Transforms (predictor, etc.)      | ❌ Not Yet        | -              |
|        | WebP Lossy (VP8L with quantization) | ✅ Quality-based  | Pure-JS        |
|        | - Color quantization for lossy      | ✅ Full           | Pure-JS        |
|        | WebP Lossy (VP8)                    | ⚠️ Native only    | ImageDecoder   |
|        | - EXIF, XMP metadata                | ✅ Full           | Pure-JS        |
| TIFF   | TIFF 6.0 - Uncompressed RGB/RGBA    | ✅ Full           | Pure-JS        |
|        | TIFF 6.0 - LZW compressed RGB/RGBA  | ✅ Full           | Pure-JS        |
|        | TIFF 6.0 - Grayscale (0, 1)         | ✅ Full           | Pure-JS        |
|        | - JPEG, PackBits compression        | ⚠️ Native only    | ImageDecoder   |
|        | - Multi-page/IFD (decode & encode)  | ✅ Full           | Pure-JS        |
|        | - EXIF, Artist, Copyright metadata  | ✅ Full           | Pure-JS        |
| GIF    | GIF87a, GIF89a                      | ✅ Full           | Pure-JS        |
|        | - LZW compression/decompression     | ✅ Full           | Pure-JS        |
|        | - Color quantization (encoding)     | ✅ Full           | Pure-JS        |
|        | - Transparency support              | ✅ Full           | Pure-JS        |
|        | - Interlacing support               | ✅ Full           | Pure-JS        |
|        | - Animation (multi-frame decode)    | ✅ Full           | Pure-JS        |
|        | - Animation (multi-frame encode)    | ✅ Full           | Pure-JS        |
|        | - Comment extensions, XMP           | ✅ Full           | Pure-JS        |
| DNG    | Adobe DNG 1.6.0.0 (Linear)          | ✅ Full           | Pure-JS        |
| PAM    | Netpbm PAM (Portable Arbitrary Map) | ✅ Full           | Pure-JS        |
| PPM    | Netpbm PPM (Portable PixMap)        | ✅ Full           | Pure-JS        |
|        | - P3 (ASCII) format                 | ✅ Full           | Pure-JS        |
|        | - P6 (Binary) format                | ✅ Full           | Pure-JS        |
|        | - Comments in header                | ✅ Full           | Pure-JS        |
|        | - Maxval scaling (1-255)            | ✅ Full           | Pure-JS        |
| PCX    | ZSoft PCX Version 5 (3.0)           | ✅ Full           | Pure-JS        |
|        | - 24-bit RGB (3 planes)             | ✅ Full           | Pure-JS        |
|        | - 8-bit Palette (1 plane)           | ✅ Decode only    | Pure-JS        |
| ASCII  | Text-based ASCII art                | ✅ Full           | Pure-JS        |
|        | - Multiple character sets           | ✅ Full           | Pure-JS        |
|        | - Configurable width & aspect ratio | ✅ Full           | Pure-JS        |
|        | - Brightness inversion              | ✅ Full           | Pure-JS        |

## Runtime Compatibility by Format

| Format | Deno 2.x | Node.js 18+ | Node.js 20+ | Bun | Notes                                       |
| ------ | -------- | ----------- | ----------- | --- | ------------------------------------------- |
| PNG    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| APNG   | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| DNG    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| PAM    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| PPM    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| PCX    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| ASCII  | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| GIF    | ✅       | ✅          | ✅          | ✅  | Pure-JS works everywhere                    |
| JPEG   | ✅       | ⚠️ Baseline | ✅          | ✅  | Node 18: pure-JS baseline only, 20+: full   |
| WebP   | ✅       | ⚠️ Lossless | ✅          | ✅  | Node 18: pure-JS lossless only, 20+: full   |
| TIFF   | ✅       | ✅          | ✅          | ✅  | Node 18: pure-JS uncompressed+LZW+grayscale |

**Note**: For maximum compatibility across all runtimes, use PNG, APNG, BMP,
GIF, ASCII, PCX, PPM or DNG formats which have complete pure-JS implementations.

## Implementation Details

For detailed technical information about specific format implementations:

- [JPEG Implementation Details](implementation/jpeg-implementation.md)
- [WebP Implementation Details](implementation/webp-implementation.md)
- [TIFF Implementation Details](implementation/tiff-implementation.md)
