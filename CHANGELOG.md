# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-04

### Added
- `CopilotAdminClient`, the entry point for the Copilot API admin routes. Create it with a `baseURL` and give it a bearer token source with `setAuthTokenProvider()` (see spec 0005).
- `client.accounts`, with `list`, `get`, `create`, `update`, and `delete` for accounts. Each method takes an optional `{ signal }` so you can cancel the call with an `AbortController`.
- Input checks before anything is sent: account ids must be UUIDs, `name` must not be blank (it is sent trimmed), and `logoUrl` must be an http or https URL.
- Response checks on every call, so a body that does not match the expected shape rejects instead of reaching your code.
- `ValidationError`, raised by both checks. `direction` tells you whether your input or the API's answer failed, and `issues` lists each problem. After a write, a `"response"` failure means the change may already have been applied, so refetch before you retry.
- A fixed `code` on every SDK error (`HTTP_ERROR`, `NETWORK_ERROR`, `AUTH_TOKEN_ERROR`, `VALIDATION_ERROR`). Match on it when `instanceof` is unreliable, for example when the ESM and CommonJS builds load side by side.
- Public exports for the error classes (`CopilotApiError`, `HttpError`, `NetworkError`, `AuthTokenError`, `ValidationError`) and for the account, option, and error types.
- `zod` as a runtime dependency.
