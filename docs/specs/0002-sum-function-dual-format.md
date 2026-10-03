# 0002. sum function and its dual format entry points

**Date**: 2026-10-03
**Status**: Accepted

## Summary

The package's first real export is `sum(a, b)`, a plain function that returns `a + b`. Its type, `SumFn`, ships from the separate `@ics-ai/copilot-api-sdk/types` entry, and `sum` is typed against it so the two can never drift apart. There is no runtime input check (types are the only guard), and `sum` behaves exactly like JavaScript's `+`. For this feature, the build's export checks (publint and arethetypeswrong) are the proof that both `import` and `require` consumers resolve the right files and types; feature 4 proves a real consumer can call it.

## Context

Spec 0001 fixed the package shape: two entry points (`.` for functions, `./types` for shared type aliases), dual ESM and CommonJS builds, per format declarations, and exports checks on every build. Both entry files are still empty (`export {}`), so the package installs but does nothing. This feature fills them with the one function the scope promises.

The forces are small but real. `AGENTS.md` asks for SOLID classes with constructor injection, folder by feature code under `src/<feature>/`, entry files that only re export, explicit types on every export (`isolatedDeclarations`, meaning each export carries its own type annotation so declarations can be generated without full type inference), and stateless exports because the ESM and CJS copies can load side by side. The scope fixes the signature (`sum(a: number, b: number)`, two arguments) and rules out runtime input checks: plain JavaScript callers who pass the wrong thing get whatever `+` gives them.

The contract also has to be provable without the tarball install tests that `AGENTS.md` keeps out of the suite; that consumer level proof belongs to feature 4.

## Requirements

**User stories**:
- As a consumer using `import`, I want `import { sum } from "@ics-ai/copilot-api-sdk"` to give me a typed `sum` so that I can add two numbers.
- As a consumer using `require`, I want `const { sum } = require("@ics-ai/copilot-api-sdk")` to give me the same function with correct types.
- As a TypeScript consumer, I want `import type { SumFn } from "@ics-ai/copilot-api-sdk/types"` so that I can type my own functions to match `sum`.

**Acceptance criteria**:
- **AC-1**: `sum(1, 2)` returns `3`.
- **AC-2**: The root entry exports `sum` for both module styles: `pnpm build` emits `dist/index.js` + `dist/index.d.ts` (ESM) and `dist/index.cjs` + `dist/index.d.cts` (CJS), and publint plus arethetypeswrong (`node16` profile, level `error`) pass with no problems for the root entry.
- **AC-3**: The `./types` entry exports the type `SumFn = (a: number, b: number) => number` for both module styles, with publint plus arethetypeswrong passing for that entry; `sum` is declared with the type `SumFn`.
- **AC-4**: `sum` performs no runtime input check and returns exactly `a + b`; its TSDoc states that it follows JavaScript `+` semantics (floating point results such as `0.1 + 0.2`, `NaN` and `Infinity` pass through, and non number arguments from plain JavaScript callers are not rejected).

## Options considered

### Option 1: Plain function typed by `SumFn`

`src/sum/types.ts` defines `SumFn`; `src/sum/sum.ts` exports `const sum: SumFn = (a, b) => a + b`. Entry files re export each.

**Pros**:
- Smallest possible surface; nothing to construct, nothing to inject, no state.
- The public type and the implementation are tied together by the compiler, so they cannot drift.
- Satisfies `isolatedDeclarations` with one annotation.

**Cons**:
- Must be an arrow `const`, not a `function` declaration (a declaration cannot take a type alias), so it is not hoisted.
- Steps away from the `AGENTS.md` class first style, which a reader may question.

### Option 2: `SumCalculator` class with a `sum` wrapper

A `SumCalculator` class does the work; an exported `sum` delegates to a module level instance.

**Pros**:
- Follows the class first rule literally and sets a pattern for future SDK services.

**Cons**:
- A module level instance is exactly the module state `AGENTS.md` warns about under dual builds.
- More code and an extra concept for one addition with no dependencies to inject.

### Option 3: Function declaration with an inline signature, `SumFn` separate

`export function sum(a: number, b: number): number`, with `SumFn` written independently in the types entry.

**Pros**:
- The most familiar form; hoisted; reads naturally in stack traces.

**Cons**:
- `SumFn` and `sum` are two separate statements of one contract; nothing fails if they diverge.

## Decision

**Chosen option**: Option 1: Plain function typed by `SumFn`

Export `sum` from the root as an arrow function declared `const sum: SumFn`, export `SumFn` as a type only from `./types`, and rely on publint plus arethetypeswrong at build time as this feature's proof that both module styles resolve.

