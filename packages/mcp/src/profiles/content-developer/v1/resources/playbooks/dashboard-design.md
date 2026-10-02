# Content-developer — dashboard design

URI: `lightdash://playbooks/content-developer/dashboard-design`

Composition and quality for usable boards. **Apply writes** (preview → confirm → nested `dashboard:{}` / chart slug) via `lightdash://playbooks/content-developer/dashboards`. Viz shapes via `lightdash://playbooks/content-developer/chart-types`.

Official product order: [Creating dashboards](https://docs.lightdash.com/get-started/exploring-data/dashboards) — shell → charts → markdown (optional) → save → filters (optional) → tabs (only if needed).

The **Phase Design** gate below is agent planning (chat). After the user approves, mutate in that official product order via MCP tools.

## Phase Design (before any write)

If the user goal lacks audience, decisions, or insight questions, ask **2–4 clarifying questions** first — then discover and emit the Spec.

Read-only discovery is allowed (`get_project`, `list_spaces`, `get_space`, `search_content`, `get_dashboard`, `get_chart` / `get_chart_as_code` for seed picking).
Do **not** call `preview_*`, `confirm_preview`, or any create/update/duplicate/tile/move tool until the user approves or amends this Design Spec.

Emit one Design Spec:

1. **Objective** (required before Space / Tiles) — settle what to understand:
   - **Audience** (who)
   - **Decisions** the board supports (why)
   - **Insight questions** — 3–7 numbered (`Q1`…`Qn`) (what to understand)
   - **Primary metrics / dimensions** (how; real fieldIds only after seed discovery, else `TBD pending seed`)
   - **Non-goals** (what this board is _not_)
2. **Space** — existing `spaceUuid` / `spaceSlug` (never create a space)
3. **Tiles** — ordered list: reuse chart UUID **or** new chart (name, viz type from chart-types map, seed chart, **`tableName` (explore)**, proposed slug). **Each tile cites an insight id** (e.g. `Q2`). Do **not** propose “all chart types” unless the user explicitly asked.
4. **Layout sketch** — 36-col grid rows (KPI → trends → breakdowns → table); markdown yes/no
5. **Filters** — 0–3 shared dimensions; prefer empty `values: []`; `required: true` only if user asked. For each filter: list which tiles it **applies** to vs **excludes**. Prefer **one explore** for the whole filtered board. If a tile’s `tableName` ≠ filter `target.tableName` (and no known equivalent field), mark **exclude**.
6. **Tabs** — default none (only themes / audiences / 30+ tiles per Lightdash docs)
7. **Budget** — chart count vs core cap (default ≤8 unless user expands)

Then stop and ask: proceed / amend?

Approval phrases: proceed, approved, go ahead, looks good, or an explicit amended plan.

**Explicit multi-viz / all-types asks:** When the user already named the full viz checklist + analysis goal + `projectUuid`, a one-line Objective restatement + tile→insight map **is** the Spec. Treat that ask as approval after you restate once (do not re-ask clarifying questions that restate their checklist). Split the board into a **decision-oriented** section — one best visualization per insight — plus a clearly titled **visualization-validation appendix** for required-but-redundant chart forms; the appendix relaxes the cull rule only, never field validity or semantic-fit (see chart-types **semantic fit gate**). Still skip **map** — and report it unsupported — unless the explore has latitude+longitude, ISO 3166-1 alpha-3 / US state codes, or a compatible custom-GeoJSON join field; never fabricate geography (or any field) to complete the checklist.

### Improve / professionalize Spec delta

Use this instead of inventing a full new-board Spec when the user asks to **professionalize**, **clean up**, or **redesign** an existing dashboard — or when the board looks like a viz showcase (`[loop*]`, “all chart types”, many redundant status/revenue charts).

1. Clarify Objective if still vague (2–4 questions).
2. Emit a **Spec delta**, then stop for proceed / amend:
   - **Objective** (+ 3–7 insight ids `Q1`…`Qn`)
   - **Keep / drop / rename** table — each **keep** cites an insight id; **drop** lists charts leaving the board; **rename** strips demo prefixes
   - **Layout sketch** (36-col; KPI → trends → breakdowns → table)
   - **Filters** — usually keep existing empty-value filters; do not invent `required: true`. Re-check explore↔filter: exclude (or remount) tiles whose `tableName` cannot use each filter’s `target`
3. **Cull rule:** one primary viz per insight. Drop duplicates (e.g. area if line answers the same Q; pie/funnel/treemap if bar already covers status mix) unless the user explicitly asked for multi-viz.
4. Markdown overview should **restate the approved Objective** ([docs](https://docs.lightdash.com/get-started/exploring-data/dashboards#add-markdown-or-other-content)).
5. After apply: list chart UUIDs still dashboard-owned (`dashboardSlug`) but **not** tiled. Soft-delete those leftovers via **content-governance** — not this profile ([dashboard-owned charts stay off search/spaces](https://docs.lightdash.com/get-started/exploring-data/dashboards#create-a-new-chart)).

## Layout

- One board, one **Objective**. Prefer **KPI / overview** → **trends** → **breakdowns** → **table**.
- Grid width max **36**. Half-width ≈ `w: 18`. Full-width table/markdown ≈ `w: 36`.
- `get_dashboard` tile summaries often **omit `x/y/w/h`** — always compose the full layout intentionally; do not assume round-trip of positions.
- Prefer dashboard-owned charts (`dashboardSlug`) for one-off tiles ([docs](https://docs.lightdash.com/get-started/exploring-data/dashboards#create-a-new-chart)).
- Reuse existing charts as tiles when they already fit.
- Suggested skeleton after markdown (`y:0`, `h:3`, `w:36`): KPIs at `y:3`, then rows of two half-width charts (`h:8–9`), table last full-width.

## Markdown (optional)

Use for purpose, definitions, or caveats — not decorative HTML. Prefer an overview tile that **restates the approved Objective** (audience, decisions, insight questions) so viewers understand the board ([docs](https://docs.lightdash.com/get-started/exploring-data/dashboards#add-markdown-or-other-content)).

```yaml
type: markdown
x: 0
y: 0
w: 36
h: 3
properties:
  title: Overview
  content: |
    Short markdown restating the Objective. Prefer plain text over HTML/CSS.
```

Skip fancy HTML/iframe unless the user asks. Loom / heading tiles: only if requested.

## Filters (optional)

0–3 shared **dimensions**. Prefer **one explore** for all tiles that share dashboard filters. Filters guide: [Using filters](https://docs.lightdash.com/guides/limiting-data-using-filters). Operator catalog (date windows, `is not` + NULL, etc.): [Filters reference](https://docs.lightdash.com/guides/filters). Official as-code targeting: [dashboard-reference `tileTargets`](https://github.com/lightdash/lightdash/blob/main/skills/developing-in-lightdash/resources/dashboard-reference.md).

- Prefer **empty-value** saved filters so viewers choose ([saved filters](https://docs.lightdash.com/guides/limiting-data-using-filters#adding-saved-filters-to-your-dashboard)).
- Prefer **clone** `filters` from `get_dashboard` on a working board over inventing rules.
- Do **not** set `required: true` unless the user asks (locks load until a value is set; cannot combine with a default).
- Auto-apply needs matching `fieldId` + `tableName` on the tile’s explore. Omitting `tileTargets` is fine when **every** tile shares that table.
- Multi-explore: **exclude** foreign tiles (do not leave ambiguous). Advanced: remap equivalent fields via `tileTargets` — only when the user needs the filter on both explores.
- Shape: `filters: { dimensions: [], metrics: [], tableCalculations: [] }` (OpenAPI `DashboardFilters`).

**Same-explore boards** — empty-value example (omit `tileTargets`):

```yaml
filters:
  dimensions:
    - id: filter-orders-status
      label: Order status
      operator: equals
      values: []
      disabled: false
      required: false
      target:
        fieldId: orders_status
        tableName: orders
    - id: filter-orders-month
      label: Order month
      operator: equals
      values: []
      disabled: false
      required: false
      target:
        fieldId: orders_order_date_month
        tableName: orders
  metrics: []
  tableCalculations: []
```

**Exclude a foreign explore tile** (MCP / native API — keys are **tile UUIDs**; as-code YAML uses tile slugs instead):

```yaml
# After tiles exist: get_dashboard → copy each tile's uuid for exclusions
filters:
  dimensions:
    - id: filter-orders-status
      label: Order status
      operator: equals
      values: []
      disabled: false
      required: false
      target:
        fieldId: orders_status
        tableName: orders
      tileTargets:
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee': false # customers-explore LTV tile uuid
  metrics: []
  tableCalculations: []
```

**Apply order:** compose tiles first → if excluding, `get_dashboard` for tile UUIDs → then `preview_dashboard_changes` → `confirm_preview` → `update_dashboard({ dashboard: { filters, tiles?, name?, … } })` (second update is fine when UUIDs were not known on first tile write).

## Date zoom (optional)

When the Objective needs viewers to change time granularity without editing charts ([date zoom](https://docs.lightdash.com/guides/date-zoom)):

1. Plan in the Design Spec (Default zoom + any named controls; which tiles attach).
2. **Clone** dashboard `config` (`dateZoomConfig`, `defaultDateZoomGranularity`, `dateZoomGranularities`, `isDateZoomDisabled`) from a working board via `get_dashboard` — do not invent tile↔field bindings.
3. Attach only charts that have a zoomable date/timestamp dimension in results; a chart with no date field cannot join a control.
4. Optional labels: `${table_field.granularity}` in axis / big-value labels when cloning charts that already use it.
5. Viewer zoom is temporary in the UI; saved defaults live on the dashboard `config` you upsert.

## Tabs

Default: **no tabs**. Use only for themes / audiences / 30+ tiles ([docs tip](https://docs.lightdash.com/get-started/exploring-data/dashboards#add-tabs)).

## Done criteria

- Objective was settled (and Design Spec approved) before writes.
- Every tile maps to an insight question from the Spec.
- Charts are tiled (ownership alone is not enough).
- Filters honor explore↔filter plan (single-explore auto-apply, or `tileTargets` exclude/remap for foreign tiles).
- After a cull / professionalize: report untiled dashboard-owned leftovers; hand soft-delete to content-governance.
- Markdown / filters only if intentional — summarize them in the report.
- this profile cannot `run_chart`; note UI render was not verified here.
