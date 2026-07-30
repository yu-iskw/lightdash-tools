# Semantic-layer MCP playbook

## Purpose

Discover the Lightdash semantic layer and **compose + compile** metric queries. Stop after a good compile (or clear compile errors). Do **not** run warehouse queries or mutate content.

## Allowed tools (always `ldt__` prefix)

| Tool                                      | Use for                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ldt__list_projects` / `ldt__get_project` | Confirm project UUID ↔ name                                                                                      |
| `ldt__list_explores`                      | Summaries (`name`, `label`, `tags`, `databaseName`, `schemaName`, `errors?`); **always** pass `search` + `limit` |
| `ldt__list_dimensions`                    | Compact `{ name, label, table, type, fieldId }`; **default = `table === explore.baseTable`**                     |
| `ldt__list_metrics` / `ldt__get_metric`   | Catalog search; filter `tableName === exploreId`                                                                 |
| `ldt__compile_query`                      | Compile only — never “run”                                                                                       |
| `ldt__get_explore`                        | **Rare** — full explore JSON is huge (~100KB–700KB+)                                                             |
| `ldt__get_field_lineage`                  | Optional; summarize, don’t dump                                                                                  |

## Hard bans

Do **not** attempt or invent: run-query / SQL runner / validation jobs / charts / dashboards / spaces / users / groups / ACL / AI agents / agentops. Those tools are not on this server.

## From BigQuery / `bq ls` inventory → explore

When the user pastes warehouse inventory (TABLE + dataset + partition field):

| Inventory column                                                             | MCP use                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Dataset (e.g. `dwh_pharma`)                                                  | Prefer explores with matching **`schemaName`**                                       |
| TABLE (e.g. `medico_session_summary`)                                        | `ldt__list_explores` **`search`** = that table token; prefer **exact `label` match** |
| Partition / time field (e.g. `session_start_time`, `session_start_time_jst`) | Candidate **dimension** `fieldId` for “by day / by time” compiles                    |
| Full id `project.dataset.table`                                              | `databaseName` ≈ project, `schemaName` ≈ dataset, `label` ≈ table                    |

Warehouse names are **search hints**, not explore IDs. Explore ids look like `ubie_jp_phr_dwh__dwh_pharma__medico_session_summary`.

## Always search explores

On large projects, **never** use the default first-N explore list (alphabetical across unrelated domains). Always `search` + `limit`.

## Explore disambiguation

Search `medico_session_summary` often returns many siblings (`eda_…`, `reporting_…`, `mre_*`, exact warehouse table). **Do not pick the first hit.**

1. Skip explores with non-empty `errors`.
2. If the user named a dataset, prefer matching **`schemaName`** (e.g. `dwh_pharma` over `dm_pharma`). Skip rows with **empty** `schemaName` unless nothing else matches.
3. Prefer **exact `label`** = warehouse table name (not `eda_medico_session_summary`).
4. Prefer tags such as `lightdash` when still tied.
5. Deprioritize `eda_`, `reporting_`, `mre_`, `mre_dp_`, `mre_pd_` unless asked.
6. State chosen explore **`name`**, `label`, and `schemaName` in the answer.

## Progressive discovery

1. `ldt__list_explores` with search → disambiguate → note explore id.
2. `ldt__list_dimensions` (default: `table === explore.baseTable`, which may differ from explore id) for `fieldId`s. Set `baseTableOnly=false` only if you need joined-table fields (payload grows a lot).
3. `ldt__list_metrics` with a **specific metric keyword** from the question (`nps`, `session`, …). **Not** the table name / explore id (those often return **zero** hits). **Not** ultra-broad tokens alone (`count`, `sum`) as a first try — they flood the catalog; if used, still filter `tableName === exploreId`.
4. Call `ldt__get_explore` only if catalog metrics are insufficient and you need explore-local metric names.
5. `ldt__compile_query` with `fieldId`s → verify SQL columns → **stop**.

## Metrics catalog vs explore

- Response shape: `{ pagination, data: Metric[] }`.
- Keep rows where `tableName` **equals the full explore id**.
- `ldt__get_metric` `tableName` must be that explore id. Short labels (`medico_session_summary`) → “Metric not found”.
- For `ldt__compile_query` metrics, use `{exploreId}_{metricName}` (same pattern as dimension `fieldId`).
- If no catalog metric matches the explore, **compile with `metrics: []`** (dimension-only is valid — e.g. volume-by-day via a date/time dimension).

## Field IDs and empty SELECT

Prefer `fieldId` from `ldt__list_dimensions` (e.g. `…__medico_session_summary_session_start_time_jst`).

Short names alone are unsafe:

1. Upstream may “succeed” with an **empty `SELECT`** — this server returns **`isError`**. Fix to `fieldId`s and re-compile once.
2. Or hard-error on unknown field id.

## Field lineage

`ldt__get_field_lineage` accepts full `fieldId` or short `name`. Summarize; do not paste the full graph.

## Answer shape

Shortlists only: explore `name` / `label` / `schemaName` / why chosen; metric/dimension names + `fieldId`; compiled SQL or compile errors. Never paste full `get_explore`, full dimension arrays, or full lineage JSON.

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

`metrics` may be `[]`.

## Recommended sequence

1. Scope: `ldt__get_project` (or list → pick)
2. Discover: search explores → disambiguate → base-table dimensions + keyword metrics (filter explore id)
3. `ldt__compile_query` with `fieldId`s
4. Verify SELECT columns; stop

## Stop / deliverables

- **Explore prompt:** shortlist only — do not compile unless asked.
- **Compose / debug:** compiled SQL or errors; stop after a good compile (re-compile only while debugging).
