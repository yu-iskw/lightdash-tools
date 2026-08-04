# Semantic-layer — explore / discover

URI: `lightdash://playbooks/semantic-layer/explore`

## Always search explores

On large projects, **never** rely on an unfiltered explore list (alphabetical noise across domains). Always call `lightdash_list_explores` with **`search` + `limit` (≤15)**.

Warehouse table / dataset names are **search hints**, not explore IDs. Explore `name` is usually compound (often `{warehouse}__{dataset}__{table}`-style).

## From warehouse inventory → explore

| Inventory hint               | MCP use                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| Dataset                      | Prefer matching **`schemaName`**                                  |
| TABLE                        | `search` = table token; prefer **exact `label`** = table          |
| Partition / time field       | Candidate dimension for time-grain compiles                       |
| Full `project.dataset.table` | `databaseName` ≈ project, `schemaName` ≈ dataset, `label` ≈ table |

Some inventory tables have **no** explore. Empty or irrelevant search → say so; try a related curated/summary table the user cares about.

## Explore disambiguation (do not pick the first hit)

Search for `{table}` often returns siblings: staging / EDA / reporting / MRE variants, empty-schema stubs, and the warehouse table.

1. Skip explores with non-empty `errors`.
2. Skip rows with **empty `schemaName`** / empty tags / junk `name` (e.g. `_`) unless nothing else matches.
3. If the user named a dataset, prefer matching **`schemaName`**.
4. Match table via **exact `label`** = `{table}` **or** explore **`name`** containing `__{table}`.
5. Prefer tags such as `lightdash` when still tied; deprioritize `eda_` / `reporting_` / staging-style prefixes unless asked.
6. Duplicate labels / `_vN` suffixes: prefer the explore **`name`** without an extra version suffix unless the user asked for that version.
7. State chosen explore **`name`**, `label`, `schemaName`, and `databaseName` in the answer.

Remember: `databaseName` may differ from the Lightdash project’s usual warehouse — stay on the given `projectUuid`.

## Progressive discovery

1. `list_explores` → disambiguate → lock `exploreId` (= explore `name`).
2. `list_dimensions` (default `baseTableOnly=true`). Set `baseTableOnly=false` only if you need joined-table fields (payload grows a lot).
3. Metrics: **`get_explore` → `tables[baseTable].metrics` only** (see below). Ignore join metrics; do not dump the explore JSON.
4. Stop at a shortlist unless the user asked to compile.

## Metrics: catalog vs explore-local (critical)

`list_metrics` searches the **project catalog**, not “metrics on this explore”.

| Search token                                 | Typical result                                      |
| -------------------------------------------- | --------------------------------------------------- |
| Full explore id                              | **Often zero** hits                                 |
| Warehouse table label alone                  | **Often zero**                                      |
| Broad domain tokens (`session`, `medico`, …) | Hundreds of **other** tables — flood                |
| Goal keyword from the question               | May hit this explore **and** siblings — must filter |

Rules:

1. Once the explore is known, prefer **`get_explore` → `tables[baseTable].metrics`** for the local menu (names + labels only). Ignore join **metrics** under other `tables` keys; do not dump the explore JSON.
2. Optional catalog: at most **one** `list_metrics` page. Keep rows where `tableName` **equals the full explore id**.
3. `get_metric` `tableName` must be the full explore id. Short labels → “Metric not found”. Call only when definition/SQL is needed; summarize — payloads include huge `availableTimeDimensions` from joins. Prefer `compiledSql` over name/label when they disagree.
4. Compile metric ids as `{exploreId}_{metricName}` (same pattern as dimension `fieldId` from `list_dimensions`).
5. Dimension-only (`metrics: []`) is valid for volume-by-time; for “insights” prefer real explore metrics when available.
6. Joined **dimension** `fieldId`s (e.g. `customers_*` on an `orders` explore) are valid when `list_dimensions` with `baseTableOnly=false` returns them — use only those copied ids.

## Dimension shortlist (large explores)

Base tables can expose **hundreds** of dimensions; many are nested (`a.b.c` paths / event arrays). Do **not** dump the list.

Prefer high-signal fields that **appear in `list_dimensions`**, by **role**:

- Time grains that exist as real `fieldId`s (day / week / month; prefer local timezone grains when both UTC and local exist — e.g. `*_jst_day`)
- Channel / platform / traffic source
- Segment / demographic / cohort dimensions relevant to the question
- Core product or entity attributes named in the question

Skip nested event dumps and deep struct paths unless the question targets them.

**Copy `fieldId` literally.** Do not invent grains like `{explore}_session_day` if that string is not in `list_dimensions`.

## Field lineage

`get_field_lineage` accepts full `fieldId` or short `name`. Default: skip. If used once, answer with a short summary (e.g. “upstream models: A → B → explore”) — never paste the graph.
