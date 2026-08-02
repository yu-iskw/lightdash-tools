# Content-developer — dashboards (and charts as tiles)

URI: `lightdash://playbooks/content-developer/dashboards`

Dashboard is the **authoring and promotion unit**. Humans promote via UI **dashboard** promote (copies the board and its charts). Do not leave orphan charts as the done state.

## Discover

Use `search_content`, `list_spaces`, `get_space`, `get_dashboard`, `get_chart` before creating or changing content. Prefer reusing existing charts when they already fit. Place new dashboards in an **existing** `spaceUuid` from `list_spaces` / `get_space` — never create a space.

## Chart authoring (tile prerequisite only)

Semantic (as-code) charts only. When a new or updated chart is required for a dashboard:

1. `preview_chart_changes` → `confirm_preview` → `create_chart` / `update_chart`.
   - Create: pass `slug` only when the slug is free (`CHART_SLUG_EXISTS` otherwise — then pass `chartUuidOrSlug` and use update).
   - Update: pass `chartUuidOrSlug`; confirm with the preview's UUID `resourceKey` (slug is an alias).
2. Immediately attach the chart as a tile: `preview_dashboard_changes` with the resulting tiles → `confirm_preview` → `add_dashboard_tile` / `update_dashboard`.
3. Do not stop after chart UUID alone — the workflow is incomplete until the chart is on a dashboard.

`duplicate_chart` / `compare_chart_versions` are allowed when improving an existing tiled chart; still finish on the dashboard.

## Create dashboard

1. Resolve target **existing** space.
2. Discover or create charts needed for tiles (rules above).
3. `preview_dashboard_changes` (resourceKey `new`) → `confirm_preview` → `create_dashboard`.
4. For each tile: preview the full tile array → `confirm_preview` → `add_dashboard_tile` (or compose via `update_dashboard`).

## Duplicate dashboard

1. `preview_dashboard_changes` with `dashboardUuidOrSlug` = source UUID and `changes` = `{ newName?, spaceUuid? }` (must match apply args).
2. `confirm_preview` with `resourceKind: 'dashboard'` and `resourceKey` = source UUID.
3. `duplicate_dashboard` with the same source UUID / proposed fields (apply re-reads source baseline).

## Improve / refactor dashboard

1. `get_dashboard` (and `compare_dashboard_versions` when reconciling drift).
2. Preview dashboard/tile changes → `confirm_preview` → `update_dashboard` and/or tile tools (`add_dashboard_tile`, `move_dashboard_tile`, `remove_dashboard_tile`, `resize_dashboard_tile`).
3. If new charts are needed mid-improve, author them as tile prerequisites (never as standalone publish).
4. Optionally `validate_dashboard` / `validate_chart` on saved UUIDs after apply (health check only).

## Done criteria

- Every new/updated chart in the session is referenced by a dashboard tile.
- Report dashboard UUID/slug, tiles, and chart UUIDs; resolve outstanding saved-resource validation warnings when using `validate_*`.
- Do not promote via MCP; tell operators to use UI dashboard promote when ready.
