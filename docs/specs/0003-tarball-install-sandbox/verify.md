# Verify: Tarball install check · spec 0003 · updated 2026-10-03
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run everything from the repo root. If you don't have `sandbox/` yet, create its three files from [index.md](index.md) `## Feature design` first.

## UI / manual
- [ ] Read the log from `pnpm -C sandbox ts` → it prints exactly `3` → AC-2
- [ ] Temporarily change `src/sum/` so `sum` returns `a - b`, refresh, run → it prints `-1` (proves the sandbox runs the freshly packed tarball, not a stale copy), then revert → AC-1, AC-2
- [ ] Copy only `sandbox/package.json` and `demo.ts` into an empty folder and run `pnpm -C <folder> ts` → a clear failure (pnpm 12 tries to install first and reports the tarball "does not exist") → AC-1

## Commands
- [ ] `pnpm pack --silent --out sandbox/copilot-api-sdk.tgz && pnpm -C sandbox install --force` → exit 0, `sandbox/copilot-api-sdk.tgz` exists, `+ @ics-ai/copilot-api-sdk 0.1.0` installed → AC-1
- [ ] `pnpm -C sandbox ts` → prints `3` → AC-2
- [ ] `demo.ts` still holds `import type { SumFn } from "@ics-ai/copilot-api-sdk/types"` and `const add: SumFn = sum`, and the run above passed → AC-3
- [ ] `git status --short` → nothing under `sandbox/`; `git check-ignore -v sandbox/demo.ts` → matched by `.gitignore` `sandbox/` → AC-4
- [ ] `git log --all --oneline -- sandbox/` → empty (nothing under `sandbox/` was ever committed) → AC-4
- [ ] `pnpm pack --dry-run` → only `dist/*` files and `package.json` → AC-5

## Value sourcing
- [ ] Tarball path: the pack writes to `sandbox/copilot-api-sdk.tgz` (from `--out`) → AC-1
- [ ] Installed package name: `ls sandbox/node_modules/@ics-ai/copilot-api-sdk` exists, matching root `package.json` `name` → AC-1
- [ ] Which build runs: `node --input-type=module -e "console.log(import.meta.resolve('@ics-ai/copilot-api-sdk'))"` from `sandbox/` → ends in `dist/index.js` (the ESM `import` condition) → AC-2
- [ ] Expected value `3` is written in `sandbox/README.md` `## Run it` → AC-2
- [ ] Node version: `node -v` → note it in the verify report (current Node only, by design) → AC-2

## Acceptance-criteria coverage
- AC-1 covered by the refresh command, the fresh tarball step, the missing tarball step, and the tarball path and package name rows · AC-2 by the run, the stale copy step, and the build file row · AC-3 by the type import step · AC-4 by `git status`, `check-ignore`, and `git log` · AC-5 by `pnpm pack --dry-run`
