# Content-reader — explain & run

URI: `lightdash://playbooks/content-reader/explain-run`

## Inspect metadata first

1. Charts: `get_chart` (set `includeQueryDefinition=true` when filters/metrics matter) and/or `explain_content`.
2. Dashboards: `get_dashboard` with `includeTiles=true` (and filters when needed). Tile objects use **`tileUuid`** (not `uuid`), plus `type`, `title`, `chartUuid`, `executable`.
3. Parameters: `list_project_parameters` / `get_project_parameters` only when the content references parameters or the user asks to override values.
4. Distinguish **explicit** description/filters/fieldIds from **inferred** business meaning. Chart descriptions often document population caveats — quote them.

## SQL vs semantic (critical)

| Signal                                                          | Action                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Search `source=sql` (name/slug; **UUIDs usually miss**)         | Opaque path: `run_chart` / SQL dashboard tiles for **results**; never expect SQL text from `get_chart` |
| Dashboard tile `type=sql_chart`                                 | Prefer `run_dashboard_tile` (uses tile type + `chartSlug` / `savedSqlUuid`; does not depend on search) |
| `get_chart` → `chartType=sql` + `SQL_BODY_REDACTED`             | Metadata only; execute via `run_chart` for bounded rows (ADR-0027)                                     |
| Semantic GET 404 (`Saved query not found`) on a chart UUID/slug | Treat as opaque saved SQL and continue (`run_chart` / `get_chart`); do not stop                        |
| `readerCapabilities.canExecuteSqlCharts=false`                  | Unexpected on current content-reader — cite capability and stop                                        |
| SQL Runner / raw `query/sql`                                    | Hard ban — never available on this profile                                                             |

## Decide whether to execute

Execute only for values, trends, rankings, summaries, comparisons, or discrepancy checks. Skip for discovery/description.

Defaults: `useCache=true`, modest `limit` (≤100; summarize ≤20 rows in the answer), prefer `waitForResults=true` for single charts.

## Chart images

- `export_chart_image` is **not mounted**. Use `run_chart` / `run_dashboard_tile` for values and summarize series in text.
- Do not invent screenshots or claim a PNG was rendered.

## Dashboard tile execution

1. Pick tiles with `executable=true` (semantic `saved_chart` or opaque `sql_chart`) and skip markdown / non-chart tiles.
2. Call `run_dashboard_tile` with dashboard UUID/slug + **`tileUuid`** from `get_dashboard`.
3. Preserve dashboard context; only pass `filterOverrides` / `parameterOverrides` for **existing** filter ids / known parameter names with **values** (never retarget filters). Non-empty override `values` **enable** a previously disabled filter (`disabled: false`). Cite `appliedDashboardFilters` after the run.
4. Optional **date zoom**: pass `dateZoom: { granularity?, xAxisFieldId? }` when the user asks to simulate a zoom ([date zoom](https://docs.lightdash.com/guides/date-zoom)). Otherwise execution uses the dashboard’s saved default granularity. Cite `appliedDateZoom` in the report when present. (Date zoom applies to semantic tiles; SQL tiles may ignore it.)
5. Cap tiles per summary (`maximumTiles` / budget ≤5). Unexecuted tiles must not support conclusions.

## Async handles

- Record `queryUuid` from run responses.
- Use `get_query_result` to poll or re-page; note `truncated` / `TRUNCATED` when `pageSize` clips rows — do not claim completeness.
- `cancel_query` when a run is no longer needed.

## Report

Answer + evidence: content UUID(s), query UUID(s), applied filters/parameters, cache/time context, truncation, capability limits. Never construct a new metric query.
