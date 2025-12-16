---
title: "TIFF"
parent: "Implementation Notes"
nav_order: 3
---

# TIFF Pure-JS Implementation Notes

- **Decoder:** TIFF 6.0 baseline for little-endian files; supports uncompressed, LZW, PackBits
  (32773), and Deflate (8) compressed RGB/RGBA, CMYK, and grayscale, multi-IFD (multi-page), and
  common metadata (DPI, description, author, creation date). CMYK images (photometric interpretation
  5) are automatically converted to RGBA during decoding. Unsupported: tiled TIFFs, multiple strips,
  palette/indexed color, 16-bit samples. JPEG-compressed (6, 7) strips fall back to the runtime
  ImageDecoder.
- **Encoder:** writes little-endian TIFF 6.0; supports uncompressed, LZW, PackBits, and Deflate
  output, RGB/RGBA, CMYK, and grayscale, multi-page, and standard metadata tags. CMYK encoding
  available via `cmyk: true` option in `TIFFEncoderOptions`. Big-endian output and additional
  compression methods are not implemented.
- **Key files:** `src/formats/tiff.ts`, `src/utils/tiff_lzw.ts`, `src/utils/tiff_packbits.ts`,
  `src/utils/tiff_deflate.ts`.
- **Tests:** `test/formats/tiff.test.ts`, `test/formats/tiff_cmyk.test.ts`, and multi-page tests in
  `test/*`.
- **Notes:** LZW uses MSB-first bit packing with 9→12-bit codes; PackBits uses run-length encoding
  (RLE); Deflate uses native JavaScript CompressionStream/DecompressionStream. Multi-page layout
  writes pixel data then IFDs. Fallbacks maintain compatibility for rare compressions like JPEG.
  CMYK color space uses standard subtractive color model conversion formulas.

## Compression Methods

- **Uncompressed (1):** No compression, fastest encoding/decoding
- **LZW (5):** Lempel-Ziv-Welch compression, good for images with repeated patterns
- **PackBits (32773):** Simple run-length encoding, efficient for images with runs of identical
  bytes
- **Deflate (8):** Adobe-style Deflate compression using native JavaScript APIs, good
  general-purpose compression
- **JPEG (6, 7):** Falls back to runtime ImageDecoder for decoding only

## References

- [TIFF 6.0 Specification](https://www.adobe.io/content/dam/udp/en/open/standards/tiff/TIFF6.pdf)
- [LZW Compression](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)
- [PackBits RLE](https://en.wikipedia.org/wiki/PackBits)
- [TIFF Tag Reference](https://www.awaresystems.be/imaging/tiff/tifftags.html)
