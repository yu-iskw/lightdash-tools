# Content-developer — dashboard design

URI: `lightdash://playbooks/content-developer/dashboard-design`

Composition and quality for usable boards. **Apply writes** (preview → confirm → nested `dashboard:{}` / chart slug) via `lightdash://playbooks/content-developer/dashboards`. Viz shapes via `lightdash://playbooks/content-developer/chart-types`.

Official product order: [Creating dashboards](https://docs.lightdash.com/get-started/exploring-data/dashboards) — shell → charts → markdown (optional) → save → filters (optional) → tabs (only if needed).

## Layout

- One board, one story. Prefer **KPI / overview** → **trends** → **breakdowns**.
- Grid width max **36**. Half-width ≈ `w: 18`. Avoid chart soup.
- Prefer dashboard-owned charts (`dashboardSlug`) for one-off tiles ([docs](https://docs.lightdash.com/get-started/exploring-data/dashboards#create-a-new-chart)).
- Reuse existing charts as tiles when they already fit.

## Markdown (optional)

Use for purpose, definitions, or caveats — not decorative HTML.

```yaml
type: markdown
x: 0
y: 0
w: 36
h: 3
properties:
  title: Overview
  content: |
    Short markdown. Prefer plain text over HTML/CSS.
```

Skip fancy HTML/iframe unless the user asks. Loom / heading tiles: only if requested.

## Filters (optional)

0–3 shared **dimensions** that exist on the tiled explores. Filters guide: [Using filters](https://docs.lightdash.com/guides/limiting-data-using-filters).

- Prefer **empty-value** saved filters so viewers choose ([saved filters](https://docs.lightdash.com/guides/limiting-data-using-filters#adding-saved-filters-to-your-dashboard)).
- Prefer **clone** `filters` from `get_dashboard` on a working board over inventing rules.
- Do **not** set `required: true` unless the user asks (locks load until a value is set; cannot combine with a default).
- Shape: `filters: { dimensions: [], metrics: [], tableCalculations: [] }` (OpenAPI `DashboardFilters`). Each rule needs `id`, `target`, `operator`, optional `values` / `label`.
- Apply with tiles when ready: `preview_dashboard_changes` → `confirm_preview` → `update_dashboard({ dashboard: { filters, tiles?, ... } })`.

## Tabs

Default: **no tabs**. Use only for themes / audiences / 30+ tiles ([docs tip](https://docs.lightdash.com/get-started/exploring-data/dashboards#add-tabs)).

## Done criteria

- Charts are tiled (ownership alone is not enough).
- Markdown / filters only if intentional — summarize them in the report.
- This persona cannot `run_chart`; note UI render was not verified here.
