# @ics-ai/copilot-api-sdk

A small private TypeScript package for the Copilot API. It gives you `CopilotAdminClient`, which lists, gets, creates, updates, and deletes accounts through the API's admin routes, plus the SDK's error classes and every type.

Everything comes from the package root, `@ics-ai/copilot-api-sdk`.

It ships as an npm tarball (a `.tgz` file), never through a registry. It works from both module styles: ES modules (`import`) and CommonJS (`require`), with type declarations for each.

You need Node 22 or newer.

## Build the tarball

You build the tarball from a clone of this repo. The repo uses pnpm 12.8.1, pinned in `package.json`. If you haven't already, you can run `corepack enable` once so the right pnpm version is picked up.

From the repo root:

```bash
pnpm install
pnpm pack
```

`pnpm pack` builds the package first (and checks its exports with publint and arethetypeswrong), then writes `ics-ai-copilot-api-sdk-1.0.0.tgz` to the repo root. The version in the file name follows `version` in `package.json`.

Use `pnpm pack`, not `npm pack`. The repo pins pnpm through `devEngines`, so npm refuses to pack it.

## Install it with npm

In your own project, install the tarball by its path:

```bash
npm install /path/to/ics-ai-copilot-api-sdk-1.0.0.tgz
```

npm records it in your `package.json` as a `file:` dependency, pointing at that path. Keep the tarball where the path points, or copy it into your project first (for example a `vendor/` folder) so a fresh `npm install` still finds it.

## Use it from JavaScript

### ES modules (`import`)

Your `package.json` has `"type": "module"`, or the file ends in `.mjs`:

```js
import { CopilotAdminClient } from "@ics-ai/copilot-api-sdk";

const client = new CopilotAdminClient({ baseURL: "https://copilot.example.com" });
client.setAuthTokenProvider(() => auth.getAccessToken());

const accounts = await client.accounts.list();
```

### CommonJS (`require`)

No `"type": "module"`, or the file ends in `.cjs`:

```js
const { CopilotAdminClient } = require("@ics-ai/copilot-api-sdk");

const client = new CopilotAdminClient({ baseURL: "https://copilot.example.com" });
client.setAuthTokenProvider(() => auth.getAccessToken());

client.accounts.list().then((accounts) => console.log(accounts));
```

## Use it from TypeScript

The same code works in both module styles. TypeScript picks the right build and the right declarations for you: `.d.ts` for ES modules, `.d.cts` for CommonJS.

```ts
import { type Account, CopilotAdminClient } from "@ics-ai/copilot-api-sdk";

const client = new CopilotAdminClient({ baseURL: "https://copilot.example.com" });
client.setAuthTokenProvider(() => auth.getAccessToken());

const accounts: Account[] = await client.accounts.list();
```

Values and types share the one root entry. Bring a type in with `import type` (or an inline `type` marker, as above) so it disappears from your compiled code.

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

## API

### `CopilotAdminClient`

The entry point for the admin routes. `baseURL` is the API root that serves `/api/...`.

```ts
import {
	type Account,
	CopilotAdminClient,
	HttpError,
	ValidationError,
} from "@ics-ai/copilot-api-sdk";

const client = new CopilotAdminClient({ baseURL: "https://copilot.example.com" });

// Any async token source works (MSAL, Auth0, your own). Called once per request.
client.setAuthTokenProvider(() => auth.getAccessToken());

const accounts: Account[] = await client.accounts.list();

const created = await client.accounts.create({
	name: "Acme",
	logoUrl: "https://cdn.example.com/acme.png",
});

try {
	await client.accounts.get(created.id);
} catch (error) {
	if (error instanceof HttpError && error.status === 404) {
		// The account is gone.
	} else if (error instanceof ValidationError) {
		// error.direction is "request" (your input) or "response" (the API's answer).
	}
}
```

`client.accounts` has five methods. Each one takes an optional last argument, `{ signal }`, so you can cancel it with an `AbortController`.

| Method | Sends | Resolves to |
|---|---|---|
| `list(options?)` | `GET /api/admin/accounts` | `Account[]` (empty when there are none) |
| `get(id, options?)` | `GET /api/admin/accounts/{id}` | `Account` |
| `create(input, options?)` | `POST /api/admin/accounts` | `Account` |
| `update(id, input, options?)` | `PATCH /api/admin/accounts/{id}` | `Account`, or `{ success: true }` when nothing changed |
| `delete(id, options?)` | `DELETE /api/admin/accounts/{id}` | `{ id }` |

An `Account` is `{ id, name, logoUrl, createdAt }`. `id` is a UUID, `name` and `logoUrl` can be `null`, and `createdAt` is an ISO 8601 string (use `new Date(account.createdAt)` when you need a date).

Every input and every response is checked at runtime:

- `id` must be a UUID. Anything else is rejected before a request is sent.
- `create` and `update` both need a non blank `name` (sent trimmed) and a `logoUrl` that is an `http` or `https` URL. An update sends both fields, so pass the current value of a field you aren't changing.
- A response that doesn't match the expected shape is rejected, so a change in the API shows up as a clear error. Unknown extra fields are dropped, not rejected.

`update` resolves to a union. You can narrow it with `"success" in result`.

### Errors

Every error the SDK raises extends `CopilotApiError` and has a fixed `code`. You can catch by class, or match on `code`. Matching on `code` keeps working even when two copies of the SDK are loaded (for example the ES module and CommonJS builds side by side).

| Class | `code` | When |
|---|---|---|
| `HttpError` | `"HTTP_ERROR"` | The API answered outside 200 to 299. `status` and `data` hold the response (a 404 has `data: "Account not found"`). |
| `NetworkError` | `"NETWORK_ERROR"` | No response arrived. `aborted` is `true` when your `signal` cancelled the call. |
| `AuthTokenError` | `"AUTH_TOKEN_ERROR"` | Your token provider failed or returned an empty token. Nothing was sent. |
| `ValidationError` | `"VALIDATION_ERROR"` | Data failed its check. `direction` says whether it was your input (`"request"`, nothing was sent) or the API's answer (`"response"`). `issues` lists each problem as `{ path, message, code }`. |

A response `ValidationError` after `create`, `update`, or `delete` means the change may already have happened. You might want to refetch before retrying.

## Working on this package

If you're changing the package rather than using it, [AGENTS.md](AGENTS.md) lists the stack, the conventions, and every command. The ones you'll likely want:

```bash
pnpm build      # Build dist/, with publint and arethetypeswrong
pnpm test       # Run the unit tests once
pnpm typecheck  # Type check without emitting
pnpm check      # Lint, format, and import order, no writes
```

To try the packed tarball the way a consumer does, there's a local `sandbox/` project. It is gitignored, so you recreate its files from [spec 0003](docs/specs/0003-tarball-install-sandbox/index.md).
