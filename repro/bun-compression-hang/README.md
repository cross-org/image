# Bun CompressionStream hang reproduction

Minimal reproduction of `CompressionStream` / `DecompressionStream` hanging in `bun test` on GitHub
Actions CI.

## Issue

When using `CompressionStream("deflate")` or `DecompressionStream("deflate")` via `.pipeThrough()`
inside a `bun test` run, the reader blocks indefinitely and the test times out. This occurs
regardless of how data is fed into the stream (via `new Response(data).body`, or a manual
`ReadableStream` with `controller.enqueue`).

The hang reproduces reliably in GitHub Actions CI with `antongolub/action-setup-bun@v1.13.2` using
`bun-version: v1.x`.

## Reproduce locally

```bash
bun test
```

If the issue is present in your Bun version, the `CompressionStream` and `DecompressionStream` tests
will time out (5 s default).

## Reproduce in CI

Push this repo to GitHub. The workflow at `.github/workflows/test.yml` will run `bun test`
automatically on push / PR.

## Expected behaviour

All four tests should pass in under 100 ms each:

1. `deflateSync / inflateSync roundtrip` — baseline using `node:zlib` (always works)
2. `CompressionStream roundtrip` — deflate via Web Streams API
3. `DecompressionStream roundtrip` — inflate via Web Streams API
4. `pipeThrough deflate + inflate roundtrip` — full pipe chain

## Actual behaviour (affected versions)

Tests 2 – 4 hang until the 5 000 ms timeout and fail.
