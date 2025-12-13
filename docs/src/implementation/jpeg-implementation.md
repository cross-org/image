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
- **Encoder:** Supports both baseline DCT (SOF0) and progressive DCT (SOF2) with
  adjustable quality and standard Huffman tables. Progressive encoding uses a
  simplified 2-scan approach (DC-only scan, then AC scan) with proper SOF2
  marker and scan parameters. Includes JFIF/EXIF marker support. Defaults to
  4:4:4 (no subsampling). More sophisticated progressive patterns (multi-band AC
  scans, successive approximation) and optimized Huffman tables are not yet
  implemented.
- **Metadata:** APP0 (JFIF) and APP1 (EXIF) are parsed and written; orientation
  is preserved in metadata but not auto-applied during decode.
- **Fault-Tolerant Mode:** enabled by default. Continues decoding even if some
  DCT blocks fail, filling failed blocks with zeros. Can be disabled via
  `JPEGDecoderOptions` for strict validation.
- **Progressive Support Details:**
  - **Decoding:** Parses spectral selection (Ss, Se) and successive
    approximation (Ah, Al) parameters; preserves DCT coefficient blocks across
    multiple scans for accumulation; handles DC-only scans, AC coefficient band
    scans, and interleaved scans; successfully decodes progressive JPEGs from
    various sources including mobile cameras and web encoders
  - **Encoding:** Uses simplified 2-scan progressive approach (DC coefficients
    Ss=0/Se=0, then AC coefficients Ss=1/Se=63); creates valid progressive JPEGs
    with SOF2 marker; optional via `JPEGEncoderOptions.progressive` flag
    (default: false for baseline mode)
- **Limitations:** successive approximation bit refinement not fully implemented
  (decoder); multi-scan AC bands and optimized progressive patterns not
  implemented (encoder); no arithmetic coding; limited CMYK/16-bit support.
- **Key files:** `src/formats/jpeg.ts`, `src/utils/jpeg_decoder.ts`,
  `src/utils/jpeg_encoder.ts`.
- **Tests:** `test/formats/jpeg.test.ts`, `test/formats/jpeg_complex.test.ts`,
  `test/purejs_roundtrip.test.ts`, `test/formats/jpeg_subsampling.test.ts`.
- **Notes:** prioritize correctness and compatibility across runtimes. Future
  work: full successive approximation refinement, multi-band progressive
  encoding, chroma-subsampled encoding, and optimized Huffman tables.
