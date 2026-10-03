# 0004. Internal HTTP client on axios

**Date**: 2026-10-03
**Status**: In Progress

## Summary

The SDK gets an internal `HttpClient` class that later SDK features use to call the Copilot API. It wraps axios, sends `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` requests to paths under one base URL, and adds `Authorization: Bearer <token>` from a pluggable async token provider. Each method resolves to the response body as plain `unknown` data, and failures reject with one of three SDK errors (`HttpError`, `NetworkError`, `AuthTokenError`) that all extend a base `CopilotApiError`. Nothing here is exported to consumers yet; it is plumbing, unit tested through a fake axios adapter passed into the constructor.

## Requirements

**User stories**:
- As an SDK feature author, I want `new HttpClient(baseURL)` with `get`, `post`, `put`, `patch`, and `delete` so that I can call any Copilot API path without repeating URL, header, or error handling code.
- As an SDK feature author, I want to plug in any async token source (MSAL, Auth0, a custom one) through `setAuthTokenProvider` so that every request is authenticated without the client knowing where tokens come from.
- As an SDK feature author, I want failures to reject with SDK owned error classes so that I can tell an API rejection, a network failure, and a token failure apart without handling axios types.

**Acceptance criteria**:
- **AC-1**: `new HttpClient(baseURL)` exposes `get`, `post`, `put`, `patch`, and `delete`; each sends its own HTTP method to the URL formed by always appending the path to `baseURL` (base `https://api.example.com/v1` with path `/chats` or `chats` gives `https://api.example.com/v1/chats`; repeated slashes at the join collapse to one).
- **AC-2**: `post`, `put`, and `patch` send their `body` argument as the request body (axios serialises plain objects as JSON); `get` and `delete` take no body. Every method accepts optional `options.params` (query values), `options.headers` (extra request headers), and `options.signal` (cancellation), and passes them to the request unchanged.
- **AC-3**: On a 2xx status, the method resolves to the response body exactly as axios parsed it, typed `unknown` (no generics; callers narrow it themselves).
- **AC-4**: `setAuthTokenProvider(provider)` accepts any `() => Promise<string>`. The provider is called exactly once per request, before the request is sent, and the request carries `Authorization: Bearer <token>`. That header replaces any `Authorization` header the caller passed. Setting a new provider affects only requests started after the call.
- **AC-5**: When no provider has been set, the request is sent with no `Authorization` header added by the client (caller supplied headers pass through as given).
- **AC-6**: When the provider rejects, throws, or resolves to anything other than a non empty string (an empty string, or `undefined`/`null` from a plain JS provider), the method rejects with `AuthTokenError` (which extends `CopilotApiError`) whose `cause` is the original error (or is undefined for an empty or missing token), and no request is sent.
- **AC-7**: On any non 2xx status, the method rejects with `HttpError` (which extends `CopilotApiError`) carrying `status`, `statusText`, `method`, `url`, and `data` (the parsed error body). A 401 is not retried and the provider is not called again.
- **AC-8**: When no response arrives, for any reason (network failure, DNS failure, abort through `options.signal`, or a request axios could not build or send, such as a body that cannot be serialised), the method rejects with `NetworkError` (which extends `CopilotApiError`) carrying `method`, `url`, `aborted` (`true` only for a cancellation), and the original axios error as `cause`.
- **AC-9**: A path that is an absolute URL (starts with a scheme such as `https:`, or with `//`) rejects with a `TypeError` before the token provider is called or anything is sent, so the bearer token can never go to another host.
- **AC-10**: `HttpClient`, its types, and the error classes are not reachable from the `.` or `./types` entries: neither entry file exports them, the built `dist/` files contain none of them and no `axios` import, and publint plus arethetypeswrong still pass.
- **AC-11**: `axios` is listed in `dependencies`, and `HttpClient` is unit tested in `tests/http/` with a fake axios adapter passed through the constructor (no global patching, no `vi.mock`).

## Decision

