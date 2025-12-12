# Agents quick checklist

This repo uses cross-org reusable CI for Deno, Bun, and Node. Make your changes
pass the same checks locally.

Source of truth:

- Deno CI:
  https://github.com/cross-org/workflows/blob/main/.github/workflows/deno-ci.yml
- Bun CI:
  https://github.com/cross-org/workflows/blob/main/.github/workflows/bun-ci.yml
- Node CI:
  https://github.com/cross-org/workflows/blob/main/.github/workflows/node-ci.yml

Repo CI inputs (`.github/workflows/tests.yaml`):

- Deno: entrypoint=mod.ts, lint_docs=false, allow_outdated=false
- Bun: jsr deps set; no npm deps
- Node: jsr deps set; no npm deps; test_target: test/*.test.ts

Do before you commit:

- **Always run**:
  `deno fmt --check && deno lint && deno check mod.ts && deno check test/*.test.ts`
- **Always use `test()` from `@cross/test` instead of `Deno.test` for
  cross-runtime compatibility**
- **Always update CHANGELOG.md with lean bullets under `## [Unreleased]` for any
  user-facing changes**
- Deno: deno test -A; deno run -A jsr:@check/deps (no outdated deps allowed
  here)
- Bun: tests run with bun test after jsr/npm deps install
- Node (18/20/22): tests run with tsx; ESM required (package.json
  {"type":"module"})

Use the precommit task to validate before committing:

- Run: `deno task precommit`

Keep in mind:

- Don't break the public entrypoint (mod.ts). If you change it, update
  tests.yaml.
- Prefer minimal diffs and stable public APIs.
- New deps must resolve via JSR/NPM across Deno/Bun/Node.
- Keep this file (AGENTS.md) lean if requested to add stuff.
- **Always consider performance when implementing pure JS implementations** -
  This library uses pure JavaScript codecs; avoid unnecessary allocations,
  prefer typed arrays, minimize loops, and benchmark critical paths.

Docs:

- Lives in docs/ (Lumocs). Keep README concise; link to docs pages.
- **Always update both README.md and docs/ when making changes to formats,
  features, or APIs.**
- If CI flips lint_docs=true, also run: deno doc --lint mod.ts

Network access (Copilot workspace):

- har.io, npmjs.org, registry.npmjs.org, deno.land, jsr.io
- github.com, raw.githubusercontent.com, bun.sh, wikipedia.org
