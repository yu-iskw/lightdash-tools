# 27. MCP content-reader opaque saved SQL chart execution

Date: 2026-08-17

## Status

Accepted

Supercedes [12. MCP content-reader profile saved-content execution boundary](0012-mcp-content-reader-profile-saved-content-execution-boundary.md) decision §4 (SQL charts disabled by default). Project scope, budgets, semantic execution, and SQL Runner exclusion from ADR-0012 remain in force.

Related to [20. MCP data-analyst profile ad-hoc metric-query boundary](0020-mcp-data-analyst-profile-ad-hoc-metric-query-boundary.md)

## Context

`content-reader` targets **Project Interactive Viewer** parity: agents should discover and run **saved** dashboards and charts the user can already see in the UI, without gaining SQL Runner or Explore ad-hoc composition.

ADR-0012 disabled saved SQL chart execution by default. That blocked Interactive Viewers from reading dashboard SQL tiles (common for cost/latency boards) even though those users cannot open SQL Runner (`Manage Sql Runner` is Developer/Admin — see [SQL Runner](https://docs.lightdash.com/guides/developer/sql-runner) and [roles](https://docs.lightdash.com/references/workspace/roles)).

Lightdash already separates:

- Saved SQL chart results: `POST …/query/sql-chart`, `POST …/query/dashboard-sql-chart`
- SQL Runner ad-hoc: `POST …/query/sql` (raw `sql` string)
- Explore ad-hoc: `POST …/query/metric-query`

## Decision

1. **Allow opaque saved SQL chart execution** on content-reader via `run_chart` → `query/sql-chart` and `run_dashboard_tile` (type `sql_chart`) → `query/dashboard-sql-chart`, with the same budgets/row caps as semantic saved execution (`queryCapability: saved_content`, `resultCapability: bounded_aggregate_rows`).
2. **Never expose SQL body** in MCP responses. `get_chart` / `explain_content` for SQL charts return opaque metadata only (`chartType: sql`, name/slug/uuid, warnings). Do not call APIs that return `SqlChart.sql` into tool payloads. Semantic GET 404 → opaque SQL is **content-reader only**; the shared `get_chart` mount on content-developer maps that 404 to `CONTENT_NOT_FOUND` and must not advertise `run_chart`.
3. **Keep excluded:** `query/sql` (SQL Runner), `query/metric-query` (Explore — `data-analyst`), underlying-data, CSV/download, and all content mutations.
4. Advertise `readerCapabilities.canExecuteSqlCharts: true`.
5. Values-only dashboard `filterOverrides` **enable** a filter when override `values` are non-empty (set `disabled: false`), matching Interactive Viewer filter interaction on optional dashboard filters.
6. Chart PNG export (`export_chart_image`) is **not mounted** on content-reader (ADR-0012 §7 withdrawn). Client binary downloads allow one SSRF-safe redirect hop; agents rely on `run_chart` / `run_dashboard_tile` for data.

Endpoint map: [content-reader inventory](../profiles/content-reader/inventory.md).

## Consequences

- App-style dashboards with SQL cost/quality tiles become readable as bounded row results without semantic rewrites.
- Agents must not infer SQL text from opaque metadata; playbooks/invariants ban SQL Runner and body disclosure.
- Warehouse load for saved SQL charts matches UI dashboard view; still subject to MCP query budgets.
- ADR-0012 §4 “SQL charts disabled” is obsolete; operators should treat §1–3, §5–9 of ADR-0012 as still authoritative except where this ADR amends execution class.
