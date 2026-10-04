# 0005. Admin accounts API with a public client and Zod schemas

**Date**: 2026-10-03
**Status**: In Progress

> Amended 2026-10-04: `sum` and `SumFn` were removed from the SDK (spec [0002](../0002-sum-function-dual-format.md) is retired), so AC-15 no longer lists them and the README no longer shows them.

> Amended 2026-10-04: accounts hang straight off the client, `client.accounts`, not `client.admin.accounts`. `AdminApi` and the public `AdminResources` type are removed; AC-1, AC-15, and the design below show the current shape.

## Summary

The SDK gets its first public feature: `new CopilotAdminClient({ baseURL })`, whose `client.accounts` lists, gets, creates, updates, and deletes accounts through the Copilot API admin routes. Every request input and every API response is checked with a Zod schema (a runtime description of the data's shape), and the TypeScript types consumers see are generated from those same schemas. The SDK error classes become public, each with a fixed `code` string, plus a new `ValidationError` for data that fails a schema. This sets the pattern every later admin resource follows.

## Requirements

**User stories**:
- As an admin app developer, I want `client.accounts.list()`, `get(id)`, `create(input)`, `update(id, input)`, and `delete(id)` so that I can manage accounts without writing HTTP calls myself.
- As an admin app developer, I want typed results that were really checked at runtime so that a change in the API shows up as a clear error, not as `undefined` deep in my UI.
- As an admin app developer, I want to plug in my own async token source and cancel a call so that the SDK fits whatever auth library and page lifecycle I already have.
- As an admin app developer, I want to catch SDK errors by class or by `code` so that I can tell a 404, a bad input, and a network failure apart.

**Acceptance criteria**:
- **AC-1**: `new CopilotAdminClient({ baseURL })` exposes `accounts` with `list`, `get`, `create`, `update`, and `delete`, and a `setAuthTokenProvider(provider)` method that accepts any `() => Promise<string>`. Every accounts request goes through the internal `HttpClient` (spec 0004), so it carries `Authorization: Bearer <token>` from the current provider, or no `Authorization` header when no provider is set.
- **AC-2**: `list(options?)` sends `GET /api/admin/accounts` and resolves to `Account[]`, every item parsed by `AccountSchema`. An empty array is a valid result.
- **AC-3**: `get(id, options?)` sends `GET /api/admin/accounts/{id}` and resolves to one parsed `Account`.
- **AC-4**: `create(input, options?)` parses `input` with `CreateAccountRequestSchema`: `name` is required and not blank (`z.string().trim().min(1)`, sent trimmed), and `logoUrl` is required and must be an http or https URL (`z.url({ protocol: /^https?$/ })`). It sends `POST /api/admin/accounts` with the parsed body and resolves to the parsed `Account` the API returns. Both fields are required because the API requires them today: `AccountDTOs.cs` declares them as non nullable `string` under `<Nullable>enable</Nullable>`, so ASP.NET answers 400 when either is missing, null, or blank.
- **AC-5**: `update(id, input, options?)` parses `input` with `UpdateAccountRequestSchema` (the same rules as create, both fields required), sends `PATCH /api/admin/accounts/{id}` with the parsed body, and resolves to `UpdateAccountResult`, parsed with `UpdateAccountResultSchema`: either the parsed `Account`, or `{ success: true }`. The API sends `{ success: true }` only for an update with no fields, which the request schema never lets through today, so that branch is a fallback kept on purpose. It never proves the account exists (the API answers it before checking).
- **AC-6**: `delete(id, options?)` sends `DELETE /api/admin/accounts/{id}` and resolves to `{ id }`, parsed by `DeletedAccountSchema`.
- **AC-7**: `AccountSchema` is `{ id: z.uuid(), name: string | null, logoUrl: string | null, createdAt: z.iso.datetime() }`. `createdAt` stays a string. Unknown keys in any response are stripped (Zod's default `z.object`), never rejected.
- **AC-8**: The `id` argument of `get`, `update`, and `delete` is parsed with `z.uuid()` before anything is sent. An invalid id rejects with `ValidationError` (`direction: "request"`); the token provider is not called and no request is sent.
- **AC-9**: An invalid `create` or `update` input (for example a missing or blank `name`, a missing `logoUrl`, `logoUrl: "not a url"` or `"javascript:alert(1)"`, or a wrong type from a plain JS caller) rejects with `ValidationError` (`direction: "request"`); the token provider is not called and no request is sent.
- **AC-10**: A 2xx response that does not match its schema rejects with `ValidationError` (`direction: "response"`). Messages follow three templates, where `<operation>` is the method name such as `accounts.create`:
  - request: `"<operation> failed: invalid request input"`
  - response to a read (`list`, `get`): `"<operation> failed: the API response did not match the expected shape"`
  - response to a write (`create`, `update`, `delete`): `"<operation> failed: the API response did not match the expected shape; the change may already have been applied"`
- **AC-11**: `ValidationError` extends `CopilotApiError` and carries `direction` (`"request" | "response"`), `operation` (for example `"accounts.get"`), `issues` (a read only array of `{ path, message, code }` in an SDK owned shape, not Zod's types), and the original Zod error as `cause`.
- **AC-12**: Every SDK error class has a fixed, read only `code`: `HttpError` → `"HTTP_ERROR"`, `NetworkError` → `"NETWORK_ERROR"`, `AuthTokenError` → `"AUTH_TOKEN_ERROR"`, `ValidationError` → `"VALIDATION_ERROR"`. `CopilotApiError` declares `code` with the type `CopilotApiErrorCode`, the union of those four strings.
- **AC-13**: API failures keep the spec 0004 behaviour: a 404 (`"Account not found"`) rejects with `HttpError` (`status: 404`, `data: "Account not found"`); a 400 rejects with `HttpError` whose `data` is the ASP.NET problem details object; 401, 403, and 500 reject with `HttpError` carrying their status; no response rejects with `NetworkError`; a failing provider rejects with `AuthTokenError`.
- **AC-14**: Every accounts method takes an optional last argument `{ signal }`. The signal is passed to `HttpClient` only when it is set (never as an explicit `undefined`, because of `exactOptionalPropertyTypes`), and aborting it rejects with `NetworkError` (`aborted: true`).
- **AC-15**: The package has a single entry, `.` (`src/index.ts`), which exports every public value and every public type, so a consumer imports everything from `@ics-ai/copilot-api-sdk`. Values: `CopilotAdminClient`, `CopilotApiError`, `HttpError`, `NetworkError`, `AuthTokenError`, and `ValidationError`. Types (with `export type`): `Account`, `CreateAccountRequest`, `UpdateAccountRequest`, `UpdateAccountResult`, `DeletedAccount`, `AccountRequestOptions`, `CancelSignal`, `CopilotAdminClientOptions`, `AccountsResource`, `AuthTokenProvider`, `CopilotApiErrorCode`, and `ValidationIssue`. `CopilotAdminClient.accounts` is typed as the `AccountsResource` interface, never as a class. No Zod schema, `HttpClient`, or `AccountsApi` is exported or named in the public declarations. No built `.d.ts` file mentions `axios`; Zod's types appear in the declarations only as the source the public types are inferred from.
- **AC-18**: The `./types` entry is removed: `src/types/` is deleted, `tsdown.config.ts` has the single entry `{ index: "src/index.ts" }`, the `"./types"` block is gone from `package.json` `exports`, and `dist/` holds no `types.*` files. Importing `@ics-ai/copilot-api-sdk/types` fails to resolve (expected; the package is private and pre 1.0, and the only known consumer is the local `sandbox/`). The README shows every import from the root.
- **AC-16**: `zod` (a current 4.x release) is in `dependencies`. `pnpm build` (publint and arethetypeswrong), `pnpm typecheck`, `pnpm check`, and `pnpm test` pass. The accounts code is unit tested in `tests/accounts/` through `HttpClient` with the fake adapter from spec 0004, injected through constructors. Cancellation tests use a hand built `CancelSignal` stub (the project has no DOM or Node types for `AbortController`), and the fake adapter rejects with axios `CanceledError` when the signal is aborted; this proves the signal is passed through, not real axios cancellation.
- **AC-17**: A packed tarball installed in `sandbox/` can `import { CopilotAdminClient } from "@ics-ai/copilot-api-sdk"` and `require` it, and both builds type check `client.accounts.list()` as `Promise<Account[]>` (checked by hand).

## Decision

**Chosen option**: Option 2: A root `CopilotAdminClient` composing resource classes, with Zod schemas as the single source of runtime checks and types

`CopilotAdminClient` builds one `HttpClient` and an `AccountsApi` over it; `AccountsApi` parses inputs, calls `HttpClient`, and parses responses with Zod; the types are `z.infer` of the schemas; the error classes become public with a `code` field.

**Implementation skills**: `zod` (`anivar/zod-skill`, `.agents/skills/zod/`) · `api-and-interface-design` (`.agents/skills/api-and-interface-design/`) · `typescript-advanced-types` (`.agents/skills/typescript-advanced-types/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `tsdown` (`.agents/skills/tsdown/`) · `publint` (`publint/publint`, `.agents/skills/publint-package-export-validation-skill-for-npm-release-checks/`) · `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:
No persistence in the SDK. The schemas mirror the API's `accounts` table (`id uniqueidentifier`, `name nvarchar null`, `logo_url nvarchar null`, `created_at datetime2`) as `AccountDTOs.cs` serialises it (camelCase JSON).

| Schema (in `src/accounts/schemas.ts`) | Shape | Inferred type (exported from `.`) |
|---|---|---|
| `AccountSchema` | `z.object({ id: z.uuid(), name: z.string().nullable(), logoUrl: z.string().nullable(), createdAt: z.iso.datetime() })` | `Account` |
| `CreateAccountRequestSchema` | `z.object({ name: z.string().trim().min(1), logoUrl: z.url({ protocol: /^https?$/ }) })` | `CreateAccountRequest` (`z.input`) |
| `UpdateAccountRequestSchema` | same fields and rules as create (both required) | `UpdateAccountRequest` (`z.input`) |
| `UpdateAccountNoopSchema` | `z.object({ success: z.literal(true) })` | (part of the union) |
| `UpdateAccountResultSchema` | `z.union([AccountSchema, UpdateAccountNoopSchema])` | `UpdateAccountResult` |
| `DeletedAccountSchema` | `z.object({ id: z.uuid() })` | `DeletedAccount` |
| `AccountIdSchema` | `z.uuid()` | (argument check only) |

Request types use `z.input` and response types use `z.output` (`z.infer`); today they are the same shapes, but this keeps them right if a transform is ever added. Request fields are required and never `null`, matching the API's implicit required check (see AC-4); a partial update is not possible until the API's request DTOs change. Response `logoUrl` stays any nullable string, because the URL rule applies only to what the SDK writes.

`tsconfig.json` has `isolatedDeclarations`, so every exported schema constant needs an explicit type annotation (for example `export const AccountSchema: z.ZodObject<{ id: z.ZodUUID; name: z.ZodNullable<z.ZodString>; logoUrl: z.ZodNullable<z.ZodString>; createdAt: z.ZodISODateTime }> = z.object({ ... })`). Let `pnpm typecheck` confirm the exact Zod 4 type names.

The `z.infer` / `z.input` aliases live in `src/accounts/types.ts` beside the other accounts types; the schemas live in `src/accounts/schemas.ts`. `src/index.ts` is the only entry file; it re-exports every public value and every public type (types with `export type`), including `SumFn` from `src/sum/types.ts` and `AuthTokenProvider` from `src/http/types.ts`.

Other types:
- `CancelSignal` (in `src/accounts/types.ts`): `{ readonly aborted: boolean; addEventListener?: (...args: never[]) => unknown; removeEventListener?: (...args: never[]) => unknown; onabort?: ((...args: never[]) => unknown) | null }`. A real `AbortSignal` satisfies it, it is assignable to axios's `GenericAbortSignal`, and no axios type reaches the public `.d.ts`.
- `AccountRequestOptions = { signal?: CancelSignal }`.
- `CopilotAdminClientOptions = { baseURL: string }` (in `src/client/types.ts`).
- `AccountsResource` (in `src/accounts/types.ts`): an interface with the five method signatures; `AccountsApi` implements it.
- `ValidationIssue = { readonly path: readonly PropertyKey[]; readonly message: string; readonly code: string }` (in `src/errors/types.ts`), mapped from each Zod issue.
- `CopilotApiErrorCode = "HTTP_ERROR" | "NETWORK_ERROR" | "AUTH_TOKEN_ERROR" | "VALIDATION_ERROR"` (in `src/errors/types.ts`). `CopilotApiError` declares `abstract readonly code: CopilotApiErrorCode`; each subclass writes it as `override readonly code: "HTTP_ERROR" = "HTTP_ERROR"`, following the explicit annotation style of the existing `name` fields.
- `ValidationIssue.code` comes from each Zod issue's `code`, and `path` and `message` from the same issue.

Classes (one per file, constructor injection, no module state):

| Class | File | Constructor | Role |
|---|---|---|---|
| `CopilotAdminClient` | `src/client/copilot-admin-client.ts` | `(options: CopilotAdminClientOptions)` | Composition root: builds `HttpClient(options.baseURL)` and `readonly accounts: AccountsResource = new AccountsApi(http)`; `setAuthTokenProvider` delegates to `HttpClient`. Its private `HttpClient` field is a `#private` field, so it never appears in the declarations. |
| `AccountsApi` | `src/accounts/accounts-api.ts` | `(http: HttpClient)` | The five methods; parse in, call, parse out. |
| `ValidationError` | `src/errors/validation-error.ts` | `({ direction, operation, mutating, issues, cause })` | Builds the AC-10 message; holds `direction`, `operation`, and `issues`; keeps the Zod error as `cause` (typed `unknown`, so the error's own declaration names no Zod type). |

One shared helper, `parseWith<S extends z.ZodType>(schema: S, value: unknown, context: { direction: "request" | "response"; operation: string; mutating: boolean }): z.output<S>` in `src/accounts/parse.ts` (move it to a shared folder when the second resource arrives), runs `schema.safeParse`, maps the Zod issues to `ValidationIssue[]`, and throws `ValidationError` on failure. Its explicit return type satisfies `isolatedDeclarations`.

**State transitions**: none. Accounts have no lifecycle in the API.

**API surface** (SDK method → API call; `baseURL` is the API root that serves `/api/...`):

| SDK method | API call | Key inputs | Resolves to | Auth | Key errors |
|---|---|---|---|---|---|
| `accounts.list(options?)` | `GET /api/admin/accounts` | `signal?` | `Account[]` | bearer from provider | `HttpError` 401/403/500, `NetworkError`, `ValidationError` (response) |
| `accounts.get(id, options?)` | `GET /api/admin/accounts/{id}` | `id: string` (uuid, req), `signal?` | `Account` | bearer | `ValidationError` (request id), `HttpError` 404, `NetworkError`, `ValidationError` (response) |
| `accounts.create(input, options?)` | `POST /api/admin/accounts` | `name: string` (not blank, req), `logoUrl: string` (http or https url, req) | `Account` | bearer | `ValidationError` (request), `HttpError` 400/500, `ValidationError` (response) |
| `accounts.update(id, input, options?)` | `PATCH /api/admin/accounts/{id}` | `id` (uuid, req), `name` (req), `logoUrl` (http or https url, req) | `Account \| { success: true }` | bearer | `ValidationError` (request), `HttpError` 404, `ValidationError` (response) |
| `accounts.delete(id, options?)` | `DELETE /api/admin/accounts/{id}` | `id` (uuid, req) | `{ id }` | bearer | `ValidationError` (request id), `HttpError` 404, `ValidationError` (response) |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| any method | request URL | `CopilotAdminClientOptions.baseURL` joined by `HttpClient` with the fixed path `/api/admin/accounts` (from `AccountsController`'s route) plus the parsed `id` |
| any method | bearer token | the provider set with `CopilotAdminClient.setAuthTokenProvider`, held by `HttpClient` (spec 0004) |
| any method | cancel signal | the caller's `options.signal`, passed through |
| `get`, `update`, `delete` | `id` in the path | the `id` argument after `AccountIdSchema` parses it |
| `create`, `update` | request body | the caller's `input` after the request schema parses it (unknown keys stripped) |
| `list`, `get`, `create`, `update` | `Account.id`, `name`, `logoUrl`, `createdAt` | the API response body, parsed by `AccountSchema` |
| `update` | `{ success: true }` | the API response body for an update with no fields (unreachable with today's required fields, kept as a fallback), parsed by `UpdateAccountNoopSchema` |
| `delete` | `{ id }` | the API response body (`Ok(new { Id })`, serialised as `id`), parsed by `DeletedAccountSchema` |
| errors | `HttpError.status`, `data` | the API response, by `HttpClient` (spec 0004) |
| errors | `ValidationError.direction`, `operation`, `issues`, message | the `parseWith` context (which parse, the method name such as `accounts.create`, and whether it writes), and the Zod error's `issues` mapped to `ValidationIssue` |
| errors | `code` on each error class | a fixed literal per class (AC-12) |

**Key invariants**:
- Nothing is sent unless the id and input parse; the token provider is not called for a request that fails to parse.
- A method never resolves to data that did not pass its response schema.
- No built `.d.ts` file mentions axios; no public declaration names an internal class; Zod appears in the declarations only as the source the public types are inferred from.
- Every SDK error has a `code` that matches its class, so a consumer can match errors whichever module copy threw them.

**Security model**:
Authorization is entirely server side: the SDK sends the provider's bearer token and checks no roles. `logoUrl` is limited to http and https, so a stored `javascript:` or `data:` link cannot reach a consumer's `<img>` or `<a>` through the SDK. Parsing the `id` with `z.uuid()` before building the path means a value like `../users` can never change which route is called. `HttpClient` still refuses absolute paths, so the token cannot reach another host. Error messages never include the token. No PII beyond an account name and logo URL is handled; no compliance scope applies.

**Configuration required**: none. The consumer passes `baseURL` and the token provider in code.

**Critical test scenarios**:
- Happy path: `list` resolves parsed accounts and sends a bearer header; `create`, `get`, `update`, `delete` hit the right method and path with the parsed body, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**
- Update fallback: a valid `update` where the fake adapter answers `{ success: true }` resolves to `{ success: true }`, verifies **AC-5**
- Response drift: an account missing `createdAt`, a non uuid `id`, or `createdAt: "2026-10-03"` rejects with `ValidationError` `direction: "response"`; an extra key is stripped, verifies **AC-7**, **AC-10**, **AC-11**
- Bad input: `get("../users")`, `update("abc", valid)`, `create({ name: "  ", logoUrl: "https://x.test/a.png" })`, `create({ name: "A", logoUrl: "javascript:alert(1)" })`, and `update(id, {})` reject with `ValidationError` `direction: "request"`, and the fake adapter records no request and the provider no call, verifies **AC-8**, **AC-9**, **AC-11**
- Not found: a 404 with body `"Account not found"` rejects with `HttpError` (`status: 404`, `code: "HTTP_ERROR"`), verifies **AC-12**, **AC-13**
- Cancel: an aborted `CancelSignal` stub makes the fake adapter reject with `CanceledError`, and the call rejects with `NetworkError` (`aborted: true`); a call without a signal sends no `signal` key, verifies **AC-14**, **AC-16**
- Message templates: a bad `get` response and a bad `create` response produce the read and write messages, verifies **AC-10**
- Auth: no provider sends no `Authorization`; a failing provider rejects with `AuthTokenError`, verifies **AC-1**, **AC-13**

## Build plan

Skateboard: first make one real call usable end to end from the package (`client.accounts.list()`), then grow the other four methods and the error surface around it.

1. [x] Add `zod` (a current 4.x release) with `pnpm add zod`, satisfies **AC-16**
2. [x] Remove the `./types` entry: move the `SumFn` re-export into `src/index.ts` (`export type { SumFn } from "@/sum/types"`), delete `src/types/`, set `tsdown.config.ts` `entry` to `{ index: "src/index.ts" }`, delete the `"./types"` block from `package.json` `exports`, and rebuild to confirm publint and arethetypeswrong pass with one entry, satisfies **AC-15**, **AC-18**
3. [x] Add `code` to the errors: `CopilotApiErrorCode` and the abstract `code` on `CopilotApiError`, a literal `code` on `HttpError`, `NetworkError`, `AuthTokenError`; extend the existing error tests, satisfies **AC-12**
4. [x] Add `ValidationError`, `ValidationIssue`, and the `parseWith` helper (with its `operation` and `mutating` context and the three message templates), with tests, satisfies **AC-10**, **AC-11**
5. [x] Add `AccountSchema`, `CancelSignal`, `AccountRequestOptions`, `AccountsResource`, `AdminResources`, `AccountsApi.list`, `AdminApi`, `CopilotAdminClient` (with `setAuthTokenProvider`), and their exports from `src/index.ts`; teach `tests/http/fake-adapter.ts` to reject with `CanceledError` on an aborted signal; test `list` through `HttpClient` and the fake adapter (happy path, empty list, bearer header, response drift, signal), satisfies **AC-1**, **AC-2**, **AC-7**, **AC-10**, **AC-14**, **AC-15**
6. [x] Add `AccountIdSchema`, `get`, and `delete` with `DeletedAccountSchema`; test the id check, 404, and delete result, satisfies **AC-3**, **AC-6**, **AC-8**, **AC-13**
7. [x] Add the create and update request schemas, `UpdateAccountResultSchema`, `create`, and `update`, plus their exported types; test bodies, the no op union, and invalid input, satisfies **AC-4**, **AC-5**, **AC-9**, **AC-15**
8. [x] Run `pnpm build`, `pnpm typecheck`, `pnpm check`, and `pnpm test`; confirm `dist/` exports no schema or internal class, and that a search of `dist/*.d.ts` and `dist/*.d.cts` finds no `axios`; refresh `sandbox/` from a fresh tarball and check `import`, `require`, and the `list()` type by hand; change `sandbox/demo.ts` to import `SumFn` from the root (per the amended spec 0003); update the README with a `CopilotAdminClient` example and drop every `/types` import and the `./types` section, satisfies **AC-15**, **AC-16**, **AC-17**, **AC-18**

## Consequences

**Positive**:
- Consumers get one client, one place to set auth, and typed accounts calls that are really checked at runtime.
- Each shape is defined once (the schema) and the type follows it, so the two cannot drift.
- API drift (a renamed field, a bad timestamp) fails loudly at the SDK boundary with a clear `ValidationError`.
- Errors are matchable by `code` across the ESM and CJS copies, which resolves the spec 0004 follow up on public errors.
- The `CopilotAdminClient` → resource class shape gives the other admin resources an obvious home: each becomes a property on the client.

**Negative / tradeoffs**:
- A second runtime dependency (Zod 4) ships with the tarball, and the built `.d.ts` files import Zod's types, so consumers' TypeScript resolves Zod's types too.
- `isolatedDeclarations` forces verbose Zod type annotations on every exported schema constant.
- A response that fails its schema after a successful write leaves the caller with an error even though the change happened; the message says so, but the caller must decide whether to refetch.
- `z.uuid()` is strict (RFC 9562 version and variant bits): an id inserted by hand that is not a real UUID would be unreachable by `get`, `update`, and `delete`, and would fail `list` parsing.
- `update` returns a union, so every caller narrows it (`"success" in result`), even though the `{ success: true }` branch cannot happen with today's required fields.
- Partial updates are impossible: every update sends both `name` and `logoUrl`, so a caller changing only the name must send the current logo URL too. This follows the API's request DTOs, which this feature does not change.
- `list` has no paging because the API has none; a very large account table loads in one response.
- `HttpClient` and axios now end up in `dist/`, which reverses spec 0004's AC-10 check that `dist/` holds no axios import (it was true only while nothing used the client).

- Removing `./types` is a breaking change to the package shape from spec 0001: any consumer importing `@ics-ai/copilot-api-sdk/types` must switch to the root. Only the local sandbox does today.

**Neutral**:
- One entry means one place to look for everything, and one fewer `exports` block for publint and arethetypeswrong to check.
- `createdAt` stays an ISO string; consumers convert it to a `Date` themselves when they need one.
- `client.accounts` sits straight on the client; the class name already says these are admin routes.
- `CopilotAdminClient.setAuthTokenProvider` follows `HttpClient`'s setter (spec 0004), so the token source can arrive after construction.

## Follow-up

- [ ] Spec 0004 AC-10 (`dist/` holds no `HttpClient` or axios) no longer holds once this ships; mark it as overtaken by this spec when spec 0004 is closed.
- [ ] The scope's Deferred item **Public SDK errors** is resolved by this spec (AC-12, AC-15); remove or mark it when the scope is next reconciled.
- [ ] Update root `AGENTS.md` (owned by `/sync`): `## Stack` package shape becomes a single `.` entry, and the `## Rules` folder by feature line names only `src/index.ts` as the entry file.
- [ ] If the API's request DTOs in `AccountDTOs.cs` become nullable (`string?`), relax the create and update schemas to optional fields so partial updates work; the `{ success: true }` fallback is already in place.
- [ ] If consumers need to narrow errors by `code` without `instanceof`, consider exported type guards (`isHttpError` and so on) in a later spec.
- [ ] Ask the API team to page `GET /api/admin/accounts` before the account count grows large; the SDK can then add paging without breaking `list()`.
- [ ] Record `zod` as a runtime dependency in root `AGENTS.md` `## Stack`, plus the schema convention (schemas in `src/<feature>/schemas.ts`, types via `z.infer`, explicit annotations for `isolatedDeclarations`) in `## Rules` (owned by `/sync`).
- [ ] Add to root `AGENTS.md` `## Agent skills` (owned by `/sync`): [zod](.agents/skills/zod/), `anivar/zod-skill`, Zod 4 schemas, parsing, and inference (installed 2026-10-03).
- [ ] Add to the root `AGENTS.md` `Declined:` line (owned by `/sync`): the Zod MCP servers `@nurjaks/zod-mcp-server` and Zod Contract Mock Forge (Agent Skill / MCP discovery, 2026-10-03).
