---
title: "JPEG"
parent: "Implementation Notes"
nav_order: 1
---

# JPEG Pure-JS Implementation Notes

- **Decoder:** baseline DCT (SOF0) and progressive DCT (SOF2) implemented.
  Supports Huffman (DC/AC), DQT, IDCT, YCbCr→RGB, grayscale, and chroma
  subsampling (4:4:4, 4:2:2, 4:2:0). Includes fault-tolerant decoding mode
  (enabled by default) for block-level error recovery. Progressive JPEGs are
  decoded by processing multiple scans sequentially. Arithmetic and lossless
  JPEGs are not supported.
- **Encoder:** baseline DCT implemented with adjustable quality, standard
  Huffman tables, and JFIF/EXIF marker support. Defaults to 4:4:4 (no
  subsampling). Progressive encoding and optimized Huffman tables are not
  implemented.
- **Metadata:** APP0 (JFIF) and APP1 (EXIF) are parsed and written; orientation
  is preserved in metadata but not auto-applied during decode.
- **Fault-Tolerant Mode:** enabled by default. Continues decoding even if some
  DCT blocks fail, filling failed blocks with zeros. Can be disabled via
  `JPEGDecoderOptions` for strict validation.
- **Limitations:** no progressive encoding, no arithmetic coding, limited
  CMYK/16-bit support.
- **Key files:** `src/formats/jpeg.ts`, `src/utils/jpeg_decoder.ts`,
  `src/utils/jpeg_encoder.ts`.
- **Tests:** `test/formats/jpeg.test.ts`, `test/formats/jpeg_complex.test.ts`,
  `test/purejs_roundtrip.test.ts`, `test/formats/jpeg_subsampling.test.ts`.
- **Notes:** prioritize correctness and compatibility across runtimes. Future
  work: progressive encoding, chroma-subsampled encoding, and optimized Huffman
  tables.
