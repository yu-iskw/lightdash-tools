# Semantic-layer MCP playbook

## Purpose

Discover the Lightdash semantic layer and **compose + compile** metric queries. Stop after a good compile (or clear compile errors). Do **not** run warehouse queries or mutate content.

## Allowed tools (always `lightdash_` prefix)

| Tool                                                | Use for                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `lightdash_list_projects` / `lightdash_get_project` | Confirm project UUID ↔ name via `{ data, warnings }` metadata (no warehouse/dbt credentials)                     |
| `lightdash_list_explores`                           | Summaries (`name`, `label`, `tags`, `databaseName`, `schemaName`, `errors?`); **always** pass `search` + `limit` |
| `lightdash_list_dimensions`                         | Compact `{ name, label, table, type, fieldId }`; **default = `table === explore.baseTable`**                     |
| `lightdash_list_metrics` / `lightdash_get_metric`   | Catalog search; **always** filter `tableName === exploreId` client-side                                          |
| `lightdash_compile_query`                           | Compile only — never “run”                                                                                       |
| `lightdash_get_explore`                             | Use when catalog filter yields **zero** explore-local metrics; extract `tables[baseTable].metrics` only          |
| `lightdash_get_field_lineage`                       | Optional; summarize, don’t dump                                                                                  |

## Hard bans

Do **not** attempt or invent: run-query / SQL runner / validation jobs / charts / dashboards / spaces / users / groups / ACL / AI agents / agentops. Those tools are not on this server. Use Lightdash **compile** only (not warehouse execution).

## Project scope

1. If the user gave a **project UUID**, use it on every tool. Prefer `lightdash_get_project` to confirm the name.
2. Without an HTTP project pin, `lightdash_list_projects` may return the **entire org** — do **not** switch to another project from that list.
3. Lightdash **project UUID** ≠ warehouse cloud project. `list_projects` / `get_project` return metadata only (no `warehouseConnection` / `dbtConnection`). Match inventory project/dataset to explore **`databaseName`** / **`schemaName`** from `list_explores`.

## From warehouse inventory → explore

When the user pastes warehouse inventory (dataset / table / partition field):

| Inventory hint                  | MCP use                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Dataset (`{dataset}`)           | Prefer explores with matching **`schemaName`**                                            |
| TABLE (`{table}`)               | `lightdash_list_explores` **`search`** = that table token; prefer **exact `label` match** |
| Partition / time field          | Candidate **dimension** `fieldId` for time-grain compiles                                 |
| Full id `project.dataset.table` | `databaseName` ≈ project, `schemaName` ≈ dataset, `label` ≈ table                         |

Warehouse names are **search hints**, not explore IDs. Explore ids are usually compound (often `{project}__{dataset}__{table}`-style); use the explore `name` returned by tools.

Some inventory tables have **no** explore. Empty `list_explores` → say so; try a related curated/summary table the user cares about.

## Always search explores

On large projects, **never** use the default first-N explore list (alphabetical across unrelated domains). Always `search` + `limit`.

## Explore disambiguation

Search for `{table}` often returns siblings (staging / EDA / reporting variants, and the warehouse table). **Do not pick the first hit.**

1. Skip explores with non-empty `errors`.
2. If the user named a dataset, prefer matching **`schemaName`**. Skip rows with **empty** `schemaName` unless nothing else matches.
3. Match warehouse table via **exact `label`** = `{table}`, **or** explore **`name`** ending with / containing `__{table}` (labels may be humanized).
4. Prefer tags such as `lightdash` when still tied.
5. Deprioritize staging / EDA / reporting-style name prefixes unless the user asked for them.
6. Duplicate labels with version suffixes: prefer the explore **`name`** without an extra `_vN` unless the user asked for that version.
7. State chosen explore **`name`**, `label`, and `schemaName` in the answer.

## Progressive discovery

1. `lightdash_list_explores` with search → disambiguate → note explore id (`name`, `label`, `schemaName`).
2. `lightdash_list_dimensions` (default: `table === explore.baseTable`, which may differ from explore id) for `fieldId`s. Set `baseTableOnly=false` only if you need joined-table fields (payload grows a lot).
3. Discover metrics (see below). Prefer **explore-local** metrics on the base table over unrelated catalog hits.
4. `lightdash_compile_query` with `fieldId`s → verify SQL columns → **stop** (or next insight if the user asked for several).

