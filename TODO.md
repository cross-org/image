# TODO — Project Review Findings

Comprehensive code review of the `@cross/image` library. Findings are ordered from most to least
severe. Each entry includes the relevant file(s), a description of the problem, and a suggested fix.

---

## 🔴 Critical

### C1 — `src/utils/byte_utils.ts:21-24` — `readUint32LE` returns a signed JS integer for values ≥ 0x80000000

JavaScript's bitwise-OR operator always returns a **signed 32-bit integer**. When the high bit of
the fourth byte is set (e.g. a stored value of `0x80000001`), the expression
`data[o] | data[o+1]<<8 | data[o+2]<<16 | data[o+3]<<24` returns a large negative number.

This function is used to read file offsets, chunk sizes, and image dimensions in **BMP, ICO, TIFF,
WebP,** and other decoders. A crafted file can trigger:

- ICO `imageEnd` bounds check passing when `imageEnd` is negative → reads wrong memory region.
- TIFF strip-offset arithmetic producing negative offsets that silently skip data.
- WebP chunk-size loop exiting immediately (negative `pos + chunkSize`), producing an empty image
  with no error.

**Fix:** Add `>>> 0` to convert to unsigned: `return (... | data[o+3]<<24) >>> 0;`

---

### C2 — `src/formats/png_base.ts:15-17` — `readUint32` (big-endian) has the same signed-overflow bug

`(data[offset] << 24)` is negative when bit 31 is set. The `png.ts` decode loop uses the returned
`length` to advance `pos` with `pos += length + 12`. A negative `length` keeps `pos < data.length`
true indefinitely, causing a near-infinite parse loop on a 5-byte crafted PNG — an effective
**CPU-based DoS**.

**Fix:** Add `>>> 0`: `return ((data[o]<<24) | ...) >>> 0;`

---

### C3 — `src/utils/lzw.ts:100,122` — `output.push(...entry)` causes a call-stack overflow on adversarial GIF

LZW dictionary entries are spread into function arguments with `output.push(...entry)`. If an
attacker crafts a GIF whose LZW stream triggers a very long repeated run, the spread collapses the
JS call stack with `RangeError: Maximum call stack size exceeded`, **crashing the runtime process**
instead of returning a clean error. The same pattern appears in `gif_decoder.ts:75`.

**Fix:** Replace `output.push(...entry)` with a simple `for` loop:
`for (const b of entry) output.push(b);`

---

## 🟠 High

### H1 — `src/formats/tiff.ts:654-664` — Double-compression produces wrong `StripByteCounts` for deflate

In multi-frame TIFF encoding, pixel data is compressed once in the first loop (lines 582–596) and
written to the output. The second loop (IFD-writing phase) compresses each frame's data **again**
with a fresh encoder/compressor to obtain `StripByteCounts`. For deflate, the OS-level zlib may
produce a different output length on the second call, writing an `StripByteCounts` tag that does not
match the actual strip, making the TIFF **unreadable by most viewers**.

**Fix:** Cache the compressed result from the first loop (e.g. `compressedFrames[i]`) and reuse
`.length` in the second loop.

---

### H2 — `src/formats/ico.ts:145` — Non-integer `actualHeight` causes `validateImageDimensions` to throw for valid ICO files

```ts
validateImageDimensions(width, Math.abs(height) / 2);
```

For an ICO DIB where the stored `height` field is odd (e.g. 5), `Math.abs(5) / 2 = 2.5`.
`validateImageDimensions` checks `Number.isInteger(height)` and throws, rejecting a perfectly
legitimate ICO file. Even when it does not throw, `new Uint8Array(width * 2.5 * 4)` allocates the
wrong buffer size.

**Fix:** Use `Math.floor`: `validateImageDimensions(width, Math.floor(Math.abs(height) / 2));`

---

### H3 — `src/formats/png.ts:59-70` — No bounds check before reading chunk data in `decode()`

The decode loop reads a 4-byte chunk `length` field without first verifying that at least 8 bytes
remain at `pos`. For a truncated PNG, individual byte reads return `undefined`, silently coercing to
`0`. A very large `length` (e.g. `0x7FFFFFFF`) yields `data.slice(pos, pos + length)` returning an
under-sized slice that is silently mis-parsed with no error thrown.

`extractMetadata()` already has the guard `if (pos + 8 > data.length) break;`; `decode()` should
too.

**Fix:** Add `if (pos + 8 > data.length) break;` at the top of the decode loop in `png.ts`.

---

### H4 — `src/utils/webp_decoder.ts:31-34` — Local `readUint32LE` duplicates `byte_utils.ts` and has the same sign bug

