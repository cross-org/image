---
title: "WebP"
parent: "Implementation Notes"
nav_order: 2
---

# WebP VP8L Implementation Notes

- **Status:** complex Huffman coding implemented; LZ77 backward references and color cache not
  implemented. Current encoder produces valid VP8L streams for Huffman-only encodings; full
  compression requires LZ77 & color cache.
- **Decoder:** VP8L (lossless) decoder with fault-tolerant mode (enabled by default) for pixel-level
  error recovery. Fills remaining pixels with gray when Huffman/LZ77 decoding fails.
- **Decoder/Encoder files:** `src/formats/webp.ts`, `src/utils/webp_encoder.ts`,
  `src/utils/webp_decoder.ts`.
- **Tests:** `test/formats/webp.test.ts`, `test/formats/webp_tolerant.test.ts`,
  `test/purejs_roundtrip.test.ts`.
- **Notes:** implemented: canonical Huffman generation, code-length RLE, and writing of all required
  Huffman groups (green, red, blue, alpha, distance). Fault-tolerant decoding allows partial
  recovery from corrupted VP8L images. Remaining work: implement LZ77 match finding & encoding, and
  color cache to reach full lossless compression parity with libwebp.
