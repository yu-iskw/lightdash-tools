# Semantic-layer MCP playbook

## Purpose

Discover the Lightdash semantic layer and **compose + compile** metric queries. Stop after a good compile (or clear compile errors). Do **not** run warehouse queries or mutate content.

## Allowed tools (always `ldt__` prefix)

| Tool                                      | Use for                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ldt__list_projects` / `ldt__get_project` | Confirm project UUID ↔ name                                                                                      |
| `ldt__list_explores`                      | Summaries (`name`, `label`, `tags`, `databaseName`, `schemaName`, `errors?`); **always** pass `search` + `limit` |
| `ldt__list_dimensions`                    | Compact `{ name, label, table, type, fieldId }`; **default = `table === explore.baseTable`**                     |
| `ldt__list_metrics` / `ldt__get_metric`   | Catalog search; **always** filter `tableName === exploreId` client-side                                          |
| `ldt__compile_query`                      | Compile only — never “run”                                                                                       |
| `ldt__get_explore`                        | Use when catalog filter yields **zero** explore-local metrics; extract `tables[baseTable].metrics` only          |
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

1. `ldt__list_explores` with search → disambiguate → note explore id (`name`, `label`, `schemaName`).
2. `ldt__list_dimensions` (default: `table === explore.baseTable`, which may differ from explore id) for `fieldId`s. Set `baseTableOnly=false` only if you need joined-table fields (payload grows a lot).
3. Discover metrics (see below). Prefer **explore-local** metrics on the base table over unrelated catalog hits.
4. `ldt__compile_query` with `fieldId`s → verify SQL columns → **stop** (or next insight if the user asked for several).

## Metrics: catalog vs explore-local (critical)

`ldt__list_metrics` searches the **org catalog**, not “metrics on this explore”.

| Search token                         | Typical result                                      |
| ------------------------------------ | --------------------------------------------------- |
| Warehouse table / explore id         | **Often zero** hits                                 |
| Broad `medico` / `session` / `count` | Hundreds of **other** tables — flood                |
| Goal keyword (`nps`, `完了`, `問診`) | May hit this explore **and** siblings — must filter |

Rules:

1. Response shape: `{ pagination, data: Metric[] }`. Keep rows where `tableName` **equals the full explore id**.
2. After filter, if **zero** rows remain → call `ldt__get_explore` and read **only** `tables[baseTable].metrics` (names + labels). Do **not** paste the full explore JSON into the answer.
3. `ldt__get_metric` `tableName` must be the full explore id. Short labels (`medico_session_summary`) → “Metric not found”.
4. Compile metric ids as `{exploreId}_{metricName}` (same pattern as dimension `fieldId`).
5. Dimension-only (`metrics: []`) is valid for volume-by-time, but for “insights” prefer real explore metrics (starts, completes, rates, NPS, …).

## Dimension shortlist (large explores)

Base tables can expose **hundreds** of dimensions (nested structs, event arrays). Do **not** dump the full list.

Prefer high-signal fields for insight queries:

- Time grain: `*_jst_day` / `*_jst_week` / `*_jst_month` (prefer JST when both UTC and JST exist)
- Platform / channel: `platform_web_app`, `utm_source`, `utm_medium`, `is_admedia_inflow`
- Demographics: `selected_person_age_seg`, `selected_person_sex`
- Clinical / product: `keyword_name`, `maincomplaint_name`, `triage_level` / `triage_type`

Skip nested event dumps (`open_disease_card_events.*`, long questionnaire paths) unless the question targets them.

## Multi-insight composition (“compose N queries”)

When the user asks for several insights on one table/explore:

1. Disambiguate explore once; reuse the same `exploreId` and metric shortlist.
2. Pick **diverse** cuts (don’t repeat the same grain five times), e.g.:
   - Trend: time grain + volume + completion rate (+ median duration if available)
   - Funnel: platform × start / keyword / complete counts + rate
   - Quality: NPS (or promoters/detractors) × platform × age
   - Outcome: visit intention / diagnosis-accuracy style rates × demographics
   - Acquisition: `utm_source` / ad flag × completion + NPS / visit rate
3. Compile each with `ldt__compile_query`; verify SELECT columns; present **insight title + metric/dimension fieldIds + compiled SQL** (or errors). Do not paste full dimension/explore payloads.
4. Metrics that join other tables (e.g. diagnosis accuracy) may produce large CTE SQL — still OK; mention the join briefly.

## Field IDs and empty SELECT

Prefer `fieldId` from `ldt__list_dimensions` (e.g. `…__medico_session_summary_session_start_time_jst_week`).

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
2. Discover: search explores → disambiguate → base-table dimensions (shortlist) + metrics (keyword catalog **or** `get_explore` metrics map)
3. `ldt__compile_query` with `fieldId`s (repeat for multi-insight)
4. Verify SELECT columns; stop

## Stop / deliverables

- **Explore prompt:** shortlist only — do not compile unless asked.
- **Compose / debug:** compiled SQL or errors; stop after a good compile (re-compile only while debugging).
- **Multi-insight:** N titled queries with fieldIds + SQL; one explore resolution shared across them.
