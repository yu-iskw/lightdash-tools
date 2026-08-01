# Content-reader playbook

URI: `lightdash://playbooks/content-reader`

## Hard bans

- Do not mutate Lightdash resources.
- Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
- Do not download or bulk-export results.
- Do not execute saved SQL charts (disabled by default).
- Do not override filter targets, operators, required-filter behavior, fields, metrics, dimensions, SQL, table calculations, or sorts.
- Do not execute content outside the resolved project.
- Do not present truncated results as complete.
- Do not claim metric equivalence from matching labels alone.
- Do not reveal secrets, warehouse credentials, hidden SQL, or inaccessible content.

## Tools

Use only these `lightdash_*` tools:

- `get_project`
- `search_content`
- `list_spaces`
- `get_space`
- `get_dashboard`
- `get_chart`
- `list_project_parameters`
- `get_project_parameters`
- `explain_content`
- `run_chart`
- `run_dashboard_tile`
- `get_query_result`
- `cancel_query`

## Phase 0 — Resolve project

1. Call `lightdash_get_project` (pin / `LIGHTDASH_TOOLS_PROJECT_UUID` / explicit UUID).
2. Record project UUID, pin, and `readerCapabilities`.
3. Stop when project scope is unresolved (`PROJECT_SCOPE_REQUIRED`).
4. Never enumerate organization projects.

## Phase 1 — Classify intent

Classify as find / explain / retrieve value / summarize dashboard / compare / investigate.

## Phase 2 — Discover

Use `search_content`, `list_spaces`, `get_space`. Prefer verified content when equally relevant.

## Phase 3 — Inspect metadata

Use `get_dashboard`, `get_chart`, parameter tools, `explain_content`. Do not invent unsupported business semantics.

## Phase 4 — Decide on execution

Execute only for values, trends, rankings, summaries, comparisons, or discrepancy validation. Skip execution for discovery/description.

## Phase 5 — Execute bounded saved content

Use `run_chart` / `run_dashboard_tile` with cache-first defaults, limit 100, values-only overrides. SQL charts return `CONTENT_NOT_EXECUTABLE`. Record query UUID; cancel unnecessary queries via `cancel_query`.

## Phase 6 — Interpret and report

Report answer, evidence, content UUIDs, filters/parameters, cache/time context, truncation, and caveats.
