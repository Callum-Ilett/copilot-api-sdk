# Verify: Admin accounts API · spec 0005 · updated 2026-10-04
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [x] `pnpm build` → build completes, `[attw] No problems found`, `[publint] No issues found`, and `dist/` holds only `index.{js,cjs,d.ts,d.cts}` (no `types.*`) → AC-16, AC-18
- [x] `pnpm typecheck`, `pnpm check`, `pnpm test` → all pass; the suite includes `tests/accounts/` and `tests/client/` → AC-16
- [x] `grep -nE "axios|HttpClient|AccountsApi|AdminApi|parseWith" dist/*.d.ts dist/*.d.cts` → no matches → AC-15
- [x] `grep -nE "^export (declare )?const .*Schema" dist/*.d.ts` → no matches (schemas appear only as unexported `declare const` sources for the types) → AC-15
- [x] `grep -n '^export type' dist/index.d.ts` → lists `Account`, `AccountRequestOptions`, `AccountsResource`, `AdminResources`, `AuthTokenProvider`, `CancelSignal`, `CopilotAdminClientOptions`, `CopilotApiErrorCode`, `CreateAccountRequest`, `DeletedAccount`, `UpdateAccountRequest`, `UpdateAccountResult`, `ValidationIssue` → AC-15
- [x] `grep -n '"./types"' package.json; ls src/types` → no `./types` export, no `src/types/` folder; `tsdown.config.ts` entry is `{ index: "src/index.ts" }` → AC-18
- [x] `grep -A3 '"dependencies"' package.json` → `zod` at a 4.x range → AC-16

## Sandbox (by hand, from a fresh tarball)
- [x] `pnpm pack --silent --out sandbox/copilot-api-sdk.tgz && pnpm -C sandbox install --force && pnpm -C sandbox ts` → prints `list get create update delete`, with `demo.ts` importing from the root → AC-18
- [x] In `sandbox/`, an `.mjs` file doing `import { CopilotAdminClient } from "@ics-ai/copilot-api-sdk"` and a `.cjs` file doing `require("@ics-ai/copilot-api-sdk")` both load and construct the client → AC-17
- [x] In `sandbox/`, `.mts` and `.cts` files with `const p: Promise<Account[]> = client.admin.accounts.list()` type check under `module`/`moduleResolution` `nodenext` with `lib` `es2023,dom`, and a `// @ts-expect-error` assigning it to `Promise<string>` holds → AC-17
- [x] Importing `@ics-ai/copilot-api-sdk/types` from the sandbox fails to resolve → AC-18

## Behaviour (against a fake adapter or a live API)
- [x] `list()` with a provider set → `GET {baseURL}/api/admin/accounts` with `Authorization: Bearer <token>`; resolves parsed accounts; `[]` resolves `[]` → AC-1, AC-2
- [x] Any call with no provider set → no `Authorization` header → AC-1
- [x] `get(id)` → `GET …/api/admin/accounts/{id}`; a 404 `"Account not found"` → `HttpError` `status: 404`, `code: "HTTP_ERROR"`, `data: "Account not found"` → AC-3, AC-13
- [x] `create({ name: "  Acme  ", logoUrl: "https://…" })` → `POST …/api/admin/accounts` with body `{ name: "Acme", logoUrl }`; resolves the parsed account; a 400 → `HttpError` with the problem details object as `data` → AC-4, AC-13
- [x] `update(id, input)` → `PATCH …/api/admin/accounts/{id}` with both fields; an account body resolves the account, `{ success: true }` resolves `{ success: true }`, `{ success: false }` → response `ValidationError` → AC-5
- [x] `delete(id)` → `DELETE …/api/admin/accounts/{id}`; `{ id }` resolves `{ id }`; `{ Id }` (wrong casing) → response `ValidationError` with the write message → AC-6, AC-10
- [x] Response drift: an account missing `createdAt`, with `id: "42"`, or with `createdAt: "2026-10-03"` → `ValidationError` `direction: "response"`, `issues[0].path` pointing at the field; an extra key is stripped from the result → AC-7, AC-10, AC-11
- [x] `get("../users")`, `get("")`, `delete("abc")`, `update("abc", valid)`, `update(id, {})` → `ValidationError` `direction: "request"`, message `"<op> failed: invalid request input"`, no request recorded, provider not called → AC-8, AC-11
- [x] `create` with `name: "  "`, `logoUrl: "javascript:alert(1)"`, `logoUrl: "not a url"`, no `logoUrl`, or `name: 7` → `ValidationError` `direction: "request"`, no request, provider not called → AC-9
- [x] Message templates: bad `get` response → `"accounts.get failed: the API response did not match the expected shape"`; bad `create` response → same plus `"; the change may already have been applied"` → AC-10
- [x] Every error has its fixed `code`: `HttpError` `"HTTP_ERROR"`, `NetworkError` `"NETWORK_ERROR"`, `AuthTokenError` `"AUTH_TOKEN_ERROR"`, `ValidationError` `"VALIDATION_ERROR"`; `ValidationError` keeps the Zod error as `cause` → AC-11, AC-12
- [x] 401, 403, 500 → `HttpError` with that status; a transport failure → `NetworkError` `aborted: false`; a throwing provider → `AuthTokenError`, nothing sent → AC-13
- [x] An aborted signal → `NetworkError` `aborted: true`; a live signal is passed to the transport by reference; `{}` options → no `signal` key in the request config → AC-14

## Value sourcing
- [x] Request URL: construct with `baseURL` `"https://a.test"` and `"https://a.test/"` → both give `https://a.test/api/admin/accounts` (no double slash); a different `baseURL` changes only the origin → Value sourcing: request URL
- [x] Bearer token: switch the provider with `setAuthTokenProvider` between two calls → the second call carries the new token, the first the old → Value sourcing: bearer token
- [x] Cancel signal: the exact signal object passed in `options` is the one the transport sees → Value sourcing: cancel signal
- [x] Path id: an uppercase UUID passes and appears in the path as given; any non UUID never reaches the path → Value sourcing: `id` in the path
- [x] Request body: unknown input keys (`admin: true`) are absent from the sent body; `name` is sent trimmed → Value sourcing: request body
- [x] Account fields: `id`, `name`, `logoUrl`, `createdAt` in the result equal the response body's values; `name: null` and `logoUrl: null` pass → Value sourcing: Account fields
- [x] Update fallback: `{ success: true }` from the API comes back unchanged → Value sourcing: `{ success: true }`
- [x] Delete result: the `id` in the result is the response body's `id` (camelCase), not the argument → Value sourcing: `{ id }`
- [x] `HttpError.status` and `data` match the API response; `ValidationError.operation` matches the method name (`accounts.update`, not `update`) and `mutating` drives the write suffix → Value sourcing: errors

## Acceptance-criteria coverage
- AC-1 … behaviour steps 1, 2; value sourcing bearer token
- AC-2 … behaviour step 1
- AC-3 … behaviour step 3
- AC-4 … behaviour step 4
- AC-5 … behaviour step 5
- AC-6 … behaviour step 6
- AC-7 … behaviour step 7
- AC-8 … behaviour step 8
- AC-9 … behaviour step 9
- AC-10 … behaviour steps 6, 7, 10
- AC-11 … behaviour steps 7, 8, 11
- AC-12 … behaviour step 11
- AC-13 … behaviour steps 3, 4, 12
- AC-14 … behaviour step 13
- AC-15 … command steps 3, 4, 5
- AC-16 … command steps 1, 2, 7
- AC-17 … sandbox steps 2, 3
- AC-18 … command steps 1, 6; sandbox steps 1, 4
