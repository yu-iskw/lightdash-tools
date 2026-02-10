# Design: Lightdash HTTP client

## Context

- This repo will call the Lightdash API from CLI, MCP, and other tooling. Organization API discovery is complete: base path `/api/v1`, PAT auth, and core org endpoints are documented (see `.claude/skills/lightdash-api-discovery/references/sources.md` and `api-areas.md`).
- `packages/client` currently exposes a stub (`greet`); it will become the single HTTP client for Lightdash. Other packages (cli, mcp) will depend on `@lightdash-tools/client`.
- Constraints: no session-based auth for the API (PAT only); Node 18+ or modern runtimes so native `fetch` is available; types must align with the Lightdash OpenAPI spec for the covered areas.

## Goals / Non-Goals

**Goals:**

- Single place for Lightdash API configuration, authentication, and transport.
- Typed, namespaced API surface (e.g. `client.organizations.get()`, `client.organizations.listMembers()`) starting with Organizations.
- Clear error handling: expose Lightdash `ApiErrorPayload` when present; otherwise a generic error.
- Design and specs sufficient to implement the client in a follow-up change without guessing at contracts.

**Non-Goals (this change):**

- No implementation, tests, or code in `packages/client`.
- No support for Projects, Query, Spaces, or other API areas yet (future phases).
- No retries, rate limiting, or response caching.
- No OpenAPI codegen in the first version; types will be defined manually from the spec/research.

## Decisions

### Authentication

- **Choice:** Use only Personal Access Token (PAT). Header: `Authorization: ApiKey ldpat_{token}`. No session cookies.
- **Rationale:** Lightdash public API is PAT-only for server-to-server and automation; PAT is documented and sufficient.
- **Alternative considered:** OAuth / session flow — rejected for this client, which targets automation and tooling.

### Configuration

- **Choice:** Client accepts `baseUrl: string` and `apiKey: string`. Optional: async getter for `apiKey` if we need lazy or rotating tokens later.
- **Rationale:** Minimal surface; base URL allows targeting any Lightdash instance (cloud or self-hosted). Sync config is enough for the first version.

### Transport

- **Choice:** Use native `fetch` with a single internal helper (e.g. `request<T>(method, path, body?)`) that builds `{baseUrl}/api/v1{path}`, sets auth and JSON headers, parses JSON, and handles non-2xx.
- **Rationale:** No extra dependency; Node 18+ and browsers provide `fetch`. Centralizing the request path keeps auth and error handling consistent.
- **Alternative considered:** Dedicated HTTP client (e.g. axios) — rejected to avoid adding a dependency when `fetch` suffices.

### Error handling

- **Choice:** On non-2xx, parse response body as JSON. If it matches Lightdash `ApiErrorPayload` (`status: "error"`, `error: { message?, name, statusCode, data? }`), expose it via a dedicated error type (e.g. `LightdashApiError` with `message`, `statusCode`, `name`). Otherwise, surface a generic error with status and optional body.
- **Rationale:** Callers can handle known API errors (e.g. 404, 403) and still get a fallback for network or malformed responses.

### Types

- **Choice:** Define types in the client package (or a shared types package) aligned to the Lightdash OpenAPI/research: `Organization`, `OrganizationMemberProfile`, `OrganizationProject`, `Group`, `ApiErrorPayload`, and paginated wrappers where applicable.
- **Rationale:** Typed responses and errors improve DX and catch mismatches at compile time. Manual types from the current spec are sufficient for the Organizations surface; codegen can be considered later if the surface grows.

### Testing strategy (for implementation phase)

- **Choice:** Prefer pure functions for mapping and parsing (e.g. error body → `LightdashApiError`); unit-test those without HTTP. For code that calls `fetch`, use a test server (e.g. MSW) or integration tests against a stub; avoid mocks for I/O per project guidelines.
- **Rationale:** Keeps tests fast and reliable; integration or contract tests validate real request/response shapes when needed.

## Risks / Trade-offs

- **Risk:** Lightdash API adds or changes endpoints or response shapes.  
  **Mitigation:** Types and specs are versioned with the client; when we add new areas (Projects, Query), we re-check the OpenAPI spec and update types. No long-term contract beyond what we document.

- **Risk:** PAT in config could be logged or leaked.  
  **Mitigation:** Config is supplied by the caller (env, secret store); the client does not persist or log the token. Callers MUST NOT log `apiKey`.

- **Trade-off:** No retries or backoff.  
  **Mitigation:** Out of scope for v1; callers can wrap calls in their own retry logic if needed.

## Migration Plan

- This change is docs-only; no deployment or migration.
- When implementing: replace or remove the current `greet` export in `packages/client`, add the new client factory and methods, and add tests. No breaking change to other packages until they start depending on the new API.

## Open Questions

- None for the design phase. Task breakdown (e.g. order of methods, file layout) will be decided when writing `tasks.md` in the implementation change.
