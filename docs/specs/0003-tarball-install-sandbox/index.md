# 0003. Tarball install sandbox

**Date**: 2026-10-03
**Status**: Accepted

> Amended by [0005](../0005-admin-accounts-api/index.md): the `./types` entry was removed; every value and type is now exported from the root `.` entry (`src/index.ts`).

> Amended 2026-10-04: `sum` was removed (spec [0002](../0002-sum-function-dual-format.md) is retired). The demo now builds a `CopilotAdminClient` without calling the network and prints its five account methods, `list get create update delete`. AC-2, AC-3, and the file contents below show the current demo.

_Decision record (context, options, reasoning) lives in [rationale.md](rationale.md). Build steps you can run are in [verify.md](verify.md)._

## Summary

You get a tiny `sandbox/` consumer project for trying the package the way a real user gets it: from the packed tarball (the `.tgz` file `pnpm pack` builds), not from `src/`. The whole `sandbox/` folder is gitignored, so it lives only on your machine and never becomes repo code; this spec holds its file contents so anyone can recreate it. One command packs the package and installs it into the sandbox. A second command runs a short ESM demo that builds the client and prints its account methods, and you read the log yourself to confirm it says `list get create update delete`. CommonJS, TypeScript consumer setups, Node 22, and an automated check are deferred on purpose.

## Requirements

**User stories**:
- As a package developer, I want to install the real packed tarball into a throwaway consumer and run it, so that I see what a user sees before I hand the tarball out.

**Acceptance criteria**:
- **AC-1**: From the repo root, `pnpm pack --silent --out sandbox/copilot-api-sdk.tgz && pnpm -C sandbox install --force` builds the package (prepack runs `pnpm build`, including publint and arethetypeswrong), writes `sandbox/copilot-api-sdk.tgz`, and installs it into `sandbox/` with no errors.
- **AC-2**: `pnpm -C sandbox ts` runs `sandbox/demo.ts` on the current Node as an ES module, importing `CopilotAdminClient` from `@ics-ai/copilot-api-sdk`, and prints `list get create update delete`. You check the log by hand.
- **AC-3**: `demo.ts` also imports the `AccountsResource` type from `@ics-ai/copilot-api-sdk` (an inline `type` import) and types `client.accounts` with it, and the run in AC-2 still succeeds.
- **AC-4**: `.gitignore` ignores the whole `sandbox/` folder. After creating the sandbox and doing a full refresh and run, `git status` shows no new files, and no file under `sandbox/` is ever committed.
- **AC-5**: The packed tarball still contains only `dist/` files, `package.json`, and `README.md` (npm and pnpm always add a root README, as spec 0001 expects), and no `sandbox/` files, checked with `pnpm pack --dry-run`.

## Decision

**Chosen option**: Option 1: Hand run sandbox project

Add a local, gitignored `sandbox/` consumer project that installs the packed tarball by `file:` path and runs an ESM demo printing the client's account methods, checked by reading the log.

**Implementation skills**: `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`) · `publint` (`publint/publint`, `.agents/skills/publint-package-export-validation-skill-for-npm-release-checks/`)

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
| `pnpm -C sandbox ts` (`node demo.ts`) | repo root | `sandbox/demo.ts` | stdout `list get create update delete` | none | tarball "does not exist" if pack not run first (pnpm 12 installs before running); a missing method name if the client surface regressed |

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
import {
	type AccountsResource,
	CopilotAdminClient,
} from "@ics-ai/copilot-api-sdk";

const client = new CopilotAdminClient({
	baseURL: "https://copilot.example.com",
});
const accounts: AccountsResource = client.accounts;

const methods = (["list", "get", "create", "update", "delete"] as const).filter(
	(method) => typeof accounts[method] === "function",
);

console.log(methods.join(" "));
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

You should see `list get create update delete` printed.
````

The `## Run it` section is an addition, so the expected log you check by hand (AC-2) is written down next to the command.

`.gitignore`: add `sandbox/` (the whole folder). This is the only committed change this feature makes; the three files above exist only on your machine.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Pack | tarball path `sandbox/copilot-api-sdk.tgz` | `--out` flag in the README command |
| Pack | tarball file list | root `package.json` `files: ["dist"]` (spec 0001), plus `package.json` and the root `README.md`, which npm and pnpm always add |
| Install | which tarball is installed | `sandbox/package.json` dependency `file:./copilot-api-sdk.tgz` |
| Install | installed package name | root `package.json` `name` (`@ics-ai/copilot-api-sdk`), matched by the sandbox dependency key |
| Run | which build file runs | `exports["."].import.default` → `dist/index.js` (spec 0001), picked because the sandbox is `"type": "module"` |
| Run | printed value | the account methods of a `CopilotAdminClient` built from the installed `dist/index.js` |
| Run | expected value `list get create update delete` | the `AccountsResource` methods in spec 0005 AC-1, written in the sandbox README |
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
- Happy path: run the refresh command, then `pnpm -C sandbox ts`, and see `list get create update delete`. Verifies **AC-1**, **AC-2**, **AC-3**.
- Failure case: run `pnpm -C sandbox ts` before any refresh and get a clear failure (pnpm 12 tries to install first and reports the tarball "does not exist"). Then refresh and see it pass. Verifies **AC-1**, **AC-2**.
- Hygiene: after a run, `git status` shows nothing under `sandbox/`, and `pnpm pack --dry-run` lists only `dist/`, `package.json`, and `README.md`. Verifies **AC-4**, **AC-5**.

## Build plan

Skateboard: the ignore rule lands first, then the local sandbox as one usable piece, then one hand run proves it.

1. Add `sandbox/` to `.gitignore` (the only committed change). Satisfies **AC-4**.
2. Create `sandbox/package.json` locally, exactly as above. Satisfies **AC-1**.
3. Create `sandbox/demo.ts` locally, exactly as above. Satisfies **AC-2**, **AC-3**.
4. Create `sandbox/README.md` locally with your text plus the `## Run it` section. Satisfies **AC-1**, **AC-2**.
5. Run it by hand: refresh command, `pnpm -C sandbox ts` (expect `list get create update delete`), `git status` (expect only the `.gitignore` change, nothing under `sandbox/`), and `pnpm pack --dry-run` (expect only `dist/` files, `package.json`, and `README.md`). Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**.

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
