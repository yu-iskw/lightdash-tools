# Semantic-layer MCP playbook

## Purpose

Discover the Lightdash semantic layer and **compose + compile** metric queries. Do not execute warehouse queries or mutate workspace content.

## Allowed tools (wire names)

Always call tools with the `ldt__` prefix:

- `ldt__list_projects`, `ldt__get_project`
- Explores: `ldt__list_explores` (summaries; optional `search` / `limit`), `ldt__get_explore`, `ldt__list_dimensions` (compact + `fieldId`), `ldt__get_field_lineage`
- Metrics: `ldt__list_metrics`, `ldt__get_metric`
- `ldt__compile_query`

## Hard bans

Do **not** attempt or invent:

- Running metric, SQL, chart, dashboard, or underlying-data queries
- SQL runner / custom SQL
- Project validation job triggers
- Charts, dashboards, spaces, content search, tags, schedulers
- Users, groups, space ACL
- AI agents, threads, evaluations, agentops

Those tools are not on this server. Stop after a successful compile (or after reporting compile errors).

## Map warehouse / BigQuery hints → explore

Users often give warehouse coordinates (e.g. from `bq ls` / `project.dataset.table`):

| Hint                                                               | Use as                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Dataset / schema (e.g. `dwh_pharma`)                               | `schemaName` filter among explore summaries                       |
| Table name (e.g. `medico_session_summary`)                         | Prefer explore whose **`label` equals that table name exactly**   |
| Full BQ id `ubie-jp-phr-dwh-prd.dwh_pharma.medico_session_summary` | `databaseName` ≈ project, `schemaName` ≈ dataset, `label` ≈ table |

Warehouse names are **search hints**, not explore IDs. Explore ids look like `ubie_jp_phr_dwh__dwh_pharma__medico_session_summary`.

## Always search explores

On large projects, always call `ldt__list_explores` with `search` (and `limit`). Do **not** use the default first-N list (alphabetical across unrelated domains — incomplete and misleading).

## Explore disambiguation (do not pick the first hit)

Search for a table name often returns many siblings. Example for `medico_session_summary`:

- `…__dm_pharma__eda_medico_session_summary` (`schemaName=dm_pharma`, label `eda_…`)
- `…__dm_pharma__reporting_medico_session_summary`
- `…__dwh_pharma__medico_session_summary` ← usually the warehouse table match
- `…__dwh_pharma__mre_*medico_session_summary*` (experiment / reporting variants)

**Choose in this order:**

1. Skip explores with non-empty `errors`.
2. Prefer **exact `label` match** to the warehouse table name (e.g. `medico_session_summary`, not `eda_medico_session_summary`).
3. Prefer **`schemaName` / `databaseName`** matching the user’s dataset/project (e.g. `dwh_pharma` over `dm_pharma` when they said `dwh_pharma`).
4. Prefer tags such as `lightdash` when still tied.
5. Deprioritize prefixed variants (`eda_`, `reporting_`, `mre_`, `mre_dp_`, `mre_pd_`) unless the user asked for that layer.
6. State the chosen explore **`name`**, `label`, and `schemaName` in the answer.

Never assume “first search result” or “first default list row” is correct.

## Progressive discovery

1. Prefer `ldt__list_metrics` with a **metric keyword** and `ldt__list_explores` with `search` / `limit`.
2. Do **not** paste full explore catalogs or full `ldt__get_explore` / `ldt__list_dimensions` / lineage JSON into the user-facing answer (payloads can be 100KB–700KB+).
3. Call `ldt__get_explore` only for the single explore you will compile against — and only if you need explore-scoped metric **names** you cannot get from `ldt__list_metrics`.
4. Prefer `ldt__list_dimensions` (compact `{ name, label, table, type, fieldId }`) when selecting fields.

## Metrics catalog vs explore

- `ldt__list_metrics` / `ldt__get_metric` are catalog-wide. Response shape is `{ pagination, data: Metric[] }`.
- Filter catalog rows where `tableName` **equals the chosen explore id** (full id).
- `ldt__get_metric` `tableName` must be that same explore id. Short labels like `medico_session_summary` fail with “Metric not found”.
- **Search with metric keywords from the question** (`nps`, `count`, `rate`, `sum`, …), **not** the warehouse table name and **not** the explore id. Table-name / explore-id searches often return **zero** hits even when metrics exist (e.g. search `nps` → metrics on `…__dwh_pharma__medico_session_summary`; search `medico_session_summary` → empty).
- If keyword search yields no rows with `tableName === exploreId`, try related keywords, then **compile with dimensions only** (valid) or report that no catalog metrics match.
- Before `ldt__compile_query`, confirm fields on the chosen explore. Prefer `fieldId` from `ldt__list_dimensions` for dimensions; for metrics use `{exploreId}_{metricName}`.

## Prefer base-table fields

`ldt__list_dimensions` **defaults to base-table only** (`table` === explore id). Set `baseTableOnly=false` only when you need joined-table fields. Prefer `fieldId` from that list for `ldt__compile_query`.

Even base-table lists can be large (hundreds of fields / tens of KB). Shortlist in the answer; do not dump the array.

## Field IDs for `ldt__compile_query`

Use `{table}_{name}` / `fieldId` from `ldt__list_dimensions` (e.g. `ubie_jp_phr_dwh__dwh_pharma__medico_session_summary_session_start_time`).

Short keys alone are unsafe. Two failure modes:

1. `ldt__compile_query` may **succeed upstream with an empty `SELECT`** — this server returns that as **`isError`** (fix field IDs and re-compile).
2. Or it may hard-error (`Tried to reference … unknown field id`).

Prefer `fieldId` from `ldt__list_dimensions` when present.

## Field lineage

Call `ldt__get_field_lineage` with either `fieldId` (`{table}_{name}`) or the field’s short `name` (both resolve). Summarize lineage; do not paste the full graph.

## Answer shape

User-facing replies: shortlists of name / label / tags / `schemaName` / `fieldId` / compiled SQL only. Never paste full `ldt__get_explore`, full dimension lists, or full lineage JSON.

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

`metrics` may be `[]` when the question is dimension-only (e.g. volume-by-day via a date dimension) or when no catalog metric matches the explore.

## Recommended sequence

1. Scope: `ldt__list_projects` / `ldt__get_project`
2. Discover: `ldt__list_explores` with search → **disambiguate** (exact label + schema) → `ldt__list_dimensions` (base-table `fieldId`s) and/or `ldt__list_metrics` with **metric keywords**, filter `tableName === exploreId`
3. `ldt__compile_query` with `projectUuid`, `exploreId`, and `metricQuery` using `fieldId`s
4. Verify compiled SQL selects the intended columns; stop — return SQL / compile result

## Stop / deliverables

- **Explore prompt:** shortlist of explores / metrics / dimensions only — do not compile unless asked. Include `schemaName` and why the explore was chosen.
- **Compose / debug prompts:** return compiled SQL or compile errors; stop after `ldt__compile_query` (re-compile only while debugging).
