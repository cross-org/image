# TODO — Project Review Findings

Comprehensive code review of the `@cross/image` library. Findings are ordered from most to least
severe. Each entry includes the relevant file(s), a description of the problem, and a suggested fix.

---

## 🟡 Medium

### M5 — `src/utils/lzw.ts:74` — LZW `decompress` accumulates output in a `number[]`, using ~9× peak memory

~~The decoder collects decoded bytes in a JS `number[]` (8 bytes per element), then converts to
`new Uint8Array(output)` at the end. Peak memory is 9× the final output size. For large GIFs this is
significant.~~ **Fixed:** `decompress()` now uses a growable `Uint8Array` buffer.

---

### M6 — `src/formats/tiff.ts:275` and `encodeFrames:562` — TIFF encoder accumulates output in a `number[]`

~~Both single-frame and multi-frame TIFF encoding builds the full output as `number[]` then converts
to `Uint8Array`. For a 4K RGBA image (4096×2160) the intermediate array holds ~35 million JS numbers
(~280 MB), followed by a ~35 MB `Uint8Array`. Peak memory is roughly 9× the final file.~~ **Fixed:**
Both `encode()` and `encodeFrames()` now build pixel data directly from compressed `Uint8Array`
chunks, with only the small IFD section in a `number[]`.

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

The API docs for `encodeFrames` do not warn about any performance characteristics or limitations of
encoding large TIFF files.

---

## Summary

| ID | File                            | Lines    | Category            | Severity   |
| -- | ------------------------------- | -------- | ------------------- | ---------- |
| M5 | `src/utils/lzw.ts`              | 74       | Memory              | **Medium** |
| M6 | `src/formats/tiff.ts`           | 275, 562 | Memory              | **Medium** |
| L1 | `src/formats/png.ts`            | —        | Correctness         | **Low**    |
| L2 | `src/formats/pam.ts`            | 136–144  | API / Documentation | **Low**    |
| L3 | `src/utils/image_processing.ts` | 106–135  | Performance         | **Low**    |
| L4 | `src/utils/gif_decoder.ts`      | 342–344  | Robustness          | **Low**    |
| L6 | `test/`                         | —        | Test coverage       | **Low**    |
| L7 | `test/`                         | —        | Test coverage       | **Low**    |
| L8 | `docs/`                         | —        | Documentation       | **Low**    |
