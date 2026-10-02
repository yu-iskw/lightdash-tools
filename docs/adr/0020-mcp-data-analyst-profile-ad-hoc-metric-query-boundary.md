# 20. MCP data-analyst profile ad-hoc metric-query boundary

Date: 2026-08-03

## Status

Accepted

Amends [6. MCP profiles, shared registry, fixed paths](0006-mcp-profiles-shared-registry-fixed-paths.md)

Related to [12. MCP content-reader profile saved-content execution boundary](0012-mcp-content-reader-profile-saved-content-execution-boundary.md)

## Context

Agents need Lightdash **Explore**-style analysis: pick an explore, compose dimensions/metrics/filters/sorts, and see bounded warehouse rows — **without** saving a chart or dashboard.

Existing profiles leave a gap:

- `semantic-layer` discovers explores and `compile_query` (SQL only; never executes).
- `content-reader` ([ADR-0012](0012-mcp-content-reader-profile-saved-content-execution-boundary.md)) runs **saved** semantic charts/tiles only (`queryCapability: saved_content`); it excludes `POST …/query/metric-query`.
- `content-developer` persists as-code content and does not execute warehouse queries.

Lightdash documents Explore execution as the v2 async metric-query API (`POST /api/v2/projects/{projectUuid}/query/metric-query`). The v1 sync `…/explores/{exploreId}/runQuery` path is deprecated. `@lightdash-tools/client` already wraps `runMetricQuery`; MCP and CLI do not expose it.

Putting ad-hoc metric-query on `content-reader` would collapse the saved-content boundary. Expanding `semantic-layer` to execute would change that profile’s “compile never run” contract for every host already connected to `/semantic-layer/v1/mcp`.

## Decision

1. Ship a separate **`data-analyst`** profile at fixed path `/data-analyst/v1/mcp` with MCP server display name **`lightdash-mcp-analyst`**. Tool membership from catalog `profiles` via `listMcpToolNamesByProfile` ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md)). Stdio: `lightdash-mcp stdio --profile data-analyst`.
2. **v1 surface:** `get_project`, `list_explores`, `get_explore`, `list_dimensions`, `list_metrics`, `compile_query` (optional pre-flight), **`run_metric_query`** (`POST …/query/metric-query`), `get_query_result`, `cancel_query`.
3. Safety dimensions for `run_metric_query`:
   - `mutability`: `transient` (async `queryUuid` only; no content mutations)
   - `queryCapability`: `arbitrary_semantic` (explore metric queries only)
   - `resultCapability`: `bounded_aggregate_rows` (reuse content-reader row/concurrency/rate caps)
4. Project scope matches content-reader for **all** profile tools (discovery + run + lifecycle): `X-Lightdash-Project` → tool `projectUuid` → `PROJECT_SCOPE_REQUIRED`. Optional ceiling: `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`. Shared explore/metrics/`compile_query` tools accept optional `projectUuid` so HTTP pin works for semantic-layer and data-analyst alike.
5. **Excluded from MCP v1:** raw SQL, metric-query `tableCalculations` (always sent as `[]`; not accepted on the tool input), field-values search, underlying-data, CSV/download / schedule-download, saved-chart/dashboard execution or mutation, CLI `query run`.
6. Catalog profile: `data-analyst`. Do not add `metric-query` to the `content-reader` or `semantic-layer` profiles.
7. Inventory: [data-analyst inventory](../profiles/data-analyst/inventory.md). Code: `packages/mcp/src/profiles/data-analyst/`.

## Consequences

- Hosts that need Explore-without-save attach `/data-analyst/v1/mcp` (or stdio `data-analyst`) without widening content-reader or semantic-layer.
- Ad-hoc warehouse cost is gated by existing query budgets; playbooks must keep explore shortlists and small limits.
- Persisting a successful exploration remains a separate hand-off to `content-developer`.
- Future field-values autocomplete or underlying-data drills require an ADR amendment; they stay off MCP in v1.
