# Content-reader core

URI: `lightdash://playbooks/content-reader/core`

## Purpose

Discover, explain, and **optionally execute** saved Lightdash charts/dashboards inside one resolved project. Never author new queries or mutate content.

## Hard bans

- Do not mutate Lightdash resources (create/update/delete/move/promote).
- Do not execute arbitrary metric queries, raw SQL, SQL runner, or underlying-data downloads.
- Do not bulk-export or page endlessly through result sets.
- Do not execute saved SQL charts (`source=sql` / `chartType=sql`); default capability is off (`canExecuteSqlCharts=false`).
- Do not override filter **targets/operators**, required-filter behavior, fields, metrics, dimensions, SQL, table calculations, or sorts — only allowed **value** overrides on existing filter ids / known parameters.
- Do not execute content outside the resolved project.
- Do not present truncated / incomplete coverage as a full answer.
- Do not claim metric equivalence from matching labels alone.
- Do not invent secrets, warehouse credentials, or hidden SQL text.

## Default budgets (override only if the user expands scope)

| Resource                                        | Default                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `search_content` pages                          | `pageSize≤25`, stop after **2** pages (or when `pagination.complete`) |
| Candidates returned to the user                 | **≤5**                                                                |
| Spaces deep-dived (`get_space`)                 | **≤3**                                                                |
| Charts / dashboards fully inspected             | **≤5** metadata fetches                                               |
| Executions (`run_chart` / `run_dashboard_tile`) | **≤3** total; dashboard tiles **≤5** when summarizing                 |
| Chart image exports (`export_chart_image`)      | **≤3** (prefer when the user needs to **see** the viz)                |
| Result rows kept in the answer                  | **≤20** (even if more returned)                                       |
| `get_query_result` polls                        | only while status is non-terminal; then stop                          |

Record budget / pagination / truncation stops in the answer.

## Coverage semantics (do not confuse)

- **`pagination.complete`**: this list page finished (or you stopped paging).
- **`coverage.complete`**: true only when the envelope says the _result_ is complete **and** not truncated. `status=complete` + `truncated=true` (e.g. small `pageSize` on `get_query_result`) ⇒ **incomplete** for reporting.
- Warning codes such as `TRUNCATED`, `REDACTED`, `CONTENT_NOT_EXECUTABLE`, `PROJECT_SCOPE_REQUIRED` are first-class evidence — cite them.

## Allowed tools (`lightdash_*`)

| Tool                                                 | Use for                                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `get_project`                                        | Resolve project; read `readerCapabilities` + pin context |
| `search_content`                                     | Find charts/dashboards/spaces/data apps                  |
| `list_spaces` / `get_space`                          | Space hierarchy + immediate content                      |
| `get_dashboard` / `get_chart`                        | Structure / definition (SQL text hidden)                 |
| `list_project_parameters` / `get_project_parameters` | Parameter defs / values                                  |
| `explain_content`                                    | Compact metadata explanation                             |
| `run_chart` / `run_dashboard_tile`                   | Bounded saved execution (numbers)                        |
| `export_chart_image`                                 | PNG snapshot of a saved chart (vision); needs headless   |
| `get_query_result` / `cancel_query`                  | Poll / cancel by `queryUuid`                             |

## Phase 0 — Resolve project

1. Always pass **`projectUuid`** (or rely on HTTP `X-Lightdash-Project` pin). Without either → `PROJECT_SCOPE_REQUIRED`; stop.
2. Call `get_project`. Record UUID, name, `context.projectPinned`, and `readerCapabilities` (`canExecuteSavedCharts`, `canExecuteSqlCharts`, `canExecuteDashboardTiles`).
3. There is **no** org-wide project list on this profile — never invent one.

## Answer shape

- Facts with **content UUID / slug**, space name, and (if executed) **queryUuid**.
- Explicit metadata vs inferred meaning.
- Cache/time context, applied parameters/filters, truncation, and capability limits.
- Never dump full dashboard tile arrays or full result tables — summarize.
