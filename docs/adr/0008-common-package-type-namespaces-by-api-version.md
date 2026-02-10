# 8. Common package type namespaces by API version

Date: 2026-02-10

## Status

Accepted

## Context

Types in `@lightdash-ai/common` are organized by domain (Projects, Queries, Charts, etc.) and re-exported from a single `LightdashApi` namespace and as flat exports. The OpenAPI spec includes both v1 and v2 paths (e.g. `/api/v1/projects/*`, `/api/v2/projects/{projectUuid}/query/*`), but the generated types are a single `components.schemas` with no version split. The client already exposes runtime version separation (`client.v1.*`, `client.v2.*` per ADR-0003) and uses version-specific endpoints, yet type imports do not indicate which API version a type belongs to. This makes it easy to use a v2 request type on a v1 endpoint or vice versa, and complicates discovery and refactoring.

We need type-level distinction so that consumers can import v1-only or v2-only types explicitly and the type system reflects the API version boundary.

## Decision

We will expose **versioned namespaces** `LightdashApi.V1` and `LightdashApi.V2` as top-level namespaces. Each re-exports only the domain types that belong to that API version (curated mapping). We keep the single OpenAPI-generated `components` and existing domain files; no codegen or spec split.

### Implementation details

- Add `LightdashApi.V1` and `LightdashApi.V2` in `packages/common/src/types/lightdash-api.ts` (or via `types/v1/index.ts` and `types/v2/index.ts` re-exporting from domain files).
- **V1 namespace**: Re-export types used only or primarily by v1 endpoints (e.g. `MetricQueryRequest`, `RunQueryResults`, Projects, Organizations, Charts, Dashboards, Spaces, SpaceAccess, Users, Groups, AiAgents, ProjectAccess as used by v1 paths).
- **V2 namespace**: Re-export types used only or primarily by v2 endpoints (e.g. `ExecuteAsyncMetricQueryRequestParams`, `ExecuteAsyncMetricQueryResults`, and other v2 query/response types). Shared types (e.g. `Project`, `Space`) appear in both V1 and V2 when they are used by both versions.
- **Backward compatibility**: Retain existing `LightdashApi.Projects`, `LightdashApi.Queries`, etc., and all flat exports so client and other consumers can migrate incrementally.

### Type mapping (summary)

- **V1-only**: `MetricQueryRequest`, `RunQueryResults` (v1 runQuery response).
- **V2-only**: `ExecuteAsyncMetricQueryRequestParams`, `ExecuteAsyncMetricQueryResults`, `ExecuteAsyncSqlQueryRequestParams`, `ExecuteAsyncSqlQueryResults`, `ExecuteAsyncSavedChartRequestParams`, `ExecuteAsyncDashboardChartRequestParams`, `ExecuteAsyncDashboardChartResults`, `ExecuteAsyncUnderlyingDataRequestParams`.
- **Shared** (exposed in both V1 and V2): Project, Organization, Space, and other domain entities used by both API versions.

### File layout (follow-up)

- `types/v1/index.ts` and `types/v2/index.ts` are added as barrel modules that re-export the same type surface as `LightdashApi.V1` and `LightdashApi.V2`.
- Domain files remain at the top level of `types/`; they are not moved into v1 or v2.
- `LightdashApi.V1` and `LightdashApi.V2` remain defined inline in `lightdash-api.ts` to avoid TypeScript `export import` / circular-definition issues; the barrels are for layout clarity and optional subpath imports only.

## Consequences

### Positive

- **Clarity**: Imports like `LightdashApi.V2.Queries.Requests.ExecuteAsyncMetricQuery` make the API version explicit.
- **Type safety**: Reduces risk of passing a v2 request type to a v1 endpoint or vice versa.
- **Alignment**: Type namespaces mirror runtime namespaces (`client.v1`, `client.v2`) from ADR-0003.
- **No codegen change**: Works with the existing single OpenAPI output; no pipeline changes.

### Negative

- **Curated mapping**: We must maintain the list of which types are v1-only, v2-only, or shared (document in ADR or code comments).
- **Optional duplication**: Shared types are re-exported from both V1 and V2; no structural duplication of definitions.

## References

- GitHub Issue: #15
- GitHub Issue (file layout barrels): #17
- ADR-0003 (API Version Namespaces): runtime client.v1 / client.v2
- ADR-0004 (Shared API Models in Common Package): domain namespaces and lightdash-api.ts
- OpenSpec: `docs/openspec/changes/common-types-version-namespaces/`
