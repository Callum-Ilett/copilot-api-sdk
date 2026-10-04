# 0001. TypeScript dual format package stack

**Date**: 2026-10-03
**Status**: Accepted

## Summary

`@ics-ai/copilot-api-sdk` is a private TypeScript package, built with tsdown and managed with pnpm, that ships both an ESM build (for `import`) and a CommonJS build (for `require`), each with its own type declarations. It has two public entry points: the root (`sum` and future functions) and `/types` (shared type aliases like `SumFn`). Tests run on Vitest, and every build checks the package's exports with publint and arethetypeswrong so a broken entry point never reaches a tarball. This spec fixes the tools and the `package.json` shape; the scaffold task builds from it.

## Context

The package is installed from a tarball with npm, never from a registry, by any JavaScript or TypeScript project, whether it uses `import` (ESM) or `require` (CommonJS). Consumers run Node 22 or newer. TypeScript consumers must get correct types under both module styles, and the engineer wants types importable from a separate subpath (`@ics-ai/copilot-api-sdk/types`) rather than the root.

Dual format packages fail in quiet ways: types that describe ESM while the runtime file is CommonJS (TypeScript calls this "masquerading"), an `exports` map pointing at files the build never wrote, or a tarball that leaks source and test files. None of these show up inside the repo; they show up in a consumer's project. The stack has to make these mistakes hard to make and cheap to detect.

The team is small and the package starts tiny (one function), so tooling cost matters more than raw capability. Lint and format belong to feature 2 (Coding standards & tooling). Distribution, CI, and versioning are deferred in the scope.

## Options considered

### Option 1: pnpm + tsdown + Vitest, dual build with per format declarations

tsdown (a library bundler built on Rolldown and Oxc) emits ESM, CommonJS, and matching `.d.ts` / `.d.cts` declarations in one pass, and runs publint plus arethetypeswrong after each build. pnpm manages dev dependencies; Vitest runs tests.

**Pros**:
- One config produces every output file, with per format declarations, so the exports map stays honest.
- Exports validation runs on every build, not as a step someone forgets.
- Installed skills already cover pnpm, tsdown, Vitest, and publint.

**Cons**:
- tsdown is young and moves fast; minor releases can change defaults (file extensions changed across versions).
- tsdown treats CommonJS output as maintenance only, so CJS edge cases will not get new fixes.

### Option 2: npm + plain `tsc` twice + `node:test`

Run the TypeScript compiler once for ESM and once for CommonJS, hand write the `.cjs` / `.d.cts` renames, and test with Node's built in runner.

**Pros**:
- Fewest dependencies; nothing between source and output but the compiler.
- npm matches what consumers use.

**Cons**:
- The renaming and nested `package.json` shims for dual output are hand rolled and easy to get subtly wrong.
- No type tests and thinner assertions; exports validation must be wired separately.

### Option 3: ESM only, relying on Node's `require(esm)`

Ship a single ESM build; CommonJS callers on Node 20.19+ / 22.12+ `require` it natively.

**Pros**:
- One build, one declaration set, no dual package hazard; the direction tsdown itself recommends.

**Cons**:
- Breaks tooling that still loads CommonJS its own way (older Jest setups, some bundler configs), which contradicts the scope's "works with `require`" contract.
- CommonJS TypeScript consumers under `node16` resolution get weaker guarantees.

## Decision

**Chosen option**: Option 1: pnpm + tsdown + Vitest, dual build with per format declarations

Build `@ics-ai/copilot-api-sdk` with tsdown into ESM and CommonJS outputs with per format declarations for two entries (`.` and `./types`), declared through an exports only `package.json`, validated by publint and arethetypeswrong on every build, and tested with Vitest.

