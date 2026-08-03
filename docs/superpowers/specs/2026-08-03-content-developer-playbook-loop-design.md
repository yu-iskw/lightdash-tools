# Content-developer playbook revision loop

## Goal

Improve the `content-developer` prompts and playbooks through repeated live use against Lightdash project `3dda11cb-aac8-42f7-82f1-26fa6b1afa80` (`jaffle-shop`). Each iteration must produce evidence from the persona's real MCP surface, a factual postmortem, targeted documentation/test changes, and a rebuilt MCP container.

## Live artifact

Create one persistent dashboard in the existing `experiments` space:

- Space UUID: `267e1102-5466-4be2-96a1-5dddc9846561`
- Working title: `Jaffle Shop Deep Dive — Visualization Lab`
- Audience: analytics and operations users
- Decisions: monitor order and revenue trends, identify customer concentration, assess coupon adoption, and understand behavioral segments
- Secondary purpose: validate content-developer authoring guidance across the supported native visualization surface

The dashboard is revised in place across iterations. Creating a fresh dashboard per pass is rejected because this persona cannot delete the resulting dashboard-owned charts.

## Insight and visualization plan

Use verified `orders` seed fields first:

- Time: `orders_order_date_day`, `orders_order_date_month`
- Entity: `orders_order_id`, `orders_customer_id`
- Metrics: `orders_num_unique_order_ids`, `orders_sum_order_amount`
- Derived seed dimension: `use_coupon` with its existing copied `customDimensions` definition

The dashboard has a decision-oriented main section and a clearly labeled visualization-validation section. Every chart still answers an explicit question:

1. How is order volume changing over time?
2. How is revenue changing with order volume?
3. Which customers account for the most revenue?
4. How concentrated is revenue across customers?
5. How does coupon adoption divide order volume?
6. How do coupon behavior, time, and customer segments relate?

Create and tile these 13 supported chart variants:

- Bar
- Horizontal bar
- Line
- Area
- Mixed
- Scatter
- Pie
- Funnel
- Treemap
- Sankey
- Table
- Big value
- Gauge

The map requirement is an explicit capability gap. The project has no geographic seed or verified latitude, longitude, country-code, or state-code field. The persona must not fabricate geography or author unsupported model SQL. The dashboard report and postmortem will state this limitation instead of creating a misleading map.

## Iteration workflow

### 1. Discover

- Resolve the project and existing space.
- Inspect current dashboard state when it already exists.
- Inspect rendering seeds with `get_chart_as_code`.
- Use only verified field IDs and copy required custom dimensions.
- Consult current Lightdash chart-type documentation for visualization semantics.

### 2. Design and mutate

- Restate the dashboard objective and tile-to-insight mapping once.
- On the first pass, create the dashboard shell before any dashboard-owned charts.
- Use exact `preview_* → confirm_preview → apply` chains with `projectUuid` on every step.
- Limit concurrent write chains to two.
- Set `dashboardSlug` for every new chart.
- Capture `charts[0].data.uuid`, then attach all charts in an intentional 36-column layout.
- Prefer one full dashboard tile update over incremental tile churn.
- On later passes, update existing assets rather than creating replacements.

“Comprehensive tool exercise” means using all tools relevant to discovery, preview/confirm/apply, chart authoring, dashboard composition, validation, comparison, and safe tile maintenance. It does not require pointless duplication, moving unrelated content, or mutations performed only to increment a coverage count.

### 3. Verify

- Re-read the dashboard and authored charts.
- Run `validate_chart` and `validate_dashboard` where applicable.
- Compare versions after material updates.
- Verify that each created chart is tiled and dashboard-owned.
- Do not claim query-result or browser-render correctness: this persona cannot execute saved charts or dashboard tiles.

### 4. Postmortem

For every failure or surprise, record:

1. Outcome reached
2. Factual failure or surprise
3. Best-supported root cause
4. Classification:
   - prompt/playbook defect
   - tool/API defect
   - project data/model limitation
   - transient infrastructure issue
   - operator error
5. One concrete action or an explicit “no change”

Only prompt/playbook defects authorize edits in this task. Tool and data limitations are documented without disguising them as instruction problems.

### 5. Revise and test

Potential edit scope:

- `packages/mcp/src/personas/content-developer/v1/prompts.ts`
- `packages/mcp/src/personas/content-developer/v1/resources/playbooks/*.md`
- `packages/mcp/src/personas/content-developer/v1/prompts.test.ts`
- Stable repo-wide learnings in `AGENTS.md` and/or `CLAUDE.md`

Keep prompts goal-specific and put reusable procedures in playbooks. Add tests for every stable invariant introduced by a postmortem.

Run targeted prompt/playbook tests during iteration, then the repository's relevant test, lint, build, and verification gates before completion.

### 6. Rebuild and restart

After each revision:

- Rebuild the MCP package and container using the repository's existing Docker/Compose path.
- Restart the content-developer MCP service without duplicating an already-running stack.
- Confirm startup health and that the live server exposes the revised prompts/playbooks.
- Re-run the next live iteration against the same dashboard.

## Exit criteria

Stop the loop only when:

- All 13 data-supported chart variants exist and are tiled on the persistent dashboard.
- The map limitation is accurately reported.
- No chart is accidentally space-owned or left untiled.
- Prompt/playbook tests and relevant repository quality gates pass.
- The rebuilt container serves the revised persona resources.
- Two consecutive live passes reveal no new actionable prompt/playbook defect.

Transient failures do not count as a clean pass. A clean pass may still report known tool or data limitations when the guidance already handles them correctly.
