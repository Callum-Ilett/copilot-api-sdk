# 0003. Tarball install sandbox

**Date**: 2026-10-03
**Status**: Proposed

## Summary

You get a tiny `sandbox/` consumer project for trying the package the way a real user gets it: from the packed tarball (the `.tgz` file `pnpm pack` builds), not from `src/`. The whole `sandbox/` folder is gitignored, so it lives only on your machine and never becomes repo code; this spec holds its file contents so anyone can recreate it. One command packs the package and installs it into the sandbox. A second command runs a short ESM demo that prints `sum(1, 2)`, and you read the log yourself to confirm it says `3`. CommonJS, TypeScript consumer setups, Node 22, and an automated check are deferred on purpose.

## Context

> ⚠️ Premise note: the scope promises the package works with both `import` and `require`. This check runs only the ESM (`import`) path. The CommonJS runtime path stays proven only by the build's arethetypeswrong check (which confirms each entry resolves to the right file and types, but never runs the code). You chose this knowingly to keep the Skateboard small. The automated consumer matrix is recorded under the scope's Deferred list, so the gap stays visible.

Specs 0001 and 0002 prove the package's shape from inside the repo: tsdown builds ESM and CJS output, and publint plus arethetypeswrong check the `exports` map against the real files on every build. None of that is what a consumer does. A consumer installs a tarball into their own project and imports it by package name. Failures that only show up there include a tarball missing a file, an `exports` condition pointing at the wrong build, or a package name that doesn't match the import.

`AGENTS.md` keeps tarball install tests out of the Vitest suite, so any proof has to live beside the suite rather than inside it. The team is small, the package holds one function, and the build approach is Skateboard: the smallest complete thing someone would actually use, then grow it.

You also want a place to play with the package by hand as it grows into an API SDK, not only a pass or fail gate.

## Requirements

**User stories**:
- As a package developer, I want to install the real packed tarball into a throwaway consumer and run it, so that I see what a user sees before I hand the tarball out.

**Acceptance criteria**:
- **AC-1**: From the repo root, `pnpm pack --silent --out sandbox/copilot-api-sdk.tgz && pnpm -C sandbox install --force` builds the package (prepack runs `pnpm build`, including publint and arethetypeswrong), writes `sandbox/copilot-api-sdk.tgz`, and installs it into `sandbox/` with no errors.
- **AC-2**: `pnpm -C sandbox ts` runs `sandbox/demo.ts` on the current Node as an ES module, importing `sum` from `@ics-ai/copilot-api-sdk`, and prints `3`. You check the log by hand.
- **AC-3**: `demo.ts` also imports the `SumFn` type from `@ics-ai/copilot-api-sdk/types` (a type only import) and types the call with it, and the run in AC-2 still succeeds.
- **AC-4**: `.gitignore` ignores the whole `sandbox/` folder. After creating the sandbox and doing a full refresh and run, `git status` shows no new files, and no file under `sandbox/` is ever committed.
- **AC-5**: The packed tarball still contains only `dist/` files and `package.json` (no `sandbox/` files), checked with `pnpm pack --dry-run`.

## Options considered

### Option 1: Hand run sandbox project

A local, gitignored `sandbox/` folder with its own `package.json` that depends on the tarball by `file:` path, a short demo script, and a README holding the refresh command. You pack, install, run, and read the output.

**Pros**:
- Smallest possible thing that installs the real tarball the way a consumer does.
- Doubles as a playground for trying new exports by hand as the SDK grows.
- No new tooling, no test harness, nothing in the Vitest suite, and no consumer code in the repo.

**Cons**:
- Nothing fails automatically; a regression is caught only if you run it and read the output.
- Covers one consumer shape (ESM on the current Node) only.
- Not committed, so each developer recreates it from this spec.

### Option 2: Scripted consumer matrix

A script packs the tarball, copies several fixture projects (ESM JS, CJS JS, TS `nodenext` ESM and CJS, TS `bundler`) into a temp directory, installs, runs or typechecks each, checks the tarball's file list, and exits non zero on any failure, optionally across Node 22 and 24.

**Pros**:
- Proves every promised consumer shape, including the CJS runtime and both declaration flavours.
- Repeatable and ready to drop into CI when distribution is decided.

**Cons**:
- Several fixtures plus a script to maintain for a one function package.
- Node version switching needs network or a version manager, and adds moving parts.

### Option 3: Written checklist only

