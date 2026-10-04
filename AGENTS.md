# @ics-ai/copilot-api-sdk

## Stack

- **Language / Runtime**: TypeScript 7 (strict), dev on Node 24 (`.nvmrc`), consumers on Node 22+
- **Build**: tsdown, dual ESM (`.js` / `.d.ts`) and CommonJS (`.cjs` / `.d.cts`) output, publint + arethetypeswrong on every build
- **Key dependencies**: tsdown, Vitest, publint, @arethetypeswrong/core
- **Runtime dependencies**: axios (internal transport, never in the public types), zod 4 (request and response schemas, and the types inferred from them)
- **Package manager**: pnpm 12.8.1 (pinned; run `corepack enable` once)
- **Package shape**: private, exports only (no `main` / `types`), a single entry `.` (every value and type, from `src/index.ts`), shipped as an npm tarball. Spec: [0001](docs/specs/0001-typescript-dual-package-stack.md), amended by [0005](docs/specs/0005-admin-accounts-api/index.md)

## Build approach

Skateboard: ship the smallest complete package someone would actually install, then grow it.

## Commands

```bash
pnpm install       # Install
pnpm build         # Build dist/ (also runs publint and attw)
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest once (pnpm test:watch to watch)
pnpm lint          # Biome lint
pnpm format        # Biome format, writes changes
pnpm check         # Biome lint + format + import order, no writes
pnpm pack          # Build the tarball (prepack runs the build; npm pack is refused by devEngines)
pnpm pack --silent --out sandbox/copilot-api-sdk.tgz && pnpm -C sandbox install --force  # Refresh the local sandbox from a fresh tarball
pnpm -C sandbox ts # Run the sandbox demo, expect `list get create update delete`
```

`sandbox/` is a local, gitignored consumer project for checking the packed tarball by hand. It isn't committed, so recreate its files from [spec 0003](docs/specs/0003-tarball-install-sandbox/index.md) `## Feature design`.

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- SOLID OOP: one reason to change per class; small focused interfaces; depend on abstractions, wired by constructor injection at the composition root. No service locator or globals.
- Composition over inheritance (at most one level deep). Classes stay under ~200 lines; name them for what they do (`HttpClient`, not `BaseHttpImpl`).
- Keep exports stateless where you can: a dual build can load ESM and CJS copies side by side, so module level state and cross package `instanceof` checks break.
- Folder by feature: `src/<feature>/` holds that feature's code and types. The entry file (`src/index.ts`) only re exports. A new entry point means a new `entry` key in `tsdown.config.ts` plus a matching `exports` block.
- Import through the `@/*` alias (`@/*` → `src/*`), never `../` chains. Built `.d.ts` files must not leak the alias (attw fails the build if they do).
- Schemas: Zod schemas live in `src/<feature>/schemas.ts` and stay internal; public types come from them via `z.infer` / `z.input` in `src/<feature>/types.ts`. `isolatedDeclarations` means each exported schema constant needs an explicit Zod type annotation.
- Strict types as configured: no `any`; `isolatedDeclarations` means every export has an explicit type or return annotation; use `import type` for types.
- Named exports only, no default exports. Document every public export with TSDoc.
- Naming: camelCase values and functions, PascalCase classes, interfaces, and types, kebab-case file names.
- Tests: Vitest unit tests in root `tests/`, mirroring features (`tests/http/http-client.test.ts`), importing via `@/`. Inject fakes through constructors; never patch globals or module internals. No tarball install tests in the suite.
- Test bodies follow Arrange, Act, Assert, each step marked with a `// Arrange`, `// Act`, `// Assert` comment. One exception: a test that checks a throw (`expect(() => ...).toThrow(...)`, `await expect(...).rejects...`) may merge Act and Assert into one step marked `// Act & Assert`.
- Conventional commits (`feat:`, `fix:`, `chore:`, ...).

## Tooling

- Biome (`biome.json`) lints and formats, respecting `.gitignore`, with organize imports on. On top of `recommended` it enforces: `noExplicitAny`, `noDefaultExport` (turned off for `*.config.ts`), `useImportType`, `useExportType`, and `noRestrictedImports` blocking `../` imports in favour of `@/*`.
- `@/*` alias: defined once in `tsconfig.json` `paths`. Vitest reads it through `resolve.tsconfigPaths: true`; tsdown resolves it from `tsconfig.json`. Don't redefine it elsewhere.
- `@tests/*` alias (`@tests/*` → `tests/*`, also in `tsconfig.json` `paths`): lets tests share helpers such as `tests/http/fake-adapter.ts` without `../` imports.
- Tests live in `tests/**/*.test.ts` (Vitest `include`; `tests` is in tsconfig `include`). `passWithNoTests` is off, so a run that finds no tests fails.
- No pre commit hook. No CI yet (deferred with tarball distribution).

## Git

- integration: on
- branch prefix: feat/
- commit: manual

## Agent skills

- [tsdown](.agents/skills/tsdown/): builds, declarations, dual format output, `exports` checks
- [pnpm](.agents/skills/pnpm/): `antfu/skills`, dependencies and pnpm config
- [vitest](.agents/skills/vitest/): `antfu/skills`, writing and running tests
- [publint](.agents/skills/publint-package-export-validation-skill-for-npm-release-checks/): `publint/publint`, package export validation before packing
- [biome](.agents/skills/biome/): lint and format config and rules
- [typescript-advanced-types](.agents/skills/typescript-advanced-types/): generics, conditional and mapped types
- [api-and-interface-design](.agents/skills/api-and-interface-design/): stable public API and interface design
- [zod](.agents/skills/zod/): `anivar/zod-skill`, Zod 4 schemas, parsing, and inference

Declined: arethetypeswrong, tsconfig (Agent Skill / MCP discovery, 2026-10-03); Zod MCP servers `@nurjaks/zod-mcp-server` and Zod Contract Mock Forge (2026-10-03)

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
