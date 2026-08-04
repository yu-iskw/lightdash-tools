# Semantic-layer core

URI: `lightdash://playbooks/semantic-layer/core`

## Purpose

Discover the Lightdash semantic layer and **compose + compile** metric queries. Stop after a good compile (or a clear blocker). This server never runs warehouse queries or mutates content.

## Hard bans

- Do **not** run / execute metric queries, SQL runner, charts, dashboards, or underlying data.
- Do **not** invent tools for validation jobs, spaces, users, groups, ACL, AI agents, or agentops — they are not on this server.
- Do **not** switch away from the user-given **Lightdash project UUID** after seeing `list_projects` (org-wide) or explore tags that mention other warehouses.
- Do **not** paste full `get_explore`, full dimension arrays, full `get_metric`, or full lineage JSON into the answer.
- Do **not** invent `fieldId`s or time-grain names — copy them from tool output only.

## Default budgets (override only if the user expands scope)

| Resource                            | Default                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Explore search candidates inspected | **≤10** rows from `list_explores` (`search` + `limit≤15`)                |
| Explores opened with `get_explore`  | **1** chosen explore (retry only if wrong explore)                       |
| Dimension shortlist in the answer   | **≤12** fieldIds                                                         |
| Metrics shortlisted / used          | **≤8** (from `tables[baseTable].metrics`)                                |
| `list_metrics` catalog pages        | **0** once explore is known; else **≤1** page (`pageSize≤20`) and filter |
| `get_metric`                        | **0** by default; **≤2** only when SQL/definition is required            |
| `get_field_lineage`                 | **0** by default; **≤1** and summarize as “N upstream models”            |
| Compile retries                     | **≤2** after the first attempt (fix fieldIds / explore, then stop)       |

Record when a budget stopped you.

## Allowed tools (`lightdash_` prefix)

| Tool                            | Use for                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_projects` / `get_project` | Confirm UUID ↔ name. Credentials never returned (`REDACTED` warning is normal).                                                                                           |
| `list_explores`                 | Summaries only. **Always** pass `search` + `limit`.                                                                                                                       |
| `list_dimensions`               | Compact `{ name, label, table, type, fieldId }`. Default = base table only.                                                                                               |
| `get_explore`                   | **Preferred** metric menu: `tables[baseTable].metrics` names/labels only. Ignore join **metrics**; joined dims via `list_dimensions` (`baseTableOnly=false`) when needed. |
| `list_metrics` / `get_metric`   | Optional catalog / definition dig. Filter `tableName === exploreId`.                                                                                                      |
| `compile_query`                 | Compile only — never “run”. Sets `exploreName` from `exploreId`; defaults missing `tableCalculations` to `[]`. Prefer compiled SQL aliases over metric labels.            |
| `get_field_lineage`             | Optional provenance; summarize, don’t dump.                                                                                                                               |

## Project scope (critical)

1. Every tool call uses the **user-given Lightdash `projectUuid`**. Prefer `get_project` once to confirm the name.
2. Without HTTP pin `X-Lightdash-Project`, `list_projects` may list the **entire org**. Do **not** switch projects because a sibling name looks related.
3. Lightdash **project UUID** ≠ BigQuery/GCP project. Explores carry `databaseName` / `schemaName` (warehouse). One Lightdash project often embeds explores whose `databaseName` points at another warehouse project — that is normal; stay on the given UUID.
4. Optional ceiling `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` may already filter `list_projects`; still pass the user’s UUID on tools.

## Answer shape

- Explore: `name` / `label` / `schemaName` / `databaseName` + why chosen.
- Fields: short names + **full `fieldId`** (+ role: time / channel / segment / metric).
- Compile: insight title(s) + fieldIds + compiled SQL (or errors). Verify every requested fieldId appears as a SELECT alias.
- Gaps: budget hits, empty explore search, compile blockers.

## Stop / deliverables

| Prompt          | Stop when                                                         |
| --------------- | ----------------------------------------------------------------- |
| Explore         | Shortlist delivered; **do not compile** unless asked              |
| Compose / debug | Good compile (aliases verified) or clear blocker after ≤2 retries |
| Multi-insight   | N titled compiles on **one** explore; shared discovery            |

## Tool order (default)

1. `get_project` (confirm) → `list_explores` (`search`+`limit`) → disambiguate
2. `list_dimensions` (base table) → shortlist by role
3. `get_explore` → extract **only** `tables[baseTable].metrics` (names/labels)
4. `compile_query` with copied fieldIds → verify SELECT aliases → stop
