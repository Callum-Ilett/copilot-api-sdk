# 0003. Tarball install sandbox · rationale

_The decision record for [index.md](index.md)._

## Context

> ⚠️ Premise note: the scope promises the package works with both `import` and `require`. This check runs only the ESM (`import`) path. The CommonJS runtime path stays proven only by the build's arethetypeswrong check (which confirms each entry resolves to the right file and types, but never runs the code). You chose this knowingly to keep the Skateboard small. The automated consumer matrix is recorded under the scope's Deferred list, so the gap stays visible.

Specs 0001 and 0002 prove the package's shape from inside the repo: tsdown builds ESM and CJS output, and publint plus arethetypeswrong check the `exports` map against the real files on every build. None of that is what a consumer does. A consumer installs a tarball into their own project and imports it by package name. Failures that only show up there include a tarball missing a file, an `exports` condition pointing at the wrong build, or a package name that doesn't match the import.

`AGENTS.md` keeps tarball install tests out of the Vitest suite, so any proof has to live beside the suite rather than inside it. The team is small, the package holds one function, and the build approach is Skateboard: the smallest complete thing someone would actually use, then grow it.

You also want a place to play with the package by hand as it grows into an API SDK, not only a pass or fail gate.

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

## Rationale

Skateboard and the no tarball tests rule point the same way: the smallest thing that installs the real artifact, kept out of the suite. Option 1 is exactly that, and it earns its place twice, as a check now and as a playground later. The tarball contents and the `exports` map are already guarded by the build that `prepack` runs, so the sandbox only has to close the one gap the build cannot: running the installed package by name from a consumer.

Option 2 is the right end state once tarballs leave your machine (it is what CI would run), but today it is several fixtures and a script guarding one function. You chose to defer it, and the premise note above records what that leaves unproven. Option 3 costs less to write but more to use, and nothing stays around to inspect.

Smaller calls made here: the dependency uses the real package name `@ics-ai/copilot-api-sdk` so imports read exactly like a consumer's (you confirmed this). The sandbox gets no `tsconfig.json` and no typecheck script, since you chose print only; the TypeScript devDependency stays for editor support. The runner up would be a minimal `tsconfig.json` with `module: nodenext`, worth adding if the editor flags the `/types` import.

You want no consumer code in the repo, so the whole `sandbox/` folder is gitignored rather than committed. The sandbox is local scratch for checking the tarball, not part of the package's source. The file contents live in this spec instead, which keeps them reviewable and lets anyone recreate the sandbox. Because Biome respects `.gitignore`, it skips `sandbox/` too, so local experiments never break `pnpm check`.
