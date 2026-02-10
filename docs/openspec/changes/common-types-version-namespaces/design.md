# Design: Common package type namespaces by API version

## Context

- Types in `packages/common/src/types/` are organized by domain (projects.ts, queries.ts, etc.) and assembled in `lightdash-api.ts` into the `LightdashApi` namespace plus flat exports. All types alias `components['schemas']['...']` from a single generated OpenAPI file; there is no version split in the spec or codegen.
- The client package already has runtime version separation (`client.v1.*`, `client.v2.*`) and version-specific endpoints; type imports do not currently indicate API version.
- Empty directories `types/v1/` and `types/v2/` exist and can be used for version-scoped re-exports.

## Goals / Non-Goals

**Goals:**

- Expose `LightdashApi.V1` and `LightdashApi.V2` so consumers can import version-specific types explicitly.
- Preserve all existing `LightdashApi.*` and flat exports (no breaking changes).
- Keep a single OpenAPI codegen output; no spec or pipeline changes.

**Non-Goals:**

- Splitting the OpenAPI spec or generating separate v1/v2 type files.
- Changing or removing any existing export.
- Migrating client (or other consumers) to use only V1/V2 imports; that is optional and incremental.

## Decisions

### Decision 1: Implement V1/V2 via re-exports in lightdash-api.ts

**Choice:** Add `LightdashApi.V1` and `LightdashApi.V2` as namespace blocks in `lightdash-api.ts`, each re-exporting from the existing domain type modules (Projects, Queries, etc.). Optionally, factor the re-exports into `types/v1/index.ts` and `types/v2/index.ts` and have `lightdash-api.ts` re-export from those for clearer file layout.

**Rationale:** Single source of truth remains the domain files; no duplication of type definitions. Version mapping is explicit in one place (or two small index files). Aligns with ADR-0008.

**Alternatives considered:**

- Separate OpenAPI codegen per version: rejected (pipeline and spec complexity).
- Version suffix on type names only: rejected (we want namespace-level distinction per problem-solving recommendation).

**Implementation:** In `lightdash-api.ts`, after the existing `LightdashApi` namespace and flat exports, add:

- `export namespace V1 { ... }` and `export namespace V2 { ... }` under `LightdashApi`, or
- Populate `v1/index.ts` and `v2/index.ts` with re-exports from domain modules, then in `lightdash-api.ts`: `export namespace LightdashApi { ... export import V1 = ...; export import V2 = ...; }` (or equivalent TypeScript pattern so that `LightdashApi.V1` and `LightdashApi.V2` are available).

### Decision 2: Type mapping (v1-only, v2-only, shared)

**Choice:** Curated mapping documented in ADR-0008 and optionally in code comments.

- **V1-only:** Types used exclusively by v1 paths (e.g. `MetricQueryRequest`, `RunQueryResults` from v1 runQuery).
- **V2-only:** Types used exclusively by v2 paths (e.g. `ExecuteAsyncMetricQueryRequestParams`, `ExecuteAsyncMetricQueryResults`, and other v2 query request/response types).
- **Shared:** Domain entities used by both versions (e.g. `Project`, `Space`, `Organization`) are re-exported in both `LightdashApi.V1` and `LightdashApi.V2` so each version namespace is self-contained for typical use.

**Rationale:** Keeps V1 and V2 namespaces usable without forcing consumers to mix versioned and unversioned imports for shared types.

### Decision 3: Use v1/index.ts and v2/index.ts for re-exports

**Choice:** Implement the version split in `packages/common/src/types/v1/index.ts` and `packages/common/src/types/v2/index.ts`. Each file re-exports the appropriate domain namespaces or types. `lightdash-api.ts` then assigns `LightdashApi.V1` and `LightdashApi.V2` from these modules (e.g. `import * as V1Types from './v1';` and expose as `LightdashApi.V1`).

**Rationale:** File layout mirrors version; easy to see which types are in which version; keeps `lightdash-api.ts` from growing too large. Aligns with plan’s “optionally implement the split using existing empty types/v1 and types/v2 folders.”

## Risks / Trade-offs

- **Curated mapping drift:** As new endpoints or types are added, the V1/V2 re-export lists must be updated. Mitigation: Document the mapping in ADR-0008 and add a short comment at the top of `v1/index.ts` and `v2/index.ts` pointing to the ADR.
- **Shared types in both namespaces:** Slight duplication of re-export surface; no structural duplication of definitions since both re-export from the same domain modules.

## Migration Plan

- No consumer migration required. Existing imports continue to work.
- Optional: Update client (or other packages) to use `LightdashApi.V1.*` and `LightdashApi.V2.*` in a follow-up change.
