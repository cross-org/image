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
- ⚠️ Chroma subsampling - **only 4:4:4 tested, 4:2:2 and 4:2:0 partially
  supported**

### Encoder (Baseline DCT)

- ✅ Baseline DCT JPEG (SOF0) - **fully implemented**
- ✅ Huffman encoding (standard tables) - **fully implemented**
- ✅ Quantization (quality adjustable) - **fully implemented**
- ✅ DCT (Discrete Cosine Transform) - **fully implemented**
- ✅ RGB to YCbCr color conversion - **fully implemented**
- ✅ JFIF (APP0) marker with DPI - **fully implemented**
- ✅ EXIF (APP1) metadata injection - **author, description, copyright, creation
  date**
- ✅ Quality parameter (1-100) - **fully implemented**
- ❌ Progressive JPEG encoding - **not yet implemented**
- ❌ Optimized Huffman tables - **uses standard tables only**
- ❌ Chroma subsampling (4:2:2, 4:2:0) - **currently uses 4:4:4 only**
- ❌ Arithmetic coding - **not yet implemented**

This produces valid baseline DCT JPEG files that decode correctly across all
platforms and are compatible with all major image viewers and browsers.

## Architecture Overview

### File Structure

```
src/formats/jpeg.ts         - Format handler (canDecode, decode, encode)
src/utils/jpeg_decoder.ts   - Pure-JS baseline JPEG decoder
src/utils/jpeg_encoder.ts   - Pure-JS baseline JPEG encoder
test/jpeg.test.ts           - JPEG format tests
test/purejs_roundtrip.test.ts - Roundtrip tests for pure-JS implementation
```

### Decoder Flow

1. **Parse JPEG structure** (markers and segments)
   - SOI (Start of Image): 0xFF 0xD8
   - APP0 (JFIF): 0xFF 0xE0 - DPI and version info
   - APP1 (EXIF): 0xFF 0xE1 - Extended metadata
   - DQT (Define Quantization Table): 0xFF 0xDB
   - DHT (Define Huffman Table): 0xFF 0xC4
   - SOF0 (Start of Frame): 0xFF 0xC0 - Image dimensions and components
   - DRI (Define Restart Interval): 0xFF 0xDD - Optional restart markers
   - SOS (Start of Scan): 0xFF 0xDA - Start of image data
   - EOI (End of Image): 0xFF 0xD9

2. **Decode compressed data**
   - Read Huffman-encoded bitstream
   - Decode DC and AC coefficients
   - Dequantize using quantization tables
   - Apply IDCT to get spatial-domain values
   - Handle byte stuffing (0xFF 0x00)
   - Process restart markers if present

3. **Color space conversion**
   - Convert YCbCr to RGB (for color images)
   - Apply grayscale directly (for grayscale images)
   - Handle chroma subsampling if present

4. **Output RGBA data**
   - Level shift (add 128 to bring values to 0-255 range)
   - Clamp values to 0-255
   - Set alpha channel to 255 (fully opaque)

### Encoder Flow

1. **Color space conversion**
   - Convert RGB to YCbCr
   - Apply level shift (subtract 128)
   - Process in 8x8 blocks (MCUs)

2. **Transform and quantize**
   - Apply forward DCT to each 8x8 block
   - Quantize coefficients using quality-adjusted tables
   - Separate DC and AC coefficients

3. **Huffman encoding**
   - Encode DC coefficients (differential coding)
   - Encode AC coefficients (run-length encoding)
   - Use standard Huffman tables
   - Apply byte stuffing (insert 0x00 after 0xFF)

4. **Write JPEG structure**
   - SOI marker
   - APP0 (JFIF) with DPI
   - APP1 (EXIF) with metadata (if present)
   - DQT (quantization tables)
   - SOF0 (frame header)
   - DHT (Huffman tables)
   - SOS (scan header)
   - Compressed image data
   - EOI marker

## Current Limitations

### 1. Progressive JPEG

**Status:** Not supported in pure-JS decoder\
**Impact:** Progressive JPEGs fall back to ImageDecoder API\
**Frequency:** ~10-20% of JPEGs in the wild

Progressive JPEGs use multiple scans with increasing quality. The decoder would
need to:

- Handle multiple SOS (Start of Scan) segments
- Decode coefficients in spectral selection order
- Support successive approximation
- Accumulate data across multiple scans

### 2. Chroma Subsampling

**Status:** Encoder uses 4:4:4 (no subsampling)\
**Impact:** Larger file sizes than necessary\
**Potential improvement:** 20-30% smaller files with 4:2:0 subsampling

Common subsampling schemes:

- **4:4:4** (current): Full chroma resolution - highest quality, largest size
- **4:2:2**: Half horizontal chroma resolution - good quality, medium size
- **4:2:0**: Half horizontal and vertical chroma resolution - most common,
  smallest size

### 3. Optimized Huffman Tables

**Status:** Uses standard Huffman tables\
**Impact:** Slightly larger file sizes\
**Potential improvement:** 5-10% smaller files with optimized tables

The encoder could analyze the image data and generate optimal Huffman tables
for:

- DC luminance coefficients
- AC luminance coefficients
- DC chrominance coefficients
- AC chrominance coefficients

### 4. Arithmetic Coding

**Status:** Not supported\
**Impact:** Cannot decode arithmetic-coded JPEGs (rare)\
**Frequency:** <1% of JPEGs in the wild

Arithmetic coding can provide ~5-10% better compression than Huffman coding but
is rarely used due to patent concerns (now expired) and limited decoder support.

## Testing Strategy

### Current Test Coverage