**Implementation skills**: `tsdown` (`.agents/skills/tsdown/`) · `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `publint` (`publint/publint`, `.agents/skills/publint-package-export-validation-skill-for-npm-release-checks/`)

## Rationale

The forces that decide this are the quiet failure modes of dual packages and the small team. Option 1 is the only one where the outputs, the declarations, and the checks all come from one tool's config, so the exports map is checked against real files on every build instead of trusted. Option 2 saves dependencies but moves the riskiest part (dual output naming) into hand written glue. Option 3 is simpler and is where the ecosystem is heading, but the scope promises `require` support to any consumer, and "works on new Node" is weaker than "ships a native CommonJS build".

Option 1's main risk is tsdown's pace of change. The spec handles it by pinning file extensions explicitly (never relying on defaults), committing the lockfile, and letting attw fail the build if an upgrade changes what gets emitted.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript, latest stable release, exact version locked | Every tool (tsdown declarations, editors, Vitest) agrees on one compiler. |
| Typecheck config | `module: "preserve"`, `moduleResolution: "bundler"`, strict plus extras (below) | tsdown resolves and bundles every import, so source never ships unbundled; strictness is cheapest while the codebase is empty. |
| Dev runtime | Node 24 LTS, pinned in `.nvmrc` | Active LTS; tsdown itself needs Node 22.18+ to run. |
| Consumer runtime floor | Node 22+ (`engines.node: ">=22"`), build target `node22` | Only maintained LTS lines; lets output use ES2023 syntax. |
| Package manager | pnpm (current major, v12 at time of writing), pinned via `packageManager` + Corepack | Strict resolution stops phantom dependencies; exact version for every contributor. |
| Dependency ranges | Caret ranges, `pnpm-lock.yaml` committed | Reproducible installs from the lockfile without manual pinning of every dev tool. |
| Build | tsdown | One pass for ESM, CJS, and per format declarations; built in exports validation. |
| Module formats | Dual: ESM (`.js`) + CommonJS (`.cjs`) | Native build for both `import` and `require`, per the scope. |
| Declarations | Per format: `.d.ts` (ESM), `.d.cts` (CJS), generated via `isolatedDeclarations` | Each format gets types that match its runtime, so no masquerading. |
| Entry points | `.` → `src/index.ts`; `./types` → `src/types/index.ts` | Engineer's choice: functions from the root, types from `/types`; the root does not re export types. |
| Exports validation | publint + arethetypeswrong (`@arethetypeswrong/core`), run by tsdown after each build, profile `node16` | Catches manifest mistakes and type resolution bugs before a tarball exists; `node16` because legacy `node10` resolution is unsupported by design (exports only). |
| Tests | Vitest (current major), tests in `tests/**/*.test.ts` | Native ESM + TypeScript, built in type assertions for later type tests. |
| Import alias | `@/*` → `src/*`, defined once in `tsconfig.json` `paths` | One way to import source from anywhere (code and tests), no `../` chains; Vitest and tsdown both read it from tsconfig, so there is a single source. |
| Lint & format | Biome (`biome.json`), chosen in feature 2 | Recorded in root `AGENTS.md` under Tooling; it also blocks `../` imports in favour of `@/*`. |
| Version control | git, initialised by the scaffold | Lockfile committed from day one; workflow skills rely on diffs. |
| Distribution | `npm pack` locally; CI and sharing deferred | Per the scope's Deferred list. |

### Package contract

`package.json` (fields this spec fixes; others as tooling needs):

```json
{
  "name": "@ics-ai/copilot-api-sdk",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "engines": { "node": ">=22" },
  "packageManager": "pnpm@<exact version at scaffold time>",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./types": {
      "import": { "types": "./dist/types.d.ts", "default": "./dist/types.js" },
      "require": { "types": "./dist/types.d.cts", "default": "./dist/types.cjs" }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepack": "pnpm build"
  }
}
```

- No top level `main`, `module`, or `types` (engineer's choice: exports only).
- `private: true` makes `npm publish` refuse while `npm pack` still works.
- `types` condition always comes first inside each condition object (TypeScript reads the first match).
- `./types` is built as a real entry, so it ships near empty `types.js` / `types.cjs` files. A consumer writing `import { SumFn }` without `import type` still resolves at runtime.

`tsdown.config.ts` essentials:

- `entry: { index: "src/index.ts", types: "src/types/index.ts" }`
- `format: ["esm", "cjs"]`, `platform: "node"`, `target: "node22"`, `dts: true`
- `outExtensions`: ESM → `{ js: ".js", dts: ".d.ts" }`, CJS → `{ js: ".cjs", dts: ".d.cts" }`. Pinned explicitly because tsdown's default extensions have changed across versions; the exports map above depends on these exact names.
- `sourcemap: false`, `minify: false`, `clean: true`, `outDir: "dist"`
- `publint: true`, `attw: { profile: "node16", level: "error" }`

`tsconfig.json` essentials (typecheck only, `noEmit: true`; tsdown does the emitting):

- `target` / `lib`: `ES2023`; `module: "preserve"`; `moduleResolution: "bundler"`; `moduleDetection: "force"`
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `isolatedDeclarations` + `declaration: true`, `skipLibCheck`
- `paths`: `{ "@/*": ["./src/*"] }`, the only place the alias is defined
- `include`: `src`, `tests`, `tsdown.config.ts`, `vitest.config.ts`

`vitest.config.ts` essentials: `resolve: { tsconfigPaths: true }` (reads the `@/*` alias from `tsconfig.json`), `include: ["tests/**/*.test.ts"]`, `passWithNoTests: true` (engineer's choice for the empty scaffold; see Follow up).