**Chosen option**: Option 2: Wrap axios in an `HttpClient` that owns URL joining, auth, and status checks

`HttpClient` builds its own axios instance (taking an optional `adapter` for tests), joins paths itself, awaits the token provider itself, treats every status as a response (`validateStatus: null`), and maps outcomes to `unknown` data or one of three `CopilotApiError` subclasses.

**Implementation skills**: `api-and-interface-design` (`.agents/skills/api-and-interface-design/`) · `typescript-advanced-types` (`.agents/skills/typescript-advanced-types/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `tsdown` (`.agents/skills/tsdown/`) · `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:
No persisted data. Per instance state only (never module level, per the dual build rule in `AGENTS.md`):

| Field | Type | Required | Set by |
|---|---|---|---|
| `#baseURL` | `string` | yes | constructor `baseURL` |
| `#axios` | `AxiosInstance` | yes | constructor, `axios.create({ validateStatus: null, adapter? })` |
| `#tokenProvider` | `AuthTokenProvider \| undefined` | no | `setAuthTokenProvider` |

Types in `src/http/types.ts`:
- `HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"`
- `AuthTokenProvider = () => Promise<string>`
- `RequestOptions = { params?: Record<string, string | number | boolean>; headers?: Record<string, string>; signal?: GenericAbortSignal }` (`GenericAbortSignal` comes from axios, because `tsconfig.json` has no DOM or Node lib to supply `AbortSignal`; a real `AbortSignal` satisfies it)
- `HttpClientOptions = { adapter?: AxiosAdapter }`

Error classes in `src/errors/` (one file each, kebab case):

| Class | Extends | Fields (all `readonly`) | Thrown when |
|---|---|---|---|
| `CopilotApiError` | `Error` | `name`, `message`, `cause` | never directly (abstract base) |
| `HttpError` | `CopilotApiError` | `status: number`, `statusText: string`, `method: HttpMethod`, `url: string`, `data: unknown` | non 2xx response (AC-7) |
| `NetworkError` | `CopilotApiError` | `method: HttpMethod`, `url: string`, `aborted: boolean` | no response (AC-8) |
| `AuthTokenError` | `CopilotApiError` | `method: HttpMethod`, `url: string` | provider failed or gave an empty token (AC-6) |

Each class sets `name` to its own class name. Messages follow `"<METHOD> <url> failed: <reason>"` and never include the token.

**State transitions**:
One request: path check → token (if a provider is set) → send → status check → resolve `data`, or reject at the step that failed (`TypeError`, `AuthTokenError`, `NetworkError`, `HttpError`).

**API surface** (internal class, not exported):
| Member | Signature | Key outputs | Auth | Key errors |
|---|---|---|---|---|
| constructor | `new HttpClient(baseURL: string, options?: HttpClientOptions)` | instance | none | none (no URL validation, by choice) |
| `setAuthTokenProvider` | `(provider: AuthTokenProvider): void` | none | sets the bearer source | none |
| `get` | `(path: string, options?: RequestOptions): Promise<unknown>` | response body | bearer if provider set | `TypeError`, `AuthTokenError`, `NetworkError`, `HttpError` |
| `delete` | `(path: string, options?: RequestOptions): Promise<unknown>` | response body | same | same |
| `post` | `(path: string, body?: unknown, options?: RequestOptions): Promise<unknown>` | response body | same | same |
| `put` | `(path: string, body?: unknown, options?: RequestOptions): Promise<unknown>` | response body | same | same |
| `patch` | `(path: string, body?: unknown, options?: RequestOptions): Promise<unknown>` | response body | same | same |

All five public methods delegate to one private `#send(method, path, body, options)`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| any method | request URL | derived: `baseURL` with trailing `/` trimmed + `"/"` + `path` with leading `/` trimmed (AC-1); computed by `HttpClient`, not axios `baseURL`, so the fake adapter sees the final URL |
| any method | HTTP method | the method called, mapped to `HttpMethod` (AC-1) |
| `post` / `put` / `patch` | request body | `body` param, passed as axios `data` (AC-2) |
| any method | query string | `options.params`, passed as axios `params`; encoded by axios (AC-2) |
| any method | `Authorization` header | `Bearer ${await provider()}` from `#tokenProvider`, set after caller headers so it wins (AC-4); absent when no provider (AC-5) |
| any method | resolved value | `response.data` from axios, default JSON parsing (an empty body arrives as axios gives it, usually `""`) (AC-3) |
| any method | success vs `HttpError` | `response.status` checked by `HttpClient`: 200 to 299 succeeds; `validateStatus: null` means axios never decides, so real and fake adapters behave the same (AC-3, AC-7) |
| `HttpError` | `status`, `statusText`, `data` | `response.status`, `response.statusText`, `response.data` (AC-7) |
| all errors | `method`, `url` | the method called and the joined URL above (AC-6, AC-7, AC-8) |
| `NetworkError` | `aborted` | `axios.isCancel(error)` on the caught error (AC-8) |
| `NetworkError`, `AuthTokenError` | `cause` | the caught axios error, or the provider's rejection (AC-6, AC-8) |
| absolute path check | refuse or allow | regex on `path`: `/^([a-z][a-z\d+\-.]*:|\/\/)/i` (AC-9) |

**Key invariants**:
- The provider is awaited before the adapter is called; if it fails, the adapter is never called (AC-6).
- Every request goes to `baseURL`; an absolute path is refused before any token is fetched (AC-9).
- No state outside instances; two `HttpClient`s never share a provider or axios instance.
- Callers only ever see `unknown` data, `TypeError`, or an `CopilotApiError` subclass; an `AxiosError` never escapes (it may sit in `cause`).
- No token appears in any error `message`.
- Nothing under `src/http/` or `src/errors/` is re exported by `src/index.ts` or `src/types/index.ts` (AC-10).

**Security model**:
The bearer token is the only secret. It is fetched per request, held only in the outgoing headers, never logged, never put in an error message, and never sent to a host other than `baseURL` (AC-9). `HttpError.data` may contain whatever the API returns in an error body; callers own what they log. No https check on `baseURL` (the caller decides, so `http://localhost` works in development).

**Configuration required**:
None. No environment variables or credentials; the base URL and token provider come from the calling code.

**Critical test scenarios** (all in `tests/http/http-client.test.ts`, using a `FakeAdapter` test helper that records each axios config and returns a queued response or throws):
- Happy path: each of the five methods sends its method to `https://api.example.com/v1/chats` for both `/chats` and `chats`, and resolves to the queued `data`, verifies **AC-1**, **AC-3**
- Inputs: `post`/`put`/`patch` pass `body` as `data`; `params`, `headers`, and `signal` reach the adapter config, verifies **AC-2**
- Auth: with a provider, the adapter sees `Authorization: Bearer t1`, a caller `Authorization` is overwritten, the provider runs once per request, and a replaced provider is used next time; with none, no header is added, verifies **AC-4**, **AC-5**
- Token failure: a rejecting provider, a throwing provider, and a `""`, `undefined`, or `null` token each reject with `AuthTokenError` (`instanceof CopilotApiError`), and the adapter records zero calls, verifies **AC-6**
- HTTP failure: a queued 404 and a queued 401 reject with `HttpError` carrying status, statusText, method, url, data; the 401 calls the provider once only, verifies **AC-7**
- Network failure: the adapter throwing a plain axios network error gives `NetworkError` with `aborted: false`; throwing `new CanceledError()` gives `aborted: true`, verifies **AC-8**
- Absolute path: `get("https://evil.example/x")` and `get("//evil.example/x")` reject with `TypeError`, with zero provider and adapter calls, verifies **AC-9**
- Not exported (manual, no unit test): after `pnpm build`, `dist/` contains no `HttpClient` and no `axios`, and in `sandbox/` (refreshed from a fresh tarball), `Object.keys` of the `@ics-ai/copilot-api-sdk` and `@ics-ai/copilot-api-sdk/types` imports show no `HttpClient` or error class keys, verifies **AC-10**

## Build plan

Skateboard: get one authenticated `GET` working end to end through the fake adapter first, then grow the remaining methods, inputs, and failure paths around it.

1. Add `axios` (a current 1.x release) to `dependencies` with `pnpm add axios`, satisfies **AC-11**
2. Add `src/errors/copilot-api-error.ts` (abstract `CopilotApiError`, taking `message` and `{ cause }`) and `src/errors/http-error.ts`, `network-error.ts`, `auth-token-error.ts`, each with TSDoc and explicit field types, satisfies **AC-6**, **AC-7**, **AC-8**
3. Add `src/http/types.ts` (`HttpMethod`, `AuthTokenProvider`, `RequestOptions`, `HttpClientOptions`) with TSDoc, satisfies **AC-2**, **AC-4**
4. Add `src/http/http-client.ts` with the constructor, `setAuthTokenProvider`, `#send` (path check, URL join, token, axios request, status check, error mapping), and `get`; add `tests/http/fake-adapter.ts` and the first tests for an authenticated `GET`, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-9**, **AC-11**
5. Add `post`, `put`, `patch`, and `delete` on top of `#send`, with tests for body, params, headers, and signal, satisfies **AC-1**, **AC-2**
6. Add the failure tests (token failure, 404 and 401, network error, cancellation), satisfies **AC-6**, **AC-7**, **AC-8**
7. Run `pnpm build` (publint and arethetypeswrong pass; check `dist/` has no `HttpClient` or `axios`), `pnpm typecheck`, `pnpm check`, and `pnpm test`, then check the exports by hand in `sandbox/`, satisfies **AC-10**, **AC-11**

## Consequences

**Positive**:
- SDK features call the API with one line and get consistent auth and errors.
- Callers never handle axios types; swapping the transport later only touches `src/http/http-client.ts`.
- Status checks, URL joining, and token handling live in `HttpClient` itself, so the fake adapter tests exercise the same code paths as production.
- Requests can never leak the token to another host.

**Negative / tradeoffs**:
- Consumers now install axios (and its dependencies) with the tarball even though nothing reachable uses it yet; the sandbox install in spec 0003 now needs registry access.
- axios is several times larger than a fetch based wrapper, which matters once a browser bundle uses this.
- `unknown` results mean every SDK feature narrows the body itself; there is no shared typed parsing yet.
- No timeout by default: a caller that passes no `signal` can wait as long as the network does.
- No 401 retry: an expired token surfaces as `HttpError` and the caller must retry.
- Errors are matched with `instanceof` only; that is safe while they stay internal, but breaks across the ESM and CJS copies once consumers catch them (see Follow-up).
- `HttpError extends CopilotApiError extends Error` uses inheritance on purpose; it stays at one level of SDK owned inheritance, which `AGENTS.md` allows.

**Neutral**:
- `RequestOptions.signal` is typed with axios's `GenericAbortSignal` rather than `AbortSignal`, because the project's `lib` is `ES2023` only.
- `HttpClient` deviates from pure constructor injection for the token provider (a setter), because the token source usually arrives after construction.
- An empty response body resolves as axios parses it (usually `""`), not `undefined`.

## Follow-up

- [ ] When the first public SDK feature can throw these errors, decide how to export them and add a stable discriminator (a `code` field or type guards) so consumers mixing `import` and `require` copies can match them; `instanceof` alone fails there.
- [ ] Revisit a default timeout and a single 401 retry (which needs a way to force a token refresh) once a real SDK feature calls the API.
- [ ] Record `axios` as a runtime dependency in root `AGENTS.md` `## Stack` (owned by `/sync`).
- [ ] Add to the root `AGENTS.md` `Declined:` line (owned by `/sync`): axios Agent Skill (`slanycukr/riot-api-project@axios`) and the GitMCP axios docs MCP server (Agent Skill / MCP discovery, 2026-10-03).
