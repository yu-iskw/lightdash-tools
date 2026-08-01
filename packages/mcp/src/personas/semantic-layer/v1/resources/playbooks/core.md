# Semantic-layer core

URI: `lightdash://playbooks/semantic-layer/core`

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

## Answer shape

Shortlists only: explore `name` / `label` / `schemaName` / why chosen; metric/dimension names + `fieldId`; compiled SQL or compile errors. Never paste full `get_explore`, full dimension arrays, full `get_metric`, or full lineage JSON.

## Stop / deliverables

- **Explore prompt:** shortlist only — do not compile unless asked.
- **Compose / debug:** compiled SQL or errors; stop after a good compile (re-compile only while debugging).
- **Multi-insight:** N titled queries with fieldIds + SQL; one explore resolution shared across them.