`webp_decoder.ts` defines its own `readUint32LE` using bitwise OR, which returns a signed value for
large chunks. The chunk-size loop `pos += 8 + chunkSize` wraps to a large negative on a crafted
WebP, silently exiting the parse loop and returning an empty (invalid) image. Additionally, the
duplicate implementation risks the two copies drifting out of sync.

**Fix:** Remove the local copy and import `readUint32LE` from `../utils/byte_utils.ts`, then apply
the `>>> 0` fix there (C1).

---

## 🟡 Medium

### M1 — `src/formats/pcx.ts:52-54` — Missing `validateImageDimensions` call; unchecked allocation

PCX decode computes `new Uint8Array(height * scanlineLength)` and
`new Uint8Array(width * height * 4)` using dimensions derived directly from the header, with only a
manual `> 0` check. A crafted PCX with `width=65535, height=65535` would attempt to allocate ~17 GB
of memory.

**Fix:** Add `validateImageDimensions(width, height)` after the dimension calculation on lines
49-50, consistent with all other decoders in the project.

---

### M2 — `src/formats/bmp.ts:260-261` — `readUint32LE` used for signed `xPelsPerMeter`/`yPelsPerMeter` fields in `extractMetadata`

The BMP spec defines `biXPelsPerMeter` / `biYPelsPerMeter` as signed `LONG` fields. `decode()`
correctly uses `readInt32LE`, but `extractMetadata()` uses `readUint32LE` for the same fields. For a
BMP with a negative DPI value, `extractMetadata` returns a large positive DPI value, inconsistent
with `decode()`.

**Fix:** Use `readInt32LE` for DPI fields in `extractMetadata`, matching `decode()`.

---

### M3 — `src/utils/jpeg_decoder.ts:961-996` — O(64²) naive IDCT calls `Math.cos` per element

The IDCT implementation calls `Math.cos((2*j+1)*k*Math.PI/16)` for each of the 64 output
coefficients per 8×8 block. For a 2000×2000 JPEG this is ~200 million `Math.cos` evaluations.
Standard JPEG libraries use a precomputed cosine table (or the AAN 1D IDCT) and run 10–100× faster.

**Fix:** Precompute the 64-entry cosine lookup table as a module-level constant and eliminate all
`Math.cos` calls from the hot path.

---

### M4 — `src/utils/image_processing.ts:718-767` — `medianFilter` allocates 4 arrays per pixel in the inner loop

`rValues`, `gValues`, `bValues`, `aValues` are declared as fresh `number[]` inside the pixel loop.
For a 1000×1000 image with `radius=1` this creates 4 million short-lived arrays, causing GC pressure
and significant slowdown.

**Fix:** Declare the four arrays once outside the pixel loop and reset `length = 0` at the start of
each iteration.

---

### M5 — `src/utils/lzw.ts:74` — LZW `decompress` accumulates output in a `number[]`, using ~9× peak memory

The decoder collects decoded bytes in a JS `number[]` (8 bytes per element), then converts to
`new Uint8Array(output)` at the end. Peak memory is 9× the final output size. For large GIFs this is
significant.

**Fix:** Pre-allocate a `Uint8Array` sized to `width × height` (the expected GIF pixel count) and
write directly into it, or use a `Uint8Array`-backed dynamic buffer.

---

### M6 — `src/formats/tiff.ts:275` and `encodeFrames:562` — TIFF encoder accumulates output in a `number[]`

Both single-frame and multi-frame TIFF encoding builds the full output as `number[]` then converts
to `Uint8Array`. For a 4K RGBA image (4096×2160) the intermediate array holds ~35 million JS numbers
(~280 MB), followed by a ~35 MB `Uint8Array`. Peak memory is roughly 9× the final file.

**Fix:** Build the output as a list of `Uint8Array` chunks and concatenate them at the end with a
single `new Uint8Array(totalLength)` copy.

---

### M7 — `src/utils/image_processing.ts:303` — Misleading comment on hue-rotation normalization

```ts
// Normalize rotation to -180 to 180 range
const rotation = ((degrees % 360) + 360) % 360;
```

This normalizes to **0–360**, not −180 to 180 as the comment states. The logic is correct; the
comment is wrong and will confuse maintainers.

**Fix:** Update the comment to: `// Normalize rotation to 0–360 range`

---

## 🔵 Low

### L1 — `src/formats/png.ts` — PNG chunk CRCs are never verified during decode

Chunk CRCs are silently skipped. A corrupt PNG file can decode with subtly wrong pixel data and no
error. The encode path correctly computes CRCs; parity with the decode path would improve
reliability.

---

### L2 — `src/formats/pam.ts:136-144` — PAM decoder silently rejects valid DEPTH values without documentation

The PAM format supports DEPTH 1 (grayscale), 2 (grayscale+alpha), and 3 (RGB). The implementation
only handles DEPTH=4 (RGBA) and MAXVAL=255, throwing a generic error for everything else. This is an
intentional limitation but is not documented in the JSDoc, so callers receive a confusing error.

