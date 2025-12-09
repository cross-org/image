---
title: "JPEG"
parent: "Implementation Notes"
nav_order: 1
---

# JPEG Pure-JS Implementation Notes

## Current Status

The JPEG format handler implements a **baseline DCT (Discrete Cosine Transform)
encoder and decoder** that works correctly for the most common JPEG images:

### Decoder (Baseline DCT)

- ✅ Baseline DCT JPEG (SOF0) - **fully implemented**
- ✅ Huffman decoding (DC and AC coefficients) - **fully implemented**
- ✅ Quantization table parsing - **fully implemented**
- ✅ IDCT (Inverse Discrete Cosine Transform) - **fully implemented**
- ✅ YCbCr to RGB color conversion - **fully implemented**
- ✅ Grayscale JPEG support - **fully implemented**
- ✅ JFIF (APP0) metadata parsing - **DPI support**
- ✅ EXIF (APP1) metadata parsing - **author, description, copyright, creation
  date**
- ✅ Restart markers (DRI) - **fully implemented**
- ❌ Progressive JPEG (SOF2) - **not yet implemented**
- ❌ Interlaced/progressive scan support - **not yet implemented**
- ❌ Arithmetic coding - **not yet implemented**
- ❌ Lossless JPEG - **not yet implemented**
- ❌ Extended sequential DCT - **not yet implemented**
- ✅ Chroma subsampling - **4:4:4, 4:2:2, and 4:2:0 fully tested and supported**

### Encoder (Baseline DCT)

---
title: "JPEG"
parent: "Implementation Notes"
nav_order: 1
---

# JPEG Pure-JS Implementation Notes

- **Decoder:** baseline DCT (SOF0) implemented. Supports Huffman (DC/AC), DQT,
  IDCT, YCbCr→RGB, grayscale, and chroma subsampling (4:4:4, 4:2:2, 4:2:0).
  Progressive, arithmetic, and lossless JPEGs are not supported.
- **Encoder:** baseline DCT implemented with adjustable quality, standard
  Huffman tables, and JFIF/EXIF marker support. Defaults to 4:4:4 (no
  subsampling). Progressive encoding and optimized Huffman tables are not
  implemented.
- **Metadata:** APP0 (JFIF) and APP1 (EXIF) are parsed and written; orientation
  is preserved in metadata but not auto-applied during decode.
- **Limitations:** no progressive decode/encode, no arithmetic coding, limited
  CMYK/16-bit support.
- **Key files:** `src/formats/jpeg.ts`, `src/utils/jpeg_decoder.ts`,
  `src/utils/jpeg_encoder.ts`.
- **Tests:** `test/formats/jpeg.test.ts`, `test/purejs_roundtrip.test.ts`,
  `test/formats/jpeg_subsampling.test.ts`.
- **Notes:** prioritize correctness and compatibility across runtimes. Future
  work: progressive support, chroma-subsampled encoding, and optimized Huffman
  tables.
