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
  sequentially with proper spectral selection (frequency band) handling,
  successive approximation bit refinement, and deferred IDCT. DCT coefficients
  accumulate across multiple scans in the frequency domain, with IDCT performed
  only after all scans complete. Successive approximation is supported: first
  scans encode high bits (Ah=0, Al>0), refinement scans add precision (Ah>0);
  both DC and AC coefficient refinement are handled. This approach successfully
  decodes progressive JPEGs including those with complex multi-scan patterns and
  successive approximation from mobile cameras and web encoders. Arithmetic
  coding and lossless JPEGs are not supported.
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
  DCT blocks fail, filling failed blocks with zeros. Can be disabled by passing
  `ImageDecoderOptions` with `tolerantDecoding: false` to `Image.decode()`.
- **Progressive Support Details:**
  - **Decoding:** Parses spectral selection (Ss, Se) and successive
    approximation (Ah, Al) parameters; preserves DCT coefficient blocks across
    multiple scans for accumulation; defers IDCT until all scans complete to
    maintain frequency-domain data integrity; handles DC-only scans, AC
    coefficient band scans, interleaved scans, and successive approximation
    refinement scans; supports bit-precision refinement where first scans encode
    high bits and later scans add lower-precision bits; successfully decodes
    progressive JPEGs from various sources including mobile cameras and web
    encoders
  - **Encoding:** Uses simplified 2-scan progressive approach (DC coefficients
    Ss=0/Se=0, then AC coefficients Ss=1/Se=63); creates valid progressive JPEGs
    with SOF2 marker; optional via `JPEGEncoderOptions.progressive` flag
    (default: false for baseline mode)
- **Limitations:** multi-scan AC bands and optimized progressive patterns not
  implemented (encoder); no arithmetic coding; limited CMYK/16-bit support.
- **Key files:** `src/formats/jpeg.ts`, `src/utils/jpeg_decoder.ts`,
  `src/utils/jpeg_encoder.ts`.
- **Tests:** `test/formats/jpeg.test.ts`, `test/formats/jpeg_complex.test.ts`,
  `test/formats/jpeg_progressive.test.ts`, `test/purejs_roundtrip.test.ts`,
  `test/formats/jpeg_subsampling.test.ts`.
- **Notes:** prioritize correctness and compatibility across runtimes. Future
  work: multi-band progressive encoding, chroma-subsampled encoding, and
  optimized Huffman tables.
