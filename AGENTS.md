# Agents quick checklist

This repo uses cross-org reusable CI for Deno, Bun, and Node. Make your changes
pass the same checks locally.

## CI Configuration

Repo CI inputs (`.github/workflows/tests.yaml`):

- Deno: entrypoint=mod.ts, lint_docs=false, allow_outdated=false
- Bun: jsr deps set; no npm deps
- Node: jsr deps set; no npm deps; test_target: test/*.test.ts

Source of truth:
[Deno](https://github.com/cross-org/workflows/blob/main/.github/workflows/deno-ci.yml)
|
[Bun](https://github.com/cross-org/workflows/blob/main/.github/workflows/bun-ci.yml)
|
[Node](https://github.com/cross-org/workflows/blob/main/.github/workflows/node-ci.yml)

## Precommit Validation

Run: `deno task precommit`

This runs:
`deno fmt --check && deno lint && deno check mod.ts && deno check test/*.test.ts`

Additional checks:

- Deno: deno test -A; deno run -A jsr:@check/deps (no outdated deps)
- Bun: tests run with bun test after jsr/npm deps install
- Node (18/20/22): tests run with tsx; ESM required (package.json
  {"type":"module"})

## Guidelines

- **Use `test()` from `@cross/test` instead of `Deno.test`** for cross-runtime
  compatibility
- **Update CHANGELOG.md** with lean bullets under `## [Unreleased]` for
  user-facing changes
- **Update both README.md and docs/** when making changes to formats, features,
  or APIs
- Don't break the public entrypoint (mod.ts); update tests.yaml if changed
- Prefer minimal diffs and stable public APIs
- New deps must resolve via JSR/NPM across Deno/Bun/Node
- **Consider performance:** avoid unnecessary allocations, prefer typed arrays,
  minimize loops, and benchmark critical paths
- If CI flips lint_docs=true: run deno doc --lint mod.ts
- Keep this file lean

## Docs

Lives in docs/ (Lumocs). Keep README concise; link to docs pages.

## Network Access (Copilot workspace)

har.io, npmjs.org, registry.npmjs.org, deno.land, jsr.io, github.com,
raw.githubusercontent.com, bun.sh, wikipedia.org
