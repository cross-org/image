---
title: "GIF"
parent: "Implementation Notes"
nav_order: 4
---

# GIF Pure-JS Implementation Notes

- **Decoder:** GIF87a/GIF89a fully supported. Includes LZW decompression, global
  and local color tables, interlacing, transparency, multi-frame animation, GCE
  (delay, disposal, transparency), comment/XMP metadata extraction, and
  fault-tolerant decoding (enabled by default) for frame-level error recovery.
- **Encoder:** GIF89a format with LZW compression, global color table with
  palette generation and color quantization, transparency, multi-frame
  animation, GCE (delay and disposal method), and optimized color palettes.
- **Fault-Tolerant Mode:** enabled by default. Skips corrupted frames instead of
  failing; continues decoding remaining frames even if LZW decompression fails.
  Can be disabled via `GIFDecoderOptions` for strict validation.
- **Key files:** `src/formats/gif.ts`, `src/utils/gif_decoder.ts`,
  `src/utils/gif_encoder.ts`, `src/utils/lzw.ts`.
- **Tests:** `test/formats/gif.test.ts`, `test/formats/gif_tolerant.test.ts`,
  `test/multiframe.test.ts`.
- **Notes:** LZW uses standard algorithm with clear codes and 12-bit dictionary
  (4096 entries). Color quantization uses median cut algorithm. Interlacing uses
  four-pass Adam7-style for progressive loading.