**Implementation skills**: `tsdown` (`.agents/skills/tsdown/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `publint` (`publint/publint`, `.agents/skills/publint-package-export-validation-skill-for-npm-release-checks/`)

## Rationale

The class rule in `AGENTS.md` exists to keep dependencies explicit and injectable. `sum` has no dependencies, so a class would add ceremony and, worse, a module level instance that the same file's dual build warning tells you to avoid. A stateless function is the honest fit, and the rule still applies the moment the SDK grows a service with real collaborators.

Typing `sum` against `SumFn` (Option 1 over Option 3) matters because the scope chose types as the only input guard. If the public type can drift from the real function, that guard is weaker than it looks. Losing hoisting is irrelevant for a module that exports one constant.

You chose to treat the build's exports checks as the dual format proof for this feature, keeping the suite to one unit test. That fits the Skateboard approach and the no tarball tests rule: arethetypeswrong already proves each entry resolves to the right file with matching types under both `import` and `require`. What it cannot prove is that the function runs from each format; feature 4's clean consumer projects close that gap.

## Feature design

**Data model sketch**:
None. The package holds no data and no state.

**API surface**:
| Export | Entry | Signature | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `sum` | `.` (root) | `sum(a: number, b: number): number`, declared `const sum: SumFn` | `a + b` | none (local library call) | none thrown; non number input from JavaScript callers is not rejected (AC-4) |
| `SumFn` | `./types` | `type SumFn = (a: number, b: number) => number` | type only | none | none |

File layout (folder by feature; entry files only re export, through `@/*`):
- `src/sum/types.ts`: `SumFn`, with TSDoc.
- `src/sum/sum.ts`: `sum`, with TSDoc stating the `+` semantics (AC-4); `import type { SumFn } from "@/sum/types"`.
- `src/index.ts`: `export { sum } from "@/sum/sum";` (no type re exports, per spec 0001).
- `src/types/index.ts`: `export type { SumFn } from "@/sum/types";`
- `tests/sum/sum.test.ts`: the one unit test.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| `sum(a, b)` | the return value | derived: JavaScript `a + b` on the two input params, no rounding or checks (AC-4) |
| type check of `sum` | its signature | `SumFn` in `src/sum/types.ts` (AC-3) |
| `pnpm build` | `dist/index.*`, `dist/types.*` file names | `outExtensions` in `tsdown.config.ts`, decided in spec 0001 |
| exports check result | pass or fail | publint + arethetypeswrong (`node16`, `error`) run by tsdown, decided in spec 0001 (AC-2, AC-3) |

**Key invariants**:
- `sum` is stateless and pure: same inputs, same output, no module level state (safe under the dual package hazard).
- `sum`'s type is `SumFn`; there is exactly one statement of the signature.
- The root entry exports values only; `./types` exports types only.
- Built `.d.ts` / `.d.cts` files contain no `@/` specifiers (arethetypeswrong fails the build if they do).

**Security model**:
Not applicable. A pure local function with no I/O, no data, and no privileges.

**Critical test scenarios**:
- Happy path: `sum(1, 2)` is `3` (Vitest, `tests/sum/sum.test.ts`), verifies **AC-1**
- Dual resolution: `pnpm build` passes publint and arethetypeswrong for `.` and `./types`, verifies **AC-2**, **AC-3**
- Contract: `pnpm typecheck` passes with `sum` declared as `SumFn`, and the TSDoc on `sum` names the `+` semantics, verifies **AC-3**, **AC-4**

## Build plan

Skateboard: the whole feature is one thin usable slice, built type first so the implementation compiles against it.

1. Add `src/sum/types.ts` with `SumFn` and TSDoc; re export it from `src/types/index.ts` with `export type`, satisfies **AC-3**
2. Add `src/sum/sum.ts` with `export const sum: SumFn = (a, b) => a + b` and TSDoc covering the `+` semantics; re export it from `src/index.ts`, satisfies **AC-1**, **AC-4**
3. Add `tests/sum/sum.test.ts` with one test, `sum(1, 2)` equals `3`, importing through `@/sum/sum`; remove `passWithNoTests` from `vitest.config.ts` (spec 0001 follow up), satisfies **AC-1**
4. Run `pnpm build` (publint and arethetypeswrong must pass), `pnpm typecheck`, `pnpm check`, and `pnpm test`, satisfies **AC-2**, **AC-3**

## Consequences

**Positive**:
- The package does its one job, with matching types for `import` and `require` consumers.
- The public type and the function cannot disagree.
- Adding the next function follows the same pattern: a feature folder, then a one line re export per entry.

**Negative / tradeoffs**:
- No test runs `sum` from the built ESM or CJS files; until feature 4 lands, a runtime break in one format would only be caught by hand.
- One integer test covers the behaviour; the `+` semantics in AC-4 are documented, not tested, so a later change (say, adding rounding) would not fail the suite.
- No type level tests: the public `SumFn` contract is guarded by `pnpm typecheck` on source only.
- The dts bundler may emit a shared declaration chunk (a third `.d.ts` / `.d.cts` file both entries import) because both reference `SumFn`; it ships inside `dist/` and arethetypeswrong checks it.

**Neutral**:
- `dist/types.js` and `dist/types.cjs` stay near empty, since `./types` exports only a type (expected, per spec 0001).
- `sum` deviates from the class first rule in `AGENTS.md` on purpose; the rule still applies to anything with dependencies.

## Follow-up

- [ ] Feature 4 (tarball install check): call `sum(1, 2)` at runtime from both the ESM and CommonJS consumer projects, and import `SumFn` from `./types` in the TypeScript ones; this feature relies on build checks alone for dual format proof.
