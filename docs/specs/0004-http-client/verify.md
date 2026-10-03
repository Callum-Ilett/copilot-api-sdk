# Verify: HTTP client · spec 0004 · updated 2026-10-03
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [x] `pnpm test` → all tests in `tests/http/` pass → AC-1 to AC-9, AC-11
- [x] `pnpm typecheck` → no errors (every export has an explicit type under `isolatedDeclarations`) → AC-11
- [x] `pnpm check` → Biome reports no issues → AC-11
- [x] `pnpm build` → build completes, attw and publint report no problems → AC-10
- [x] `grep -rlE 'HttpClient|CopilotApiError|HttpError|NetworkError|AuthTokenError|axios' dist` → no matches → AC-10
- [x] `grep -A3 '"dependencies"' package.json` → `axios` at a 1.x range → AC-11
- [x] `grep -rn 'vi.mock\|vi.stubGlobal' tests/http` → no matches (the fake adapter comes in through the constructor) → AC-11

## Behaviour (read the tests or run them in a scratch script)
- [x] `get`, `delete`, `post`, `put`, `patch` against `https://api.example.com/v1` with `/chats` and `chats` → the adapter sees its own method and `https://api.example.com/v1/chats` → AC-1
- [x] Base `https://api.example.com/v1//` with `/chats` → URL is `https://api.example.com/v1/chats` (slashes collapse at the join) → AC-1
- [x] `post`/`put`/`patch` with `{ title: "hi" }` → the adapter gets that body as JSON; `get`/`delete` send no body → AC-2
- [x] `params`, `headers`, and a signal passed in `options` → the adapter sees them unchanged (the signal is the same object) → AC-2. The test uses a `FakeSignal` class instance, not a real `AbortSignal`, because the project `lib` has no DOM types; cancellation itself is covered by the `CanceledError` step under AC-8
- [x] A 2xx response with `{ ok: true }` → the method resolves to `{ ok: true }`; a 204 with `""` resolves to `""` → AC-3
- [x] Provider set → each request carries `Authorization: Bearer <token>`, the provider runs once per request, and a caller `authorization` (any casing) is replaced → AC-4
- [x] Swap the provider while a request is in flight → that request keeps the old token; the next one uses the new token → AC-4
- [x] No provider → no `Authorization` header added; a caller supplied one passes through → AC-5
- [x] Provider rejects, throws, or returns `""`, `undefined`, or `null` → `AuthTokenError` (an instance of `CopilotApiError`), `cause` is the error (or `undefined` for a missing token), zero adapter calls → AC-6
- [x] A 404 and a 401 → `HttpError` with `status`, `statusText`, `method`, `url`, `data`; the provider ran once only; the message has no token → AC-7
- [x] Adapter throws a network `AxiosError` → `NetworkError` with `aborted: false` and that error as `cause`; a `CanceledError` → `aborted: true` → AC-8
- [x] `get("https://evil.example/x")`, `get("//evil.example/x")`, `get("HTTP://evil.example/x")` → `TypeError`, zero provider calls, zero adapter calls → AC-9
- [ ] Manual, in `sandbox/` (refreshed from a fresh tarball), `Object.keys` of the `@ics-ai/copilot-api-sdk` and `@ics-ai/copilot-api-sdk/types` imports → none of `HttpClient` or the four error classes → AC-10

## Value sourcing
- [x] Request URL: vary the base trailing slashes and the path leading slashes → always exactly one `/` at the join
- [x] HTTP method: each of the five methods → the adapter sees the matching method (axios lowercases it)
- [x] Request body: `post` with a body versus `get` → `data` is set only when a body is given
- [x] Query string: `params: { page: 2, all: true }` → reaches the adapter as given, encoded by axios
- [x] `Authorization`: provider token `t1`, then `t2` → the header follows the provider at request start; no provider → no header
- [x] Resolved value: queue `{ a: 1 }`, then `""` → resolves to exactly what the adapter returned
- [x] Success vs `HttpError`: status 200, 299 → resolve; 199, 300, 404 → `HttpError` (`validateStatus: null`, so `HttpClient` decides, not axios)
- [x] `HttpError` fields: queue status 418, statusText `I'm a teapot`, data `{ e: 1 }` → all three copied onto the error
- [x] Error `method` and `url`: any failure → match the call made and the joined URL
- [x] `NetworkError.aborted`: network error → `false`; cancel → `true`
- [x] `cause`: the provider's rejection value, or the thrown axios error, kept by reference
- [x] Absolute path check: `mailto:x`, `a+b.c:x`, `//x` → refused; `chats:archive` is also refused (it looks like a scheme), so callers should not use a colon in the first path segment

## Acceptance criteria coverage
- AC-1 → methods and URLs tests, slash collapse step · AC-2 → inputs tests · AC-3 → 2xx body steps · AC-4 → auth tests · AC-5 → no provider step · AC-6 → token failure tests · AC-7 → HTTP failure tests · AC-8 → network failure tests · AC-9 → absolute path tests · AC-10 → build, dist grep, sandbox exports check · AC-11 → dependency check, no `vi.mock`, tests in `tests/http/`