## Metrics: catalog vs explore-local (critical)

`lightdash_list_metrics` searches the **org catalog**, not “metrics on this explore”.

| Search token                   | Typical result                                      |
| ------------------------------ | --------------------------------------------------- |
| Warehouse table / explore id   | **Often zero** hits                                 |
| Broad domain / entity tokens   | Hundreds of **other** tables — flood                |
| Goal keyword from the question | May hit this explore **and** siblings — must filter |

Rules:

1. Once the explore is known, prefer **`lightdash_get_explore` → `tables[baseTable].metrics` only** for the full local menu (names + labels). Do **not** paste the full explore JSON. Ignore join tables under `tables`.
2. Optional: keyword `lightdash_list_metrics` for discovery. Response shape `{ pagination, data: Metric[] }`. Keep rows where `tableName` **equals the full explore id**. Table/explore-id search often returns **zero**.
3. `lightdash_get_metric` `tableName` must be the full explore id. Short warehouse labels → “Metric not found”. Summarize; do not paste huge `availableTimeDimensions` payloads.
4. Compile metric ids as `{exploreId}_{metricName}` (same pattern as dimension `fieldId`).
5. Dimension-only (`metrics: []`) is valid for volume-by-time; for “insights” prefer real explore metrics when available.

## Dimension shortlist (large explores)

Base tables can expose **hundreds** of dimensions (nested structs, event arrays). Do **not** dump the full list.

Prefer high-signal fields that appear in `list_dimensions`, by **role**:

- Time grains (day / week / month; prefer local timezone grains when both UTC and local exist)
- Channel / platform / traffic source
- Segment / demographic / cohort dimensions relevant to the question
- Core product or entity attributes named in the question

Skip nested event dumps and deep struct paths unless the question targets them.

## Multi-insight composition (“compose N queries”)

When the user asks for several insights on one table/explore:

1. Disambiguate explore once; reuse the same `exploreId` and metric shortlist.
2. Pick **diverse** cuts from available metrics/dims (don’t repeat the same grain N times)—e.g. trend, breakdown by a categorical dim, quality/rate metrics, outcome metrics, acquisition/source—only when those fields exist.
3. Compile each with `lightdash_compile_query`; verify SELECT columns; present **insight title + metric/dimension fieldIds + compiled SQL** (or errors). Do not paste full dimension/explore payloads.
4. Metrics that join other tables may produce large CTE SQL — still OK; mention the join briefly.

## Field IDs and empty SELECT

Prefer `fieldId` from `lightdash_list_dimensions` / `{exploreId}_{metricName}`.

Short names alone are unsafe:

1. Upstream may “succeed” with an **empty `SELECT`** — this server returns **`isError`**. Fix to `fieldId`s and re-compile once.
2. Or hard-error on unknown field id.

Compiled SQL may include **extra related metrics** the semantic layer pulls in — verify columns against the goal; unexpected helpers can be OK if the requested fields are present.

## Field lineage

`lightdash_get_field_lineage` accepts full `fieldId` or short `name`. Summarize; do not paste the full graph.

## Answer shape

Shortlists only: explore `name` / `label` / `schemaName` / why chosen; metric/dimension names + `fieldId`; compiled SQL or compile errors. Never paste full `get_explore`, full dimension arrays, full `get_metric`, or full lineage JSON.

## metricQuery skeleton

```json
{
  "exploreName": "{exploreId}",
  "dimensions": ["{exploreId}_{dim}"],
  "metrics": ["{exploreId}_{metric}"],
  "filters": {},
  "sorts": [{ "fieldId": "{exploreId}_{dim}", "descending": false }],
  "limit": 50,
  "tableCalculations": []
}
```

`metrics` may be `[]`.

## Recommended sequence

1. Scope: `lightdash_get_project` with the user-given project UUID (do not switch from an org-wide list)
2. Discover: search explores → disambiguate → base-table dimensions (shortlist) + explore-local metrics (`get_explore` metrics map; catalog keyword optional)
3. `lightdash_compile_query` with `fieldId`s (repeat for multi-insight)
4. Verify SELECT columns; stop

## Stop / deliverables

- **Explore prompt:** shortlist only — do not compile unless asked.
- **Compose / debug:** compiled SQL or errors; stop after a good compile (re-compile only while debugging).
- **Multi-insight:** N titled queries with fieldIds + SQL; one explore resolution shared across them.
