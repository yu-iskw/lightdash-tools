# Content-reader — compare / investigate

URI: `lightdash://playbooks/content-reader/compare`

Focus phases 3–6 on **diffs** between saved content definitions and (optionally) values.

## Phase 3 — Inspect both sides

Retrieve metadata first (`get_chart`, `get_dashboard`, `explain_content`, parameter tools). Compare definitions, dimensions, filters, time grains, parameters, verification, and update state before values.

## Phase 4 — Decide whether values help

Execute only when structurally comparable or when differences are the subject of analysis. Do not assume matching labels mean matching definitions.

## Phase 5 — Execute with equivalent context

When needed, run with equivalent valid filters/parameters/context (`run_chart` / `run_dashboard_tile`). Check metrics, fields, filters, dashboard context, date ranges, time grains, parameters, sorts, limits, pivots, table calculations, verification, cache timestamps, and semantic-versus-SQL behavior.

## Phase 6 — Report causes

Separate confirmed, plausible, ruled-out, and unresolved causes. Cite content UUIDs, query UUIDs, truncation, and caveats.
