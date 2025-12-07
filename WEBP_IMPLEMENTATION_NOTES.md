# WebP VP8L Encoder Implementation Notes

## Current Status

The WebP VP8L (lossless) encoder currently implements a **simplified approach** that works correctly but produces larger files than optimal:

- ✅ Simple Huffman coding (1-2 unique symbols per channel)
- ✅ Literal pixel encoding (uncompressed)
- ❌ Complex Huffman codes (>2 symbols) - **not yet implemented**
- ❌ LZ77 backward references - **not yet implemented**
- ❌ Color cache - **not yet implemented**

This produces valid, lossless WebP files that decode correctly, but without compression.

## Implementation Roadmap

To achieve full compression, three features need to be implemented:

### 1. Complex Huffman Codes

**Priority:** HIGH (required for other features)
**Difficulty:** HIGH (bit-level encoding must match decoder exactly)

Complex Huffman codes are needed when a channel has more than 2 unique symbol values. Implementation requires:

1. Build canonical Huffman codes from symbol frequencies
2. Encode code lengths using RLE compression (codes 16, 17, 18 for runs)
3. Build a secondary Huffman table for the code lengths themselves
4. Write the code length Huffman table
5. Write the RLE-encoded code lengths using the code length Huffman table

**Key Challenge:** The bit-level encoding must exactly match what the decoder expects. Even small mistakes cause "Unexpected end of data" or "Invalid Huffman code" errors.

**Reference Implementation:** See `webp_decoder.ts` methods:
- `readCodeLengths()` - shows expected RLE encoding format
- `buildHuffmanTable()` - shows canonical code generation

### 2. LZ77 Backward References

**Priority:** MEDIUM (significant compression improvement)
**Difficulty:** MEDIUM (depends on complex Huffman)
**Dependencies:** Requires complex Huffman codes

LZ77 encoding finds repeated pixel sequences and encodes them as backward references:

1. Search backwards in the pixel buffer for matches (length ≥ 2 pixels)
2. Encode as: green = 256 + length_symbol, then distance_symbol
3. Length and distance symbols use extra bits for precision
4. Requires complex Huffman since length (0-23) and distance (0-39) have many values

**Implementation Steps:**
1. Add `findLZ77Match(pos, hasAlpha)` method (already stubbed)
2. Implement `getLengthSymbol()` and `getDistanceSymbol()` (already stubbed)
3. Encode LZ77 symbols with proper extra bits
4. Update color cache for copied pixels

**Reference:** See `webp_decoder.ts` lines 307-337 for LZ77 decoding logic.

### 3. Color Cache

**Priority:** LOW (modest compression improvement)
**Difficulty:** LOW (straightforward once Huffman works)
**Dependencies:** Requires complex Huffman codes

Color cache stores recently-seen colors in a circular buffer, allowing repeated colors to be encoded as cache references:

1. Maintain circular buffer of size 2^colorCacheBits (typically 1024)
2. Store colors at position `pixelIndex % cacheSize`
3. Check cache before encoding each pixel
4. If color found at cache index N, encode as: green = 256 + 24 + N
5. Only update cache for literal pixels and LZ77 copies, not cache hits

**Implementation Steps:**
1. Enable color cache in `encodeImageData()` (set useColorCache = true)
2. Maintain `Uint32Array` cache indexed by pixel position
3. Search cache before encoding literal pixels
4. Encode cache hits as green ≥ 280

**Reference:** See `webp_decoder.ts` lines 300-304, 328-334, 338-352 for cache logic.

## Testing Strategy

### Unit Tests
1. Test Huffman code generation with various symbol counts
2. Test RLE encoding of code lengths
3. Test LZ77 match finding with known patterns
4. Test color cache indexing

### Integration Tests  
1. Start with images that have few colors per channel (use simple Huffman)
2. Progress to images with many colors (require complex Huffman)
3. Test images with repeated patterns (benefit from LZ77)
4. Test images with repeated colors (benefit from color cache)

### Debugging Approach
When decode fails:
1. Write encoded bytes to file for inspection with hex editor
2. Add logging to decoder to see where it fails
3. Compare bit patterns with known-good WebP files
4. Test with minimal examples (2x2, 3x3 images)

## Code Organization

**Files to modify:**
- `src/utils/webp_encoder.ts` - Main encoder implementation
- `test/purejs_roundtrip.test.ts` - Add roundtrip tests
- `test/webp.test.ts` - Add unit tests for new features

**Key methods to implement:**
```typescript
// Complex Huffman
private calculateCodeLengths(frequencies, maxSymbol): number[]
private buildCanonicalCodesFromLengths(codeLengths): Map<number, HuffmanCode>
private writeCodeLengths(writer, codeLengths, maxSymbol): void
private writeComplexHuffmanCode(writer, huffmanCodes, maxSymbol): void

// LZ77
private findLZ77Match(pos, hasAlpha): {length, distance}
private getLengthSymbol(length): {symbol, extra, extraBits}
private getDistanceSymbol(distance): {symbol, extra, extraBits}

// Color Cache
private encodeWithColorCache(hasAlpha, colorCacheBits): EncodedSymbol[]
```

## Performance Considerations

- LZ77 match finding can be O(n²) naive, O(n) with hash table
- Color cache lookup is O(1) with direct indexing by position
- Huffman code generation is O(n log n) for tree building

For the initial implementation, correctness is more important than performance.

## Resources

- [WebP Lossless Bitstream Specification](https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification)
- [WebP RIFF Container Specification](https://developers.google.com/speed/webp/docs/riff_container)
- libwebp source code (reference C implementation)
- Current decoder implementation in `src/utils/webp_decoder.ts`

## Conclusion

The infrastructure is in place for implementing these features. The main challenge is ensuring bit-perfect encoding that matches the decoder's expectations, particularly for complex Huffman codes. A methodical, test-driven approach with small incremental changes is recommended.
