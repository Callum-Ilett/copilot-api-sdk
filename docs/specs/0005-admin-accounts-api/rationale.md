# 0005. Admin accounts API with a public client and Zod schemas · rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md`; this file explains why.

## Context

> ⚠️ Premise note: this is the first feature consumers can call, so it settles three things every later admin resource will inherit: how consumers create and configure the SDK, how request and response shapes are defined and checked, and how errors are exposed. Strictly these are three decisions. They are recorded together because they only make sense together for the first resource and the engineer chose each one explicitly; a later resource that wants to change any of them should supersede the matching part here rather than drift.

Release 2 gave the SDK an internal `HttpClient` (spec 0004) that resolves every response to `unknown`. Nothing is exported to consumers yet beyond `sum`. The Copilot API's `AccountsController` (`api/admin/accounts`) supports list, get by id, create, partial update (`PATCH`), and delete over a four column table: `id` (GUID, set by the API), `name` and `logo_url` (both nullable strings), and `created_at` (set by the API, serialised as an ISO 8601 UTC string with milliseconds). ASP.NET serialises the DTOs in camelCase.

The API has quirks the SDK must live with. The request DTOs declare `name` and `logoUrl` as non nullable `string` in a project with `<Nullable>enable</Nullable>`, so ASP.NET treats both as required and answers 400 when either is missing, null, or blank, even though the table allows nulls and the controller's `PATCH` code is written for partial updates. That `PATCH` code answers `{ success: true }` instead of an account when no fields are given; delete answers only `{ id }`; a missing account is a 404 with a plain text body; there is no paging; and the controller checks no admin role (auth is a JWT middleware concern).

The forces from the project: `AGENTS.md` requires constructor injection with a thin composition root, classes under about 200 lines, folder by feature, named exports, TSDoc on every public export, and no module level state. The dual ESM and CJS build means `instanceof` is unreliable when both copies load. `tsconfig.json` has `isolatedDeclarations` and `exactOptionalPropertyTypes`, and `lib` has no DOM or Node types. The workflow tier is GA, so the public surface must be deliberate: whatever ships here is what consumers code against.

Without a decision, each resource would invent its own entry shape and its own idea of "typed", and `unknown` would be cast to a hopeful type with nothing checking it.

## Options considered

### Option 1: Standalone resource classes with TypeScript types only

Export `AccountsApi` directly (`new AccountsApi(baseURL)`), each with its own token setter, and describe shapes with plain TypeScript types, casting the `unknown` body.

**Pros**:
- The smallest possible change: no new dependency, no composition root.
- Each resource is independent and tree shakable.

**Cons**:
- Every resource repeats base URL and token setup, and consumers juggle one instance per resource.
- The types are a promise nothing checks: a renamed field surfaces as `undefined` far from the cause.

### Option 2: A root `CopilotAdminClient` composing resource classes, with Zod schemas as the single source of runtime checks and types (chosen)

One client owns the `HttpClient` and the token provider; `client.admin.accounts` is an `AccountsApi` built with that client. Each resource defines Zod schemas for inputs and outputs, parses both, and exports `z.infer` types.

**Pros**:
- One place to configure auth; every future resource slots in under `admin`.
- Shape and type are one definition, checked at runtime at the SDK boundary.
- Zod is the most widely used TypeScript schema library, with a stable v4.

**Cons**:
- A new runtime dependency, and Zod types show up in the built declarations.
- `isolatedDeclarations` makes exported schema constants verbose to annotate.
- Strict response parsing can turn a harmless API change into an error if the schemas are too strict (mitigated by stripping unknown keys).

### Option 3: Root client with TypeScript types plus hand written guards

Same client shape as Option 2, but plain types plus small `isAccount(value)` functions instead of a schema library.

**Pros**:
- No dependency; the declarations stay plain TypeScript.
- Full control over every check.

**Cons**:
- Each guard is written and kept in sync with its type by hand, for about thirty admin resources.
- No structured issue list for errors without building one, which is most of what a schema library is.

## Rationale

The engineer chose a root client named `CopilotAdminClient`, Zod for both requests and responses with `z.infer` types, and a setter for the token provider. Those choices fit the forces well. The SDK sits between a backend the team does not fully control and admin UIs, so a check at the boundary is worth a dependency: the alternative is debugging `undefined` in a component. Defining each shape once and inferring the type removes the most common SDK bug, a type that says one thing while the API sends another. A composition root matches the `AGENTS.md` rule of constructor injection: `CopilotAdminClient` is the only place that builds things, and `AccountsApi` and `AdminApi` take the `HttpClient` in their constructors, so tests inject the fake adapter exactly as spec 0004 does.

Responses are parsed leniently where safety allows and strictly where it matters. Unknown keys are stripped so the API can add a column without breaking consumers. `logoUrl` is any nullable string on the way out (existing rows may hold values that are not strict URLs, and one bad row must not break `list`) but must be an http or https URL on the way in, where the SDK controls what gets stored; a `javascript:` or `data:` logo URL would otherwise flow straight into consumers' markup. A cross check pointed out that ASP.NET makes both request fields required; the engineer chose to match the API as it is today (both fields required on create and update) rather than change the API in this feature. The engineer chose `z.uuid()` over the more lenient `z.guid()`; SQL Server's `newid()` produces valid version 4 UUIDs, so this holds for every row the API creates, at the cost noted in Consequences for hand inserted ids. Parsing the `id` argument before building the path is also the cheapest defence against path tricks.

`createdAt` uses `z.iso.datetime()`, not `z.iso.date()`: the API sends a full timestamp, and the date only check would reject every response. It stays a string so results remain plain JSON. For the empty update, the engineer chose to model the API's `{ success: true }` as a schema and return a union rather than hide it. With both fields required that branch cannot happen today, but it stays as a fallback so the SDK is already right if the API's DTOs are relaxed later. The cross check also suggested `z.guid()` for response ids so one odd row cannot break `list`; the engineer kept `z.uuid()` both ways, accepting that risk. Errors become public with a fixed `code` per class: `instanceof` keeps working for the normal single copy case, and `code` gives consumers a check that survives the dual package case. `ValidationError` exposes an SDK owned issue shape rather than Zod's, so consumers who catch errors are not tied to Zod's types.

During review the engineer also chose to drop the `./types` entry that spec 0001 set up and export every value and type from the root. With the SDK's surface about to grow by a dozen types per resource, one import path is simpler for consumers and halves the `exports` map the build checks. The cost is a breaking change to the package shape, which is acceptable while the package is private, pre 1.0, and used only by the local sandbox. Specs 0001, 0002, and 0003 carry an amendment note pointing here.
