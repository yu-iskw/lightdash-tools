# Semantic-layer MCP playbook

## Purpose

Discover the Lightdash semantic layer and **compose + compile** metric queries. Do not execute warehouse queries or mutate workspace content.

## Allowed tools

- `list_projects`, `get_project`
- Explores: `list_explores` (summaries; optional `search` / `limit`), `get_explore`, `list_dimensions` (includes `fieldId`), `get_field_lineage`
- Metrics: `list_metrics`, `get_metric`
- `compile_query`

## Hard bans

Do **not** attempt or invent:

- Running metric, SQL, chart, dashboard, or underlying-data queries
- SQL runner / custom SQL
- Project validation job triggers
- Charts, dashboards, spaces, content search, tags, schedulers
- Users, groups, space ACL
- AI agents, threads, evaluations, agentops

Those tools are not on this server. Stop after a successful compile (or after reporting compile errors).

## Progressive discovery

1. Prefer `list_metrics` with `search` and `list_explores` with `search` / `limit`.
2. Do **not** paste full explore catalogs or full `get_explore` / `list_dimensions` / lineage JSON into the user-facing answer (payloads can be hundreds of KB).
3. Call `get_explore` only for the single explore you will compile against — and only if you need explore-scoped metric _names_ you cannot get from `list_metrics`.
4. Prefer `list_dimensions` (with `fieldId`) over dumping the whole explore when selecting fields.

## Always search

On large projects, always call `list_explores` with `search` (and `limit`). Do not rely on the default first-N list (alphabetical, incomplete for discovery).

## Name bridging

Warehouse / BigQuery table names (e.g. `medico_session_summary`) are **search hints**, not explore IDs. Match explore `name` / `label` (e.g. `ubie_jp_phr_dwh__dwh_pharma__medico_session_summary`).

## Explore disambiguation

When many explores match (e.g. `eda_`, `reporting_`, `mre_`, raw `dwh_pharma__…`):

1. Prefer exact `label` match to the warehouse table name.
2. Then prefer dataset path segments in `name` (`dwh_pharma` / `dm_pharma`).
3. Then prefer tags (e.g. `lightdash`).
4. State the chosen explore id briefly in the answer.

## Metrics catalog vs explore

- `list_metrics` / `get_metric` are catalog-wide. Response shape is `{ pagination, data: Metric[] }`.
- Filter catalog rows where `tableName` **equals the chosen explore id** (full id, not the warehouse label).
- `get_metric` `tableName` must be that same explore id (e.g. `…__dwh_pharma__medico_session_summary`). Short labels like `medico_session_summary` fail with “Metric not found”.
- Search with metric keywords (`nps`, `session_complete_rate`), not only the warehouse table name (table-name searches often return zero).
- Before `compile_query`, confirm dimensions/metrics on the chosen explore. Prefer `fieldId` from `list_dimensions` for dimensions; for metrics use `{exploreId}_{metricName}`.

## Prefer base-table fields

`list_dimensions` includes joined tables and can be very large. Prefer dimensions whose `table` equals the explore id (base table). Ignore joined-table fields unless the question needs them.

## Field IDs for `compile_query`

Use `{table}_{name}` / `fieldId` from `list_dimensions` (e.g. `…__medico_session_summary_session_start_time_jst`).

Short keys alone are unsafe: `compile_query` may **succeed with an empty `SELECT`** (no error). Treat empty or missing expected columns in compiled SQL as failure — fix field IDs and re-compile.

## Field lineage

Call `get_field_lineage` with `fieldId` first. If the result is null or empty, retry with the field’s short `name`. Summarize lineage; do not paste the full graph.

## Answer shape

User-facing replies: shortlists of name / label / tags / `fieldId` / compiled SQL only. Never paste full `get_explore`, full dimension lists, or full lineage JSON.

## metricQuery skeleton

```json
{
  "exploreName": "<exploreId>",
  "dimensions": ["<table>_<name>"],
  "metrics": ["<table>_<name>"],
  "filters": {},
  "sorts": [{ "fieldId": "<table>_<name>", "descending": false }],
  "limit": 50,
  "tableCalculations": []
}
```

## Recommended sequence

1. Scope: `list_projects` / `get_project`
2. Discover: `list_explores` with search → disambiguate → `list_dimensions` (base-table `fieldId`s) and/or `list_metrics` filtered by `tableName === exploreId`
3. `compile_query` with `projectUuid`, `exploreId`, and `metricQuery`
4. Verify compiled SQL selects the intended columns; stop — return SQL / compile result

## Stop / deliverables

- **Explore prompt:** shortlist of explores / metrics / dimensions only — do not compile unless asked.
- **Compose / debug prompts:** return compiled SQL or compile errors; stop after `compile_query` (re-compile only while debugging).