✅ **Unit Tests** (`test/jpeg.test.ts`):

- Signature detection
- Small image encoding/decoding (2x2, 1x1)
- Larger image encoding/decoding (10x10, 50x50, 100x100)
- Metadata preservation (DPI, EXIF fields)
- Format auto-detection
- Image class integration

✅ **Roundtrip Tests** (`test/purejs_roundtrip.test.ts`):

- Gradient images (50x50) - tests lossy compression quality
- Approximate equality checking (tolerance for JPEG compression)

### Testing Edge Cases

To add when implementing new features:

1. **Progressive JPEG**:
   - Multiple scan progressions
   - Different spectral selections
   - Successive approximation levels

2. **Chroma Subsampling**:
   - 4:2:2 horizontal subsampling
   - 4:2:0 horizontal and vertical subsampling
   - Edge cases with odd dimensions

3. **Optimized Huffman**:
   - Images with varying color distributions
   - Verification that optimized tables decode correctly

## Implementation Roadmap

### Phase 1: Documentation and Stability ✅

- ✅ Document current baseline implementation
- ✅ Verify all tests passing
- ✅ Document limitations clearly
- ✅ Add implementation notes

### Phase 2: Enhanced Decoder (Progressive JPEG)

**Priority:** MEDIUM\
**Difficulty:** HIGH\
**Benefit:** Support ~10-20% more JPEGs natively

Implementation steps:

1. Detect progressive JPEG (SOF2 marker)
2. Parse multiple SOS segments
3. Implement spectral selection
4. Implement successive approximation
5. Accumulate and merge scan data
6. Test with real progressive JPEGs

**Estimated effort:** 3-5 days

### Phase 3: Chroma Subsampling

**Priority:** MEDIUM\
**Difficulty:** MEDIUM\
**Benefit:** 20-30% smaller file sizes

Implementation steps:

1. Add sampling factor configuration to encoder
2. Implement 4:2:2 subsampling (horizontal)
3. Implement 4:2:0 subsampling (horizontal + vertical)
4. Adjust MCU processing for subsampled components
5. Test with various image sizes
6. Update decoder to handle all subsampling modes

**Estimated effort:** 2-3 days

### Phase 4: Optimized Huffman Tables

**Priority:** LOW\
**Difficulty:** MEDIUM\
**Benefit:** 5-10% smaller file sizes

Implementation steps:

1. Implement frequency counting pass
2. Build optimal Huffman trees from frequencies
3. Generate code tables from trees
4. Write custom DHT segments
5. Test with various image types
6. Benchmark size improvements

**Estimated effort:** 2-3 days

## Performance Considerations

### Current Performance

- **Decoder**: ~10-50ms for typical images (depends on size and complexity)
- **Encoder**: ~20-100ms for typical images (depends on size and quality)
- **Memory**: O(width × height × 4) for RGBA buffer + O(blocks) for DCT

### Optimization Opportunities

1. **IDCT/DCT optimization**: Use fixed-point arithmetic or lookup tables
2. **Huffman decoding**: Use table-based decoding instead of tree traversal
3. **Block processing**: Process multiple blocks in parallel (Web Workers)
4. **Memory allocation**: Reuse buffers instead of allocating new ones

For the initial implementation, correctness is prioritized over performance. The
pure-JS implementation is already fast enough for most use cases, and native
APIs (ImageDecoder) provide excellent performance when available.

## Compatibility Notes

### Runtime Support

| Runtime  | Pure-JS Baseline | ImageDecoder API |
| -------- | ---------------- | ---------------- |
| Deno 2.x | ✅ Full          | ✅ Full          |
| Node 18  | ✅ Full          | ❌ Not available |
| Node 20+ | ✅ Full          | ⚠️ Partial*      |
| Bun      | ✅ Full          | ✅ Full          |

\* Node.js 20+ has experimental ImageDecoder support that may require specific
flags or versions. The pure-JS implementation provides a reliable fallback.

### Browser Support

All modern browsers support:

- ✅ Baseline DCT JPEG
- ✅ Progressive JPEG
- ✅ All chroma subsampling modes

The pure-JS implementation ensures cross-runtime compatibility, while native
APIs provide optimal performance where available.

## Resources

- [JPEG Standard (ITU-T T.81)](https://www.w3.org/Graphics/JPEG/itu-t81.pdf)
- [JFIF Specification](https://www.w3.org/Graphics/JPEG/jfif3.pdf)
- [EXIF Specification](http://www.cipa.jp/std/documents/e/DC-008-2012_E.pdf)
- [libjpeg source code](https://github.com/libjpeg-turbo/libjpeg-turbo)
  (reference C implementation)
- Current implementation: `src/utils/jpeg_decoder.ts`,
  `src/utils/jpeg_encoder.ts`

## Conclusion

The pure-JS JPEG implementation provides solid baseline DCT support that covers
the vast majority of JPEG use cases (~80-90% of JPEGs in the wild). The code is
well-tested, produces standards-compliant output, and works across all
JavaScript runtimes.

Future enhancements (progressive JPEG, chroma subsampling, optimized Huffman)
would improve coverage and efficiency but are not critical for the current use
cases. The fallback to native APIs (ImageDecoder, OffscreenCanvas) provides
excellent coverage for edge cases and ensures users always have a working
solution.

The implementation prioritizes:

1. **Correctness** - Produces valid, standards-compliant JPEGs
2. **Compatibility** - Works across Deno, Node.js, and Bun
3. **Simplicity** - Clear, maintainable code over micro-optimizations
4. **Reliability** - Comprehensive tests and graceful fallbacks
