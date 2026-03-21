# Bun Bug Report: `CompressionStream` / `DecompressionStream` hangs with `"deflate"` format

## Summary

`CompressionStream("deflate")` and `DecompressionStream("deflate")` hang indefinitely in Bun when
piped through `Response` streams. The same code works correctly in Deno and Node.js.

## Minimal reproduction

```ts
const data = new Uint8Array([1, 2, 3, 4, 5]);

// Compress
const compressStream = new Response(data).body!
  .pipeThrough(new CompressionStream("deflate"));
const compressed = new Uint8Array(await new Response(compressStream).arrayBuffer());

console.log("compressed:", compressed.length, "bytes");

// Decompress
const decompressStream = new Response(compressed).body!
  .pipeThrough(new DecompressionStream("deflate"));
const decompressed = new Uint8Array(await new Response(decompressStream).arrayBuffer());

console.log("decompressed:", decompressed);
```

Save as `repro.ts` and run:

```sh
bun run repro.ts   # hangs indefinitely
deno run repro.ts  # works
node --experimental-strip-types repro.ts  # works
```

## Expected behaviour

The script prints the compressed size and the round-tripped data, then exits.

## Actual behaviour

The script hangs on the first `await new Response(compressStream).arrayBuffer()` and never
completes. No error is thrown.

## Environment

- **Bun version:** (output of `bun --version`)
- **OS:** Ubuntu (GitHub Actions `ubuntu-latest`)
- **Arch:** x86_64

## Impact

Any library that uses the standard `CompressionStream` / `DecompressionStream` Web API with the
`"deflate"` format cannot work in Bun. This affects PNG, APNG, ICO, and TIFF (Deflate) encoding and
decoding in [`@cross/image`](https://github.com/cross-org/image).
