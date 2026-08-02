# Semantic-layer — explore / discover

URI: `lightdash://playbooks/semantic-layer/explore`

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
4. Stop at a shortlist unless the user asked to compile (compose/compile topic).

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

## Field lineage

`lightdash_get_field_lineage` accepts full `fieldId` or short `name`. Summarize; do not paste the full graph.
