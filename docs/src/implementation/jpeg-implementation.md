---
title: "JPEG"
parent: "Implementation Notes"
nav_order: 1
---

# JPEG Pure-JS Implementation Notes

- **Decoder:** Supports both baseline DCT (SOF0) and progressive DCT (SOF2).
  Implements Huffman decoding (DC/AC), DQT parsing, IDCT, YCbCr→RGB conversion,
  grayscale, and chroma subsampling (4:4:4, 4:2:2, 4:2:0). Includes
  fault-tolerant decoding mode (enabled by default) for block-level error
  recovery. Progressive JPEGs are decoded by processing multiple scans
  sequentially with proper spectral selection (frequency band) handling. Scans
  accumulate coefficients across multiple passes, though full successive
  approximation bit refinement is not yet implemented (later scans overwrite
  earlier ones). This approach successfully decodes most progressive JPEGs
  including those with complex multi-scan patterns. Arithmetic coding and
  lossless JPEGs are not supported.
- **Encoder:** baseline DCT implemented with adjustable quality, standard
  Huffman tables, and JFIF/EXIF marker support. Defaults to 4:4:4 (no
  subsampling). Progressive encoding and optimized Huffman tables are not
  implemented.
- **Metadata:** APP0 (JFIF) and APP1 (EXIF) are parsed and written; orientation
  is preserved in metadata but not auto-applied during decode.
- **Fault-Tolerant Mode:** enabled by default. Continues decoding even if some
  DCT blocks fail, filling failed blocks with zeros. Can be disabled via
  `JPEGDecoderOptions` for strict validation.
- **Progressive Support Details:**
  - Parses spectral selection (Ss, Se) and successive approximation (Ah, Al)
    parameters
  - Preserves DCT coefficient blocks across multiple scans for accumulation
  - Handles DC-only scans, AC coefficient band scans, and interleaved scans
  - Successfully decodes progressive JPEGs from various sources including mobile
    cameras and web encoders
- **Limitations:** no progressive encoding, no arithmetic coding, limited
  CMYK/16-bit support, successive approximation bit refinement not fully
  implemented.
- **Key files:** `src/formats/jpeg.ts`, `src/utils/jpeg_decoder.ts`,
  `src/utils/jpeg_encoder.ts`.
- **Tests:** `test/formats/jpeg.test.ts`, `test/formats/jpeg_complex.test.ts`,
  `test/purejs_roundtrip.test.ts`, `test/formats/jpeg_subsampling.test.ts`.
- **Notes:** prioritize correctness and compatibility across runtimes. Future
  work: progressive encoding, full successive approximation refinement,
  chroma-subsampled encoding, and optimized Huffman tables.