tsdown resolves `@/*` from `tsconfig.json` when it bundles. The built `.d.ts` / `.d.cts` files must not contain `@/` specifiers, since consumers cannot resolve them; attw fails the build if one leaks.

Other scaffold files: `.nvmrc` (`24`), `.gitignore` (`node_modules`, `dist`, `*.tgz`, `coverage`), `src/index.ts` and `src/types/index.ts` as empty modules (`export {}`) until feature 3 fills them. Unit tests in `tests/` mirror the feature folders (`tests/sum/sum.test.ts`) and import source through `@/*`, never by relative path; testing the built tarball belongs to feature 4.

## Consequences

**Positive**:
- `import` and `require` consumers each load a native build with matching types; arethetypeswrong proves it on every build.
- The tarball holds only `dist/` plus `package.json` (npm always adds README/LICENSE if present), and cannot be published by accident.
- Adding a future entry point (as the package grows into an API SDK) is one `entry` key plus one `exports` block.

**Negative / tradeoffs**:
- TypeScript consumers must use `moduleResolution` `node16`, `nodenext`, or `bundler`; projects on legacy `node10` resolution cannot find the types (exports only, no `types` fallback).
- Two builds mean a dual package hazard (ESM and CJS copies loaded side by side). Harmless while the package is stateless; it matters if it ever holds module level state or uses `instanceof` checks across consumers.
- `isolatedDeclarations` requires explicit return and type annotations on every export.
- Dev Node (24) is newer than the consumer floor (22), so the repo's own runs do not prove Node 22 support; feature 4 must.
- tsdown's CJS support is maintenance only; a future CJS edge case may need a workaround rather than a fix.
- `exports` is hand written and must be updated alongside `entry`; the build's publint/attw checks catch drift, but only when both are wrong in a detectable way.
- Corepack ships with Node 24 but is being removed from later Node releases; moving dev Node past 24 means installing Corepack separately.

**Neutral**:
- Lint and format land in feature 2, so the scaffold is briefly unlinted.
- Contributors run `corepack enable` once so the pinned pnpm is used.

## Follow-up

- [ ] Remove `passWithNoTests` from `vitest.config.ts` when feature 3 adds its first test; left on, a deleted or misplaced test suite passes silently.
- [ ] Feature 4 (tarball install check): run the consumer projects on Node 22 (the floor) as well as 24, and cover TypeScript consumers on both `nodenext` and `bundler` resolution, importing both `.` and `./types`.
- [x] The scope header still calls this the "sum package"; the package is `@ics-ai/copilot-api-sdk`. Worth a `/scope` pass to align the name.
- [x] No root `AGENTS.md` yet. When `/audit` (feature 2) creates it, record this stack, the skills `tsdown`, `pnpm`, `vitest`, `publint` under `## Agent skills`, and under `Declined:` Agent Skill / MCP discovery for arethetypeswrong and tsconfig (declined 2026-10-03).
- [x] `biome` is installed as a skill; feature 2 decides whether it becomes the lint/format tool. (Decided: Biome is the lint and format tool.)