A doc listing steps to create a temp project, install the tarball, and try an import.

**Pros**:
- Zero files to maintain beyond the doc.

**Cons**:
- Each run rebuilds the consumer from scratch, so it drifts and gets skipped.
- No shared, inspectable consumer to play with.

## Decision

**Chosen option**: Option 1: Hand run sandbox project

Add a local, gitignored `sandbox/` consumer project that installs the packed tarball by `file:` path and runs an ESM demo printing `sum(1, 2)`, checked by reading the log.

**Implementation skills**: `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`) · `publint` (`publint/publint`, `.agents/skills/publint-package-export-validation-skill-for-npm-release-checks/`)

## Rationale

Skateboard and the no tarball tests rule point the same way: the smallest thing that installs the real artifact, kept out of the suite. Option 1 is exactly that, and it earns its place twice, as a check now and as a playground later. The tarball contents and the `exports` map are already guarded by the build that `prepack` runs, so the sandbox only has to close the one gap the build cannot: running the installed package by name from a consumer.

Option 2 is the right end state once tarballs leave your machine (it is what CI would run), but today it is several fixtures and a script guarding one function. You chose to defer it, and the premise note above records what that leaves unproven. Option 3 costs less to write but more to use, and nothing stays around to inspect.

Smaller calls made here: the dependency uses the real package name `@ics-ai/copilot-api-sdk` so imports read exactly like a consumer's (you confirmed this). The sandbox gets no `tsconfig.json` and no typecheck script, since you chose print only; the TypeScript devDependency stays for editor support. The runner up would be a minimal `tsconfig.json` with `module: nodenext`, worth adding if the editor flags the `/types` import.

You want no consumer code in the repo, so the whole `sandbox/` folder is gitignored rather than committed. The sandbox is local scratch for checking the tarball, not part of the package's source. The file contents live in this spec instead, which keeps them reviewable and lets anyone recreate the sandbox. Because Biome respects `.gitignore`, it skips `sandbox/` too, so local experiments never break `pnpm check`.

## Feature design

**Data model sketch**:
None. The sandbox stores nothing, and the whole folder (its source files plus the tarball, `node_modules/`, and lockfile) is gitignored.

**State transitions**:
Omitted, no state machine.

**API surface** (commands and files, the surface you touch):
| Command / file | Where it runs | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `pnpm pack --silent --out sandbox/copilot-api-sdk.tgz` | repo root | `package.json` `files: ["dist"]`, `prepack` | `sandbox/copilot-api-sdk.tgz` | none | build, publint, or attw failure stops the pack |
| `pnpm -C sandbox install --force` | repo root | `sandbox/package.json` dependency `file:./copilot-api-sdk.tgz` | `sandbox/node_modules/@ics-ai/copilot-api-sdk` | none | tarball missing (pack not run first); no network for `typescript` |
| `pnpm -C sandbox ts` (`node demo.ts`) | repo root | `sandbox/demo.ts` | stdout `3` | none | `ERR_MODULE_NOT_FOUND` if not installed; wrong number if `sum` regressed |

`sandbox/package.json`:
```json
{
	"name": "copilot-sdk-sandbox",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"scripts": {
		"ts": "node demo.ts"
	},
	"dependencies": {
		"@ics-ai/copilot-api-sdk": "file:./copilot-api-sdk.tgz"
	},
	"devDependencies": {
		"typescript": "7.0.2"
	}
}
```

`sandbox/demo.ts`:
```ts
import { sum } from "@ics-ai/copilot-api-sdk";
import type { SumFn } from "@ics-ai/copilot-api-sdk/types";

const add: SumFn = sum;

console.log(add(1, 2));
```

`sandbox/README.md`: your text, as given:

````markdown
# Sandbox

A tiny consumer project for trying the package by hand, the way a real user would get it: from the packed tarball, not from `src/`.

## Refresh the install

From the repo root, you can run:

```bash
pnpm pack --silent --out sandbox/copilot-api-sdk.tgz && pnpm -C sandbox install --force
```

That builds the package, packs it to `sandbox/copilot-api-sdk.tgz`, and installs that tarball here (`--force`, so every run picks up your latest changes).

## Run it

```bash
pnpm -C sandbox ts
```

You should see `3` printed.
````

The `## Run it` section is an addition, so the expected log you check by hand (AC-2) is written down next to the command.

