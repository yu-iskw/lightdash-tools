# Content-reader — compare / investigate

URI: `lightdash://playbooks/content-reader/compare`

Compare **definitions before values**. Matching titles/labels ≠ same metric, grain, or population.

## Inspect both sides

1. Resolve each reference (UUID/slug/search) inside the same `projectUuid`.
2. Fetch metadata (`get_chart` / `get_dashboard` / `explain_content`). Prefer `includeQueryDefinition` for charts.
3. Diff checklist:
   - Explore / `tableName`
   - Metrics & dimensions (`fieldId`s)
   - Filters (targets, operators, windows — e.g. `inThePast` days; `in the last` vs completed periods vs `in the current` — [filters reference](https://docs.lightdash.com/guides/filters))
   - Time grain / timezone fields
   - Parameters, sorts, limits, pivots, table calculations
   - Chart `source` / `chartType` (semantic vs SQL)
   - Verification, `updatedAt`, space, views
   - Dashboard context (filters, tile selection) when comparing tiles

## When to execute

Execute **only** if sides are structurally comparable **or** the user asked about value differences. Use equivalent valid context (same overrides if any). Cap at **≤2** executions unless the user expands scope.

Skip execution when either side is SQL / non-executable — report that as a confirmed blocker.

## Report causes

Separate:

- **Confirmed** (from metadata or executed numbers)
- **Plausible** (hypothesis)
- **Ruled out**
- **Unresolved** (missing access, truncation, non-executable)

Cite content UUIDs, query UUIDs, truncation, and caveats. Do not assume label equality.
