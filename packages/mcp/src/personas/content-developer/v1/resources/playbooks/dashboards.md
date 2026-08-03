# Content-developer — dashboards (and dashboard-owned charts)

URI: `lightdash://playbooks/content-developer/dashboards`

**Order matters:** clarify **Objective** if needed, emit a **Design Spec** and get user approval first, then create the **dashboard shell**, then create charts with `dashboardSlug` set to that dashboard, then attach tiles (+ filters with explore↔filter / `tileTargets` via dashboard-design). Official Lightdash as-code: `dashboardSlug` scopes a chart to a dashboard (it will not appear as an independent space chart). Promote via **content-governance**.

```text
get_project → list_spaces → discover seeds (read-only)
  → clarify Objective if goal is vague
  → Design Spec (Objective + tiles with tableName citing insights + filter apply/exclude) → user approve  ← STOP: no writes yet
  → create_dashboard (empty / markdown shell)  ← record dashboard slug
  → reuse tiles OR get_chart_as_code → create_chart (dashboardSlug set)
  → update_dashboard (full tile array)
  → optional: get_dashboard for tile UUIDs → update_dashboard (filters + tileTargets excludes)
```

## Discover

1. `list_spaces` → existing `spaceUuid` (dashboards) / `spaceSlug` (chart as-code).
2. `search_content` with **short** tokens (`orders`, space slug). Multi-word brand phrases often return empty — use `get_space`. Short tokens can also return noisy org-wide hits — prefer `get_space` inventory for seeds.
3. Prefer **reuse** of existing charts as tiles when they already fit.
4. For new charts: find a **working seed** on the same `tableName`; never invent fieldIds.
5. Dashboard-owned charts (`dashboardSlug` set) **do not** appear as independent space charts in `get_space` / typical search — keep the UUIDs you create, or re-open the dashboard.

## Create dashboard shell (step 1 — after Design Spec approval)

Only after Phase Design approval (see `lightdash://playbooks/content-developer/dashboard-design`). Then:

1. Resolve target **existing** `spaceUuid`.
2. `preview_dashboard_changes` without `dashboardUuidOrSlug`, `changes: { name, description?, spaceUuid, tabs: [], tiles: [] }` → `resourceKey` is literal **`new`**.
3. `confirm_preview` (`resourceKind: 'dashboard'`, `resourceKey: 'new'`, **`projectUuid`**).
4. `create_dashboard` with **`dashboard: { … }`** — same fields as `changes` (nested object; not flat tool args). Empty or markdown-only `tiles`. **Pass `projectUuid`.**
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
3. `preview_chart_changes` with top-level **`slug`** + `changes` body → `confirm_preview` (`resourceKey` = that slug, **`projectUuid`**) → `create_chart` / `update_chart` (`slug` + `chart: { … }` matching `changes`, **`projectUuid`**).
4. Capture `charts[0].data.uuid` immediately for tiling.

If fieldIds are unknown → stop; use semantic-layer. Do **not** hand-author minimal cartesian configs (series without `encode.xRef`/`yRef`).

`dashboardSlug` alone does **not** place the chart on the board — step 3 (tiles) is mandatory.

### Multi-viz / “all chart types” boards

Only when the user **explicitly** asks for every chart type (or a large multi-viz board)—not the default:

1. Raise the new-chart budget (default ≤8 is too low).
2. Split the board into a **decision-oriented** primary section — one best visualization per insight — plus a clearly titled **visualization-validation appendix** for required-but-redundant chart forms. The checklist relaxes the normal cull rule only in the appendix; it never relaxes field validity or semantic-fit requirements (`chart-types` **semantic fit gate**). Report an unsupported type instead of manufacturing meaningless data.
3. Cover: bar, horizontal bar, line, area, mixed, scatter, pie, funnel, treemap, sankey, table, big_number, gauge — each checked against the semantic fit gate; **skip map** and report it unsupported unless the explore has latitude+longitude, ISO 3166-1 alpha-3 / US state codes, or a compatible custom-GeoJSON join field. Never fabricate geography (or any other field) to force a type onto the checklist.
4. One-line Objective is enough when the user already listed the viz checklist + analysis goal; still map each tile to an insight id (or label demo tiles clearly). Treat that explicit ask as Design Spec approval after you restate the checklist once.
5. **Batch SOP:** create shell → create all charts (`dashboardSlug` set; **≤2** concurrent preview→confirm→apply chains) → after **each** successful `create_chart`, append `slug` + `charts[0].data.uuid` to a **running inventory** in the reply (mid-build progress without tiling) → **one** `update_dashboard` with full tiles + optional empty-value filters. Do not interleave tiling with chart creates. Preview failure codes (hash vs expiry) → `lightdash://playbooks/content-developer/core`. Optional `validate_chart` only on risky charts (scatter grain, SQL custom dims) — not unlock.
6. Cap concurrent writes at **≤2** on hosted tunnels — parallel bursts often return HTTP 502.

