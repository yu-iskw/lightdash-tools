# Content-reader — explain & run

URI: `lightdash://playbooks/content-reader/explain-run`

## Phase 3 — Inspect metadata

Use `get_dashboard`, `get_chart`, parameter tools, `explain_content`. Do not invent unsupported business semantics. Distinguish explicit metadata from inferred business meaning.

## Phase 4 — Decide on execution

Execute only for values, trends, rankings, summaries, comparisons, or discrepancy validation. Skip execution for discovery/description.

## Phase 5 — Execute bounded saved content

Use `run_chart` / `run_dashboard_tile` with cache-first defaults, limit 100, values-only overrides. SQL charts return `CONTENT_NOT_EXECUTABLE`. Record query UUID; cancel unnecessary queries via `cancel_query`.

## Phase 6 — Interpret and report

Report answer, evidence, content UUIDs, filters/parameters, cache/time context, truncation, and caveats. Cite chart/dashboard UUID and query UUID. Do not construct a new query or retrieve underlying data. Do not claim unexecuted tiles support a conclusion.
