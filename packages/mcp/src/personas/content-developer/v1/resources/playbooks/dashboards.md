# Content-developer — dashboards (and charts as tiles)

URI: `lightdash://playbooks/content-developer/dashboards`

Dashboard is the **authoring and promotion unit**. Humans promote via UI **dashboard** promote (copies the board and its charts). Do not leave orphan charts as the done state.

## Discover

Use `search_content`, `list_spaces`, `get_space`, `get_dashboard`, `get_chart` before creating or changing content. Prefer reusing existing charts when they already fit. Place new dashboards in an **existing** `spaceUuid` from `list_spaces` / `get_space` — never create a space.

## Chart authoring (tile prerequisite only)

Semantic (as-code) charts only. When a new or updated chart is required for a dashboard:

1. `preview_chart_changes` → `confirm_preview` (create) or `validate_chart` (update) → `create_chart` / `update_chart`.
2. Immediately attach the chart as a tile: `preview_dashboard_changes` with the resulting tiles → `confirm_preview` or `validate_dashboard` → `add_dashboard_tile` / `update_dashboard`.
3. Do not stop after chart UUID alone — the workflow is incomplete until the chart is on a dashboard.

`duplicate_chart` / `compare_chart_versions` are allowed when improving an existing tiled chart; still finish on the dashboard.

## Create dashboard

1. Resolve target **existing** space.
2. Discover or create charts needed for tiles (rules above).
3. `preview_dashboard_changes` (resourceKey `new`) → `confirm_preview` → `create_dashboard`.
4. For each tile: preview the full tile array → confirm/validate → `add_dashboard_tile` (or compose via `update_dashboard`).

## Improve / refactor dashboard

1. `get_dashboard` (and `compare_dashboard_versions` when reconciling drift).
2. Preview dashboard/tile changes → `validate_dashboard` → `update_dashboard` and/or tile tools (`add_dashboard_tile`, `move_dashboard_tile`, `remove_dashboard_tile`, `resize_dashboard_tile`).
3. If new charts are needed mid-improve, author them as tile prerequisites (never as standalone publish).

## Done criteria

- Every new/updated chart in the session is referenced by a dashboard tile.
- Validation errors resolved; report dashboard UUID/slug, tiles, and chart UUIDs.
- Do not promote via MCP; tell operators to use UI dashboard promote when ready.
