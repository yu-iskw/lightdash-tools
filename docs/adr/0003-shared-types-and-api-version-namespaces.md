# 3. Shared types and API version namespaces

Date: 2026-07-31

## Status

Accepted

## Context

Lightdash exposes both `/api/v1` and `/api/v2`. Generated OpenAPI types must be reusable without forcing every package to depend on the HTTP client, and version boundaries must stay clear as the API evolves.

## Decision

1. **OpenAPI-generated types and curated domain models live in `@lightdash-tools/common`** (`packages/common/src/types/`), organized by API version directories (`v1/`, `v2/`) and domain files. Packages that need types depend on `common`, not on deep client paths.
2. **`LightdashClient` exposes version namespaces** `client.v1.*` and `client.v2.*`, each backed by its own HTTP base path. Prefer the namespace that matches the upstream route; mark superseded client methods `@deprecated` for CLI/MCP lint ([ADR-0009](0009-cross-cutting-conventions.md)).
3. **V2 client surface is selective** — use v2 where Lightdash provides the preferred API (for example query and role management); do not invent a parallel v2 for every v1 domain.
4. **Dependency rule** — `common` never depends on `client` (enforced by validation scripts).

## Consequences

- Types stay discoverable and versioned; CLI/MCP share the same models as the client.
- Adding a new OpenAPI type for consumers requires threading exports through the common type layers (see `AGENTS.md`).
- Layout details under `types/v1` vs domain barrels are How; the Why is versioned shared models plus versioned client namespaces.