`.gitignore`: add `sandbox/` (the whole folder). This is the only committed change this feature makes; the three files above exist only on your machine.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Pack | tarball path `sandbox/copilot-api-sdk.tgz` | `--out` flag in the README command |
| Pack | tarball file list | root `package.json` `files: ["dist"]` (spec 0001) |
| Install | which tarball is installed | `sandbox/package.json` dependency `file:./copilot-api-sdk.tgz` |
| Install | installed package name | root `package.json` `name` (`@ics-ai/copilot-api-sdk`), matched by the sandbox dependency key |
| Run | which build file runs | `exports["."].import.default` → `dist/index.js` (spec 0001), picked because the sandbox is `"type": "module"` |
| Run | printed value | `sum(1, 2)` from the installed `dist/index.js` |
| Run | expected value `3` | spec 0002 AC-1, written in the sandbox README |
| Run | Node version | whatever `node` is on your PATH (current Node only, by your choice) |

**Key invariants**:
- The sandbox imports the package only by its name, never from `src/` or a relative path into the repo.
- The sandbox never ships: root `files: ["dist"]` keeps it out of the tarball.
- Nothing under `sandbox/` is ever committed; `.gitignore` ignores the whole folder.
- Every refresh reinstalls from the freshly packed tarball (`--force`).

**Security model**:
Not applicable. Local developer tooling only: no secrets, no network beyond fetching `typescript`, no user data.

**Configuration required**:
None. No environment variables or credentials.

**Critical test scenarios** (manual):
- Happy path: run the refresh command, then `pnpm -C sandbox ts`, and see `3`. Verifies **AC-1**, **AC-2**, **AC-3**.
- Failure case: run `pnpm -C sandbox ts` before any refresh and get a clear module not found error. Then refresh and see it pass. Verifies **AC-1**, **AC-2**.
- Hygiene: after a run, `git status` shows nothing under `sandbox/`, and `pnpm pack --dry-run` lists only `dist/` and `package.json`. Verifies **AC-4**, **AC-5**.

## Build plan

Skateboard: the ignore rule lands first, then the local sandbox as one usable piece, then one hand run proves it.

1. Add `sandbox/` to `.gitignore` (the only committed change). Satisfies **AC-4**.
2. Create `sandbox/package.json` locally, exactly as above. Satisfies **AC-1**.
3. Create `sandbox/demo.ts` locally, exactly as above. Satisfies **AC-2**, **AC-3**.
4. Create `sandbox/README.md` locally with your text plus the `## Run it` section. Satisfies **AC-1**, **AC-2**.
5. Run it by hand: refresh command, `pnpm -C sandbox ts` (expect `3`), `git status` (expect only the `.gitignore` change, nothing under `sandbox/`), and `pnpm pack --dry-run` (expect only `dist/` files and `package.json`). Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**.

## Consequences

**Positive**:
- The real tarball is installed and run by package name before anyone else gets it.
- A ready made playground for each new export as the SDK grows.
- No consumer code in the repo, no new dependencies in the root package, and nothing added to the Vitest suite.

**Negative / tradeoffs**:
- The sandbox isn't committed, so each developer (or a fresh clone) recreates it from this spec, and local copies can drift from it.
- Manual: a regression shows up only if someone runs the sandbox and reads the output.
- The CommonJS runtime path, TypeScript consumer resolution (`nodenext`, `bundler`), and the Node 22 floor are not exercised at all.
- The first install needs network to fetch `typescript`.
- `--force` reinstalls every time, which is slower than a cached install (seconds at this size).

**Neutral**:
- Runs on whatever Node is active. Your local Node is 26 while `.nvmrc` says 24; both strip TypeScript types natively, so `node demo.ts` works on either.
- Biome (which respects `.gitignore`) and root `pnpm typecheck` both skip `sandbox/`.

## Follow-up

- [ ] Add the sandbox refresh and run commands to `AGENTS.md` `## Commands`, pointing at this spec for the sandbox's file contents, since the folder isn't committed (a `/sync` job).
- [ ] Scope Deferred: an automated consumer matrix (CJS runtime, TS `nodenext` and `bundler`, Node 22, tarball file list check). This picks up the follow ups from specs 0001 and 0002 that this spec leaves out.
- [ ] If the editor flags the `@ics-ai/copilot-api-sdk/types` import inside `sandbox/`, add a minimal `sandbox/tsconfig.json` (`module: nodenext`).
