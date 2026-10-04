# @ics-ai/copilot-api-sdk

A small private TypeScript package for the Copilot API. It has no public exports yet; the admin client comes next.

It ships as an npm tarball (a `.tgz` file), never through a registry. It works from both module styles: ES modules (`import`) and CommonJS (`require`), with type declarations for each.

You need Node 22 or newer.

## Build the tarball

You build the tarball from a clone of this repo. The repo uses pnpm 12.8.1, pinned in `package.json`. If you haven't already, you can run `corepack enable` once so the right pnpm version is picked up.

From the repo root:

```bash
pnpm install
pnpm pack
```

`pnpm pack` builds the package first (and checks its exports with publint and arethetypeswrong), then writes `ics-ai-copilot-api-sdk-0.1.0.tgz` to the repo root. The version in the file name follows `version` in `package.json`.

Use `pnpm pack`, not `npm pack`. The repo pins pnpm through `devEngines`, so npm refuses to pack it.

## Install it with npm

In your own project, install the tarball by its path:

```bash
npm install /path/to/ics-ai-copilot-api-sdk-0.1.0.tgz
```

npm records it in your `package.json` as a `file:` dependency, pointing at that path. Keep the tarball where the path points, or copy it into your project first (for example a `vendor/` folder) so a fresh `npm install` still finds it.

## Use it from TypeScript

TypeScript picks the right build and the right declarations for you: `.d.ts` for ES modules, `.d.cts` for CommonJS.

### Your tsconfig

The package describes its files with `exports` only (there is no `main` or `types` field). So TypeScript needs a module resolution mode that reads `exports`: `nodenext`, `node16`, or `bundler`. The older `node` (also called `node10`) mode can't see this package's types.

For a project that runs on Node, a setup like this works:

```json
{
	"compilerOptions": {
		"module": "nodenext",
		"target": "es2023",
		"strict": true,
		"rootDir": "src",
		"outDir": "dist"
	},
	"include": ["src"]
}
```

With `module: "nodenext"`, your `package.json` decides the output:

- With `"type": "module"`, `tsc` keeps the `import` and Node loads the ES module build.
- Without it, `tsc` compiles the `import` into `require` and Node loads the CommonJS build.

If a bundler (Vite, webpack, esbuild and so on) builds your code, you can use `"moduleResolution": "bundler"` instead.

## Working on this package

If you're changing the package rather than using it, [AGENTS.md](AGENTS.md) lists the stack, the conventions, and every command. The ones you'll likely want:

```bash
pnpm build      # Build dist/, with publint and arethetypeswrong
pnpm test       # Run the unit tests once
pnpm typecheck  # Type check without emitting
pnpm check      # Lint, format, and import order, no writes
```

To try the packed tarball the way a consumer does, there's a local `sandbox/` project. It is gitignored, so you recreate its files from [spec 0003](docs/specs/0003-tarball-install-sandbox/index.md).
