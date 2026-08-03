# Content-reader — explain & run

URI: `lightdash://playbooks/content-reader/explain-run`

## Inspect metadata first

1. Charts: `get_chart` (set `includeQueryDefinition=true` when filters/metrics matter) and/or `explain_content`.
2. Dashboards: `get_dashboard` with `includeTiles=true` (and filters when needed). Tile objects use **`tileUuid`** (not `uuid`), plus `type`, `title`, `chartUuid`, `executable`.
3. Parameters: `list_project_parameters` / `get_project_parameters` only when the content references parameters or the user asks to override values.
4. Distinguish **explicit** description/filters/fieldIds from **inferred** business meaning. Chart descriptions often document population caveats — quote them.

## SQL vs semantic (critical)

| Signal                                                      | Action                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Search `source=sql`                                         | Do **not** call `run_chart`; explain metadata only; cite `CONTENT_NOT_EXECUTABLE` / capability |
| `get_chart` → `chartType=sql` + warnings                    | Same — SQL text is hidden; execution disabled                                                  |
| Opaque API errors (e.g. “Saved query not found”) on SQL ids | Treat as non-executable; do not retry endlessly                                                |
| `readerCapabilities.canExecuteSqlCharts=false`              | Hard stop for SQL execution                                                                    |

## Decide whether to execute

Execute only for values, trends, rankings, summaries, comparisons, or discrepancy checks. Skip for discovery/description.

Defaults: `useCache=true`, modest `limit` (≤100; summarize ≤20 rows in the answer), prefer `waitForResults=true` for single charts.

## Chart images (see the viz)

- Use `export_chart_image` when the user needs to **see** the rendered chart (layout, series, labels), not raw numbers.
- Prefer `run_chart` when they need values/aggregates.
- Export relies on Lightdash headless browser; self-hosted instances without Browserless will fail — report the API error; do not invent a screenshot.
- Budget ≤3 image exports per turn.

## Dashboard tile execution

1. Pick tiles with `executable=true` and a `chartUuid` (skip markdown / non-chart tiles).
2. Call `run_dashboard_tile` with dashboard UUID/slug + **`tileUuid`** from `get_dashboard`.
3. Preserve dashboard context; only pass `filterOverrides` / `parameterOverrides` for **existing** filter ids / known parameter names with **values** (never retarget filters).
4. Cap tiles per summary (`maximumTiles` / budget ≤5). Unexecuted tiles must not support conclusions.

## Async handles

- Record `queryUuid` from run responses.
- Use `get_query_result` to poll or re-page; note `truncated` / `TRUNCATED` when `pageSize` clips rows — do not claim completeness.
- `cancel_query` when a run is no longer needed.

## Report

Answer + evidence: content UUID(s), query UUID(s), applied filters/parameters, cache/time context, truncation, capability limits. Never construct a new metric query.