**Fix:** Document the DEPTH/MAXVAL constraints in the JSDoc and consider a more descriptive error
message such as `"Only DEPTH=4 MAXVAL=255 PAM files are supported"`.

---

### L3 — `src/utils/image_processing.ts:106-135` — `adjustBrightness` rebuilds the LUT on every call

The 767-entry brightness lookup table depends only on `amount`. It is re-created on every call. For
batch-processing many frames at the same brightness level this is unnecessary work.

**Fix:** Accept the LUT as an optional pre-built parameter, or cache by `amount` with a simple
`Map`.

---

### L4 — `src/utils/gif_decoder.ts:342-344` — Background color uses `|| 0` fallback instead of explicit bounds check

```ts
const bgR = colorTable[backgroundColorIndex * 3] || 0;
```

If `backgroundColorIndex * 3` is out of range, `colorTable[oob]` returns `undefined`, and
`undefined || 0` silently returns 0 (black). This is functionally safe for most images but hides a
potential header-parsing error. An explicit bounds check and warning would aid debugging.

---

### L5 — `src/formats/tiff.ts:656-657` — Dangling redundant encoder instantiation

After fixing H1 (double-compression), the `new TIFFLZWEncoder().compress(frame.data)` call in the
IFD loop will become dead code. Clean it up at that point to avoid confusion.

---

### L6 — `test/` — No adversarial / fuzzing input tests

All tests use well-formed images or programmatically generated valid inputs. There are no tests for
truncated files, wrong-length headers, or near-limit dimensions that exercise the security
validation paths in `validateImageDimensions` and the format decoders.

**Fix:** Add a dedicated `test/security.test.ts` (or equivalent) with crafted inputs for each of the
issues above, asserting that a clean `Error` is thrown rather than a crash or silent mis-decode.

---

### L7 — `test/` — No regression test for the LZW call-stack overflow (C3)

No test exercises the `push(...entry)` code path with a GIF whose LZW dictionary entry grows large
enough to stress the call stack. This makes it easy to reintroduce the bug.

---

### L8 — `docs/` — TIFF multi-frame encode limitations are undocumented

The API docs for `encodeFrames` do not warn that large frame counts with `deflate` compression incur
2× CPU cost (H1), that the full output is built in memory, or that the encoded file may be
unreadable due to the `StripByteCounts` mismatch.

---

## Summary

| ID | File                            | Lines    | Category                      | Severity     |
| -- | ------------------------------- | -------- | ----------------------------- | ------------ |
| C1 | `src/utils/byte_utils.ts`       | 21–24    | Security / DoS                | **Critical** |
| C2 | `src/formats/png_base.ts`       | 15–17    | Security / DoS                | **Critical** |
| C3 | `src/utils/lzw.ts`              | 100, 122 | Security / DoS                | **Critical** |
| H1 | `src/formats/tiff.ts`           | 654–664  | Correctness (data corruption) | **High**     |
| H2 | `src/formats/ico.ts`            | 145      | Correctness                   | **High**     |
| H3 | `src/formats/png.ts`            | 59–70    | Correctness                   | **High**     |
| H4 | `src/utils/webp_decoder.ts`     | 31–34    | Correctness / Duplication     | **High**     |
| M1 | `src/formats/pcx.ts`            | 52–54    | Security / DoS                | **Medium**   |
| M2 | `src/formats/bmp.ts`            | 260–261  | Correctness                   | **Medium**   |
| M3 | `src/utils/jpeg_decoder.ts`     | 961–996  | Performance                   | **Medium**   |
| M4 | `src/utils/image_processing.ts` | 718–767  | Performance                   | **Medium**   |
| M5 | `src/utils/lzw.ts`              | 74       | Memory                        | **Medium**   |
| M6 | `src/formats/tiff.ts`           | 275, 562 | Memory                        | **Medium**   |
| M7 | `src/utils/image_processing.ts` | 303      | Documentation                 | **Medium**   |
| L1 | `src/formats/png.ts`            | —        | Correctness                   | **Low**      |
| L2 | `src/formats/pam.ts`            | 136–144  | API / Documentation           | **Low**      |
| L3 | `src/utils/image_processing.ts` | 106–135  | Performance                   | **Low**      |
| L4 | `src/utils/gif_decoder.ts`      | 342–344  | Robustness                    | **Low**      |
| L5 | `src/formats/tiff.ts`           | 656–657  | Code quality                  | **Low**      |
| L6 | `test/`                         | —        | Test coverage                 | **Low**      |
| L7 | `test/`                         | —        | Test coverage                 | **Low**      |
| L8 | `docs/`                         | —        | Documentation                 | **Low**      |
