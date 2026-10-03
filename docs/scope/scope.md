# Scope: @ics-ai/copilot-api-sdk

`@ics-ai/copilot-api-sdk` is a minimal private TypeScript package that exports one function, `sum(a: number, b: number)`. It serves any JavaScript or TypeScript project that installs it from a tarball with npm and imports it, whether that project uses `import` (ESM) or `require` (CommonJS). It is never published to a registry.

**Build approach:** Skateboard (ship the smallest complete package someone would actually install, then grow it).
**Workflow:** GA (after develop: check verify, then test, then a fresh model check review, then document). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but you can skip it when you already know the build. Any feature can carry its own tag (for example `· Alpha`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

_There is no data model or design system foundation. The package has no persistence and no UI._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | sum function & dual format package | Release 1 | in-progress |
| 4 | Tarball install check | Release 1 | in-progress |
| 5 | README & usage | Release 1 | planned |

## Foundations

### 1. Stack & architecture
Decide the package manager, TypeScript setup, how the package builds to both ESM and CommonJS with type declarations, and the test runner, then scaffold a runnable project.
**Done when:** the stack and the `package.json` exports shape are recorded in a spec, and the empty scaffold builds and runs its (empty) tests locally.
spec [0001](../specs/0001-typescript-dual-package-stack.md) · code in `src/`
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture`

### 2. Coding standards & tooling
Capture conventions from the real scaffolded project, then install lint, format, and type strictness enforcement.
**Done when:** root `AGENTS.md` reflects the real stack, and lint, format, and typecheck run clean.
code in `biome.json`, `tsconfig.json`, `vitest.config.ts`
- [x] Capture conventions + tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`

## Release 1: Installable tarball

The smallest usable whole: a tarball a consumer installs with npm that works with both `import` and `require`, with types, and a README that tells them how.

### 3. sum function & dual format package
The one exported function plus the package entry points, so ESM and CommonJS consumers both resolve the right build and TypeScript consumers get types.
**Done when:** `sum(1, 2)` returns `3`; `import { sum }` and `const { sum } = require(...)` both work; type declarations resolve for ESM and CJS TypeScript consumers; there is no runtime input check (types only, by your choice).
spec [0002](../specs/0002-sum-function-dual-format.md) · code in `src/sum/`
- [x] Design it (spec): `/architect sum function & dual format package`
- [x] Build it: `/develop sum function & dual format package`
  - [x] `SumFn` type and its `./types` re export (AC-3)
  - [x] `sum` with TSDoc on its `+` semantics, re exported from the root (AC-1, AC-4)
  - [x] First unit test, `passWithNoTests` removed, build checks green (AC-1, AC-2, AC-3)
- [x] Verify it: `/check verify sum function & dual format package`
- [x] Test it: `/test sum function & dual format package`
- [x] Review it (fresh model): `/check review sum function & dual format package`
- [x] Document it: `/document sum function & dual format package`

### 4. Tarball install check
Prove the packed tarball works the way a real consumer uses it, not just inside this repo.
**Done when:** `pnpm pack` (which runs the build, publint, and arethetypeswrong) produces a tarball containing only the built files and `package.json`; installing it into a local, gitignored `sandbox/` ESM project and running its demo prints `3` from `sum(1, 2)`, checked by hand; nothing under `sandbox/` is committed.
spec [0003](../specs/0003-tarball-install-sandbox.md)
- [x] Design it (spec): `/architect tarball install check`
- [ ] Build it: `/develop tarball install check`
  - [ ] Ignore `sandbox/` in `.gitignore` (AC-4)
  - [ ] Local sandbox files: `package.json`, `demo.ts`, `README.md` (AC-1, AC-2, AC-3)
  - [ ] Hand run: pack, install, see `3`, clean `git status`, tarball file list (AC-1 to AC-5)
- [ ] Verify it: `/check verify tarball install check`
- [ ] Test it: `/test tarball install check`
- [ ] Review it (fresh model): `/check review tarball install check`
- [ ] Document it: `/document tarball install check`

### 5. README & usage
Tell consumers how to install from the tarball and use it from both module styles.
**Done when:** the README covers building the tarball, installing it with npm, and `import` and `require` examples in JS and TS.
- [ ] Write it: `/develop README & usage`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Tarball distribution**: where consumers get the tarball (CI artifact, shared location) and how it is built there · needs a decision
- **Runtime input validation**: throw on non number input from plain JS callers, if types only proves too loose · needs a decision
- **Versioning & changelog**: how versions are bumped and changes recorded across tarball releases
- **Automated consumer matrix**: scripted CJS runtime, TS `nodenext` and `bundler`, and Node 22 consumer checks against the tarball (from spec 0003; picks up spec 0001 and 0002 follow ups) · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
