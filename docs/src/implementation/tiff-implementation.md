## title: "TIFF" parent: "Implementation Notes" nav_order: 3

# TIFF Pure-JS Implementation Notes

---
title: "TIFF"
parent: "Implementation Notes"
nav_order: 3
---

# TIFF Pure-JS Implementation Notes

- **Decoder:** TIFF 6.0 baseline for little-endian files; supports uncompressed
  and LZW-compressed RGB/RGBA and grayscale, multi-IFD (multi-page), and common
  metadata (DPI, description, author, creation date). Unsupported: tiled TIFFs,
  multiple strips, CMYK, palette/indexed color, 16-bit samples. JPEG/PackBits
  compressed strips fall back to the runtime ImageDecoder.
- **Encoder:** writes little-endian TIFF 6.0; supports uncompressed and LZW
  output, RGB/RGBA and grayscale, multi-page, and standard metadata tags. Big-
  endian output and additional compression methods are not implemented.
- **Key files:** `src/formats/tiff.ts`, `src/utils/tiff.ts`, `src/utils/lzw.ts`.
- **Tests:** `test/formats/tiff.test.ts` and multi-page tests in `test/*`.
- **Notes:** LZW uses MSB-first bit packing with 9→12-bit codes; multi-page
  layout writes pixel data then IFDs. Fallbacks maintain compatibility for rare
  compressions. option

9. **Grayscale with alpha** - Support for grayscale images with transparency

## References

- [TIFF 6.0 Specification](https://www.adobe.io/content/dam/udp/en/open/standards/tiff/TIFF6.pdf)
- [LZW Compression](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)
- [TIFF Tag Reference](https://www.awaresystems.be/imaging/tiff/tifftags.html)