### Duplicate chart

1. Preview with `chartUuidOrSlug` = source and `changes` = `{ sourceChartUuidOrSlug, newSlug, newName? }`.
2. Confirm `resourceKind: 'chart'`, `resourceKey` = **source** UUID (**always pass `projectUuid`**).
3. `duplicate_chart`, then `update_chart` if needed to set `dashboardSlug` and any metricQuery edits (clone body via `get_chart_as_code` first).
4. Tile the result onto the dashboard.

## Attach tiles (step 3)

1. Compose the **full** tile array (markdown + `saved_chart` with `x/y/w/h`; grid width max **36**).
2. Require `properties.savedChartUuid` from the chart create/duplicate result (OpenAPI `CreateDashboardChartTile`). Optional `chartSlug` is metadata only — do not tile with slug alone.
3. `preview_dashboard_changes` → `confirm_preview` (`resourceKey` = dashboard **UUID**, plus **`projectUuid`**) → `update_dashboard` with nested `dashboard: { name?, tiles, tabs, filters? }` matching preview `changes`.

Avoid N single-tile round-trips when you already know the layout. Mid-build progress = running UUID inventory (+ optional validate), not an `update_dashboard` after every chart — unless the user explicitly asks to see tiles appear early (then still send full `tiles`/`tabs`/`filters`, never description-only). If preview `diff.removed` includes **`tiles`/`tabs`/`filters`**, re-preview with those arrays included — do not treat that as harmless noise (see core).

Layout, optional markdown, optional filters → `lightdash://playbooks/content-developer/dashboard-design`.

## Lab / inline build

For lab spaces (e.g. `experiments`) and other non-production content boards: after Design Spec approval, run the **Batch SOP in the same session** (shell → charts → one `update_dashboard`). Do **not** use subagent-driven-development or multi-task writing-plans solely to click MCP `preview_*` / `confirm_preview` / apply for those boards — that ceremony adds latency without changing the required write loop. Still require Spec stop, `projectUuid`, identical proposed payload, and ≤2 concurrent chains.

## Improve / refactor / duplicate dashboard

1. `get_dashboard` for structure (layout may be incomplete — rebuild intentionally).
2. For **material** layout / tile / filter changes (including professionalize / clean up / redesign): emit a Design Spec **delta** per `lightdash://playbooks/content-developer/dashboard-design` (**Improve / professionalize Spec delta** — keep / drop / rename + cull) and await user approval before any `preview_*` / write. Trivial one-shot renames the user already specified may skip the stop.
3. **Naming when professionalizing:** update tile `properties.title` **and** chart `name` via `update_chart` (strip demo prefixes like `[loop3]`); keep slug unless the user asks to rename.
4. `compare_dashboard_versions` when reconciling drift.
5. New charts mid-improve still follow shell-exists → `dashboardSlug` → tiles.
6. Duplicate dashboard: preview `{ newName? }` → confirm source UUID → `duplicate_dashboard`; relocate with content-move if needed.

## Done criteria

- Objective clarified when needed; Design Spec approved (or amended) before writes for new boards / material redesigns.
- Dashboard shell existed **before** new charts were created.
- Every new chart has `dashboardSlug` set to that dashboard (not space-only orphans).
- Every new/updated chart is referenced by a dashboard tile that maps to an insight question.
- Filter↔explore plan from Spec honored (single-explore auto-apply, or foreign tiles excluded / remapped via `tileTargets`).
- After cull / professionalize: report untiled dashboard-owned chart UUIDs; soft-delete via **content-governance** (not this persona).
- Report dashboard UUID/slug, tiles, and chart UUIDs/slugs; note execution was unavailable on this persona.
- Do not promote from here — content-governance when ready.
- Layout / optional markdown / optional filters quality → `lightdash://playbooks/content-developer/dashboard-design`.
