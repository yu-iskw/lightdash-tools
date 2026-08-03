# Content-developer — dashboards (and dashboard-owned charts)

URI: `lightdash://playbooks/content-developer/dashboards`

**Order matters:** create the **dashboard shell first**, then create charts with `dashboardSlug` set to that dashboard, then attach tiles. Official Lightdash as-code: `dashboardSlug` scopes a chart to a dashboard (it will not appear as an independent space chart). Promote via **content-governance**.

```text
get_project → list_spaces
  → create_dashboard (empty / markdown shell)  ← record dashboard slug
  → reuse tiles OR get_chart_as_code → create_chart (dashboardSlug set)
  → update_dashboard (full tile array)
```

## Discover

1. `list_spaces` → existing `spaceUuid` (dashboards) / `spaceSlug` (chart as-code).
2. `search_content` with **short** tokens (`orders`, space slug). Multi-word brand phrases often return empty — use `get_space`.
3. Prefer **reuse** of existing charts as tiles when they already fit.
4. For new charts: find a **working seed** on the same `tableName`; never invent fieldIds.

## Create dashboard shell (step 1 — always first for new boards)

1. Resolve target **existing** `spaceUuid`.
2. `preview_dashboard_changes` without `dashboardUuidOrSlug`, `changes: { name, description?, spaceUuid, tabs: [], tiles: [] }` → `resourceKey` is literal **`new`**.
3. `confirm_preview` (`resourceKind: 'dashboard'`, `resourceKey: 'new'`).
4. `create_dashboard` with **`dashboard: { … }`** — same fields as `changes` (nested object; not flat tool args). Empty or markdown-only `tiles`.
5. Record returned **`slug`** and **`uuid`** — required as `dashboardSlug` for new charts.

## New chart for that dashboard (step 2)

Semantic as-code only. Prefer clone, not invent.

### Seed SOP

1. Prefer **reuse** of an existing chart as a tile when it already fits.
2. Else `search_content` / `get_space` → pick a **rendering** seed on the same `tableName` (same explore).
3. `get_chart_as_code` (or `duplicate_chart`) → **keep `chartConfig` structure** (layout + series encode); edit only `name`, `slug`, and `metricQuery` fields that exist on the explore; set `dashboardSlug` = dashboard slug from step 1.
4. Viz type / encode details: `lightdash://playbooks/content-developer/chart-types`.

Then:

1. Set `spaceSlug`, `skipSpaceCreate: true`, `version`, `tableName`, `dashboardSlug`.
2. Every dimension in `metricQuery.dimensions` must appear in viz config (cartesian layout / pie groups / sankey source-target / …) — unused dimensions change SQL GROUP BY and can yield “Results may be incorrect”.
3. `preview_chart_changes` with top-level **`slug`** + `changes` body → `confirm_preview` (`resourceKey` = that slug) → `create_chart` / `update_chart` (`slug` + `chart: { … }` matching `changes`).

If fieldIds are unknown → stop; use semantic-layer. Do **not** hand-author minimal cartesian configs (series without `encode.xRef`/`yRef`).

`dashboardSlug` alone does **not** place the chart on the board — step 3 (tiles) is mandatory.

### Duplicate chart

1. Preview with `chartUuidOrSlug` = source and `changes` = `{ sourceChartUuidOrSlug, newSlug, newName? }`.
2. Confirm `resourceKind: 'chart'`, `resourceKey` = **source** UUID.
3. `duplicate_chart`, then `update_chart` if needed to set `dashboardSlug` and any metricQuery edits (clone body via `get_chart_as_code` first).
4. Tile the result onto the dashboard.

## Attach tiles (step 3)

1. Compose the **full** tile array (markdown + `saved_chart` with `x/y/w/h`; grid width max **36**).
2. Require `properties.savedChartUuid` from the chart create/duplicate result (OpenAPI `CreateDashboardChartTile`). Optional `chartSlug` is metadata only — do not tile with slug alone.
3. `preview_dashboard_changes` → `confirm_preview` → `update_dashboard` (or `add_dashboard_tile` with a full next-tiles preview each time).

Avoid N single-tile round-trips when you already know the layout.

Layout, optional markdown, optional filters → `lightdash://playbooks/content-developer/dashboard-design`.

## Improve / refactor / duplicate dashboard

1. `get_dashboard` for structure (layout may be incomplete — rebuild intentionally).
2. `compare_dashboard_versions` when reconciling drift.
3. New charts mid-improve still follow shell-exists → `dashboardSlug` → tiles.
4. Duplicate dashboard: preview `{ newName? }` → confirm source UUID → `duplicate_dashboard`; relocate with content-move if needed.

## Done criteria

- Dashboard shell existed **before** new charts were created.
- Every new chart has `dashboardSlug` set to that dashboard (not space-only orphans).
- Every new/updated chart is referenced by a dashboard tile.
- Report dashboard UUID/slug, tiles, and chart UUIDs/slugs; note execution was unavailable on this persona.
- Do not promote from here — content-governance when ready.
- Layout / optional markdown / optional filters quality → `lightdash://playbooks/content-developer/dashboard-design`.
