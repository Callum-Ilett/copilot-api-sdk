# 0004. Internal HTTP client on axios · rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md`; this file explains why.

## Context

Release 1 shipped an installable package with one pure function. Release 2 starts talking to the Copilot API, and every later SDK feature needs the same plumbing: send a request to a path under one base URL, attach a JWT access token, and turn the outcome into either data or a clear failure. Without one shared client, each feature would repeat URL joining, header handling, and status checks, and drift apart.

The forces are specific. The SDK must run in Node 22+ and in browsers. The token comes from whatever auth library the host app uses, so the client can only see an async function that returns a string. `AGENTS.md` requires constructor injection for collaborators and fakes injected through constructors in tests, with no global or module patching. The dual ESM and CJS build means no module level state, and `instanceof` across the two copies is unreliable. `tsconfig.json` uses `lib: ["ES2023"]` with no DOM or Node types, so `fetch`, `URL`, and `AbortSignal` are not typed in source. The class must stay internal: nothing new is exported in Release 2.

The engineer also set hard requirements: the transport must not be the native `fetch` API directly; methods return the plain response data with no generics; failures use a base SDK error with subclasses; a missing provider sends unauthenticated requests; a failing provider sends nothing; absolute paths are refused.

## Options considered

### Option 1: Wrap ky

A small wrapper over `fetch` that returns a standard `Response`, throws `HTTPError` on non 2xx, supports async `beforeRequest` hooks, and accepts a custom `fetch` for tests.

**Pros**:
- Small (a few KB) and built on web standards, so browser bundles stay light.
- Its error already carries the unread `Response`, which maps cleanly to `HttpError`.
- Test injection through a custom `fetch` fits constructor injection.

**Cons**:
- Ships as ESM only, so the CJS build must bundle it or rely on Node 22.12+ loading ESM through `require`, while `engines` allows any Node 22.
- Still sits on `fetch`, which the engineer chose to avoid.

### Option 2: Wrap axios, with `HttpClient` owning URL joining, auth, and status checks

`HttpClient` creates its own axios instance with `validateStatus: null` and an optional injected `adapter`, joins paths itself, awaits the provider itself, and maps results and failures to SDK types.

**Pros**:
- Mature, widely known, ships proper ESM and CJS builds, so the dual build needs no special handling.
- Uses Node's `http` stack on the server and XHR in browsers, not `fetch`, which meets the engineer's requirement.
- The `adapter` option is a clean constructor seam for tests.
- Because the client does its own status check and URL join, the fake adapter sees exactly what a real adapter would, and behaviour does not depend on axios internals.

**Cons**:
- Heavier than a fetch based wrapper.
- Adds a runtime dependency that consumers install before anything uses it.
- Returns `AxiosResponse` and `AxiosError`, which the client must translate.

### Option 3: Wrap axios, leaning on axios features (baseURL, interceptors, default status validation)

Configure `baseURL`, `allowAbsoluteUrls: false`, a request interceptor for the token, and a response interceptor that converts `AxiosError` to SDK errors.

**Pros**:
- Less hand written code; uses axios the way its docs show.
- Interceptors are a familiar pattern for axios users.

**Cons**:
- With a custom adapter, axios leaves URL building and status validation to the adapter itself, so a fake adapter would not see the final URL and a queued 404 would resolve as success; tests would not exercise production behaviour.
- An error thrown in a request interceptor also flows through the response interceptor chain, which makes the "provider failed, nothing sent" path harder to reason about.
- The absolute URL refusal depends on a flag that only exists in recent axios releases.

### Option 4: Native fetch with an injectable `fetch`

Use `globalThis.fetch` directly, injected through the constructor.

**Pros**:
- Zero dependencies; works in Node 22+ and browsers.

**Cons**:
- The engineer ruled out native `fetch`.
- Needs DOM or Node types added to `tsconfig.json` to type `fetch`, `Response`, and `Headers`.

## Rationale

The recommendation going in was ky (Option 1): it is the smallest fit for a "return the raw `Response`" design. The engineer chose axios instead, because they want to avoid `fetch` as the transport, and then chose to return plain `unknown` data rather than a response object. With those two answers axios is a sound choice: its dual ESM and CJS builds remove ky's ESM only problem for this package, and once the method returns only `data`, the `Response` versus `AxiosResponse` difference no longer matters to callers. The cost the team accepts is size and an early runtime dependency.

Option 2 beats Option 3 because of the testing rule in `AGENTS.md`. Fakes must come in through the constructor, and the only axios seam that does that without hand building instances is the `adapter`. But an adapter is responsible for building the final URL and for settling the status, so leaning on axios's `baseURL` and default validation would make the fake adapter tests check something production does differently. Doing the URL join, the absolute path refusal, the token step, and the status check inside `HttpClient` keeps one code path for tests and production, and makes the token rules explicit, ordered steps instead of interceptor side effects. The runner up for the token step was a request interceptor, which is more idiomatic for axios but less clear about "nothing is sent if the provider fails".

Smaller calls made here: `CopilotApiError` is abstract, so only the specific subclasses are ever thrown (runner up: a concrete base that could be thrown directly). An absolute path rejects with a plain `TypeError`, because it is a caller bug, not a runtime failure of the SDK (runner up: a fourth `CopilotApiError` subclass). An empty token is treated as a provider failure, because `Bearer ` with nothing after it is never a valid credential (runner up: send it and let the API return 401). `signal` uses axios's `GenericAbortSignal` type instead of adding `@types/node` or the DOM lib, because `HttpClient` is internal and widening the project's global types for one field is not worth it (runner up: add `@types/node`). The engineer chose `instanceof` only for error checks; that is safe while the errors stay internal, and the Follow-up flags the need for a stable discriminator before they become public.
