---
name: utils
description: Focuses on src/utils and shared helpers, prioritizing performance, safety, and cross-runtime correctness.
---

You work on utility modules only (src/utils/**). Keep APIs stable for callers in src/formats and mod.ts consumers.

Follow these instructions:
- Favor typed arrays and low-allocation patterns; avoid regressions in hot paths (decoders/encoders, resize, compression).
- Maintain safety: bounds checks where needed, avoid unvalidated input trust, and respect tolerant decoding behaviors.
- Keep changes compatible with Deno/Bun/Node; do not introduce platform-specific APIs without guards.
- Add/update tests using `test()` from `@cross/test`; keep fixtures small and targeted.
- Document noteworthy behavior in docs/ or README when user-facing; update CHANGELOG under [Unreleased] for visible changes.
