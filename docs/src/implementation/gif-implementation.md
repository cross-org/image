---
title: "GIF"
parent: "Implementation Notes"
nav_order: 4
---

# GIF Pure-JS Implementation Notes

## Current Status

The GIF format handler implements a **full LZW decoder and encoder** that works
correctly for both single-frame and multi-frame (animated) GIF images:

### Decoder

- ✅ GIF87a and GIF89a formats - **fully supported**
- ✅ LZW decompression - **fully implemented**
- ✅ Global and local color tables - **fully supported**
- ✅ Interlaced images - **fully supported with deinterlacing**
- ✅ Transparency support - **fully implemented**
- ✅ Multi-frame (animated) GIFs - **fully supported**
- ✅ Graphic Control Extension (GCE) - **delay, disposal, transparency**
- ✅ Comment Extension - **metadata extraction**
- ✅ Application Extension - **XMP metadata support**
- ✅ **Fault-tolerant decoding - frame-level error recovery**

### Encoder

- ✅ GIF89a format - **fully implemented**
- ✅ LZW compression - **fully implemented**
- ✅ Global color table - **palette generation with color quantization**
- ✅ Transparency support - **alpha channel handling**
- ✅ Multi-frame (animated) GIF encoding - **fully supported**
- ✅ Graphic Control Extension - **delay and disposal method**
- ✅ Optimized color palettes - **adaptive quantization**

## Fault-Tolerant Decoding

The GIF decoder includes frame-level fault-tolerant decoding (enabled by
default):

- **Frame skipping:** Corrupted frames are skipped instead of causing complete
  failure
- **LZW error recovery:** Continues decoding remaining frames even if LZW
  decompression fails for one frame
- **Multi-frame resilience:** Animated GIFs with some corrupted frames can still
  be decoded and displayed
- **Configurable:** Can be disabled via `GIFDecoderOptions` for strict
  validation

## Implementation Details

- **Decoder/Encoder files:** `src/formats/gif.ts`, `src/utils/gif_decoder.ts`,
  `src/utils/gif_encoder.ts`, `src/utils/lzw.ts`.
- **Tests:** `test/formats/gif.test.ts`, `test/formats/gif_tolerant.test.ts`,
  `test/multiframe.test.ts`.
- **LZW Algorithm:** Standard LZW with clear codes and dictionary management up
  to 12-bit codes (4096 entries).
- **Color Quantization:** Median cut algorithm for palette generation from
  true-color images.
- **Interlacing:** Four-pass Adam7-style interlacing for progressive loading.

## Features

- **Complete LZW implementation:** Both compression and decompression with
  proper clear code and end-of-information code handling.
- **Metadata support:** Extracts comments and XMP data from extension blocks.
- **Animation support:** Full support for animated GIFs with proper frame timing
  and disposal methods.
- **Quality control:** Configurable delay times and disposal methods for
  animated GIFs.
- **Fault tolerance:** Gracefully handles corrupted frames in multi-frame GIFs.
