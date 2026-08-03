# Content-developer Playbook Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise the live content-developer persona until its prompts and playbooks reliably guide creation of one professional jaffle_shop multi-chart dashboard and two consecutive passes reveal no new instruction defect.

**Architecture:** Keep one persistent dashboard in the existing `experiments` space and iterate in place. Each pass separates live MCP evidence, postmortem classification, instruction/test changes, repository verification, and container restart so data or API limitations are not mistaken for prompt defects.

**Tech Stack:** TypeScript, Vitest, Markdown MCP playbooks, `@modelcontextprotocol/server@2.0.0`, pnpm, Docker Compose, Lightdash content-developer MCP tools.

## Global Constraints

- Project UUID is `3dda11cb-aac8-42f7-82f1-26fa6b1afa80`.
- Existing target space UUID is `267e1102-5466-4be2-96a1-5dddc9846561`; slug is `experiments`.
- Reuse one dashboard titled `Jaffle Shop Deep Dive — Visualization Lab`.
- Create bar, horizontal bar, line, area, mixed, scatter, pie, funnel, treemap, Sankey, table, big value, and gauge charts.
- Do not fabricate geography; report map as unsupported because no geographic field or rendering seed exists.
- Use at most two concurrent preview-confirm-apply chains.
- Do not invent field IDs, create spaces, execute charts, or claim browser-render correctness.
- Preserve all unrelated working-tree changes.
- Do not create a git commit unless the user explicitly requests one.

---

### Task 1: Capture the baseline live authoring evidence

**Files:**

- Read: `packages/mcp/src/personas/content-developer/v1/prompts.ts`
- Read: `packages/mcp/src/personas/content-developer/v1/resources/playbooks/*.md`
- No repository mutation

**Interfaces:**

- Consumes: content-developer MCP tools and project/space identifiers from Global Constraints
- Produces: a factual issue list classified as prompt/playbook, tool/API, data/model, infrastructure, or operator

- [ ] **Step 1: Resolve the current live state**

Call `lightdash_get_project`, `lightdash_list_spaces`, and `lightdash_get_space`. Search for the exact dashboard title before creating anything. If it exists, inspect it with `lightdash_get_dashboard`; otherwise record that the first pass needs a shell.

- [ ] **Step 2: Inventory verified seeds**

Inspect all seven charts in `experiments` with `lightdash_get_chart_as_code`. Record only field IDs present in `metricQuery`, `chartConfig`, `tableConfig`, `additionalMetrics`, or copied `customDimensions`.

Expected verified field set includes:

```text
orders_order_date_day
orders_order_date_month
orders_order_id
orders_customer_id
orders_num_unique_order_ids
orders_sum_order_amount
use_coupon
test_virtual_view_orders_amount
amount_custom_amount
test_virtual_view_orders_status_custom_count_distinct_of_status
```

- [ ] **Step 3: Exercise all relevant read and preview paths**

Use dashboard/chart reads, version comparisons where versions exist, and preview tools for the proposed shell/charts without confirming or applying yet. Record schema confusion, invalid guidance, misleading diffs, and missing prerequisites exactly as returned.

- [ ] **Step 4: Run the postmortem classification**

For each observation, write one entry in this structure in the working notes:

```text
Outcome:
Fact:
Root cause:
Class: prompt/playbook | tool/API | data/model | infrastructure | operator
Action: one concrete change | no change
```

Expected initial prompt/playbook findings from current docs:

- The chart-type map does not explain how to keep an explicit all-types board decision-oriented instead of becoming a redundant gallery.
- Map guidance mentions latitude/longitude but omits valid ISO3-country and US-state choropleth inputs.
- Suitability rules are incomplete for scatter correlation, funnel stages, Sankey flows, area totals-and-parts, pie meaningful-whole, and bounded gauge targets.

### Task 2: Add failing prompt/playbook contract tests

**Files:**

- Modify: `packages/mcp/src/personas/content-developer/v1/prompts.test.ts`

**Interfaces:**

- Consumes: `getAllPlaybookMarkdown()` and `CONTENT_DEVELOPER_HARD_BANS`
- Produces: Vitest assertions that lock the live-derived instruction fixes

- [ ] **Step 1: Add the failing semantic-suitability test**

Add:

```ts
it('keeps all-types dashboards decision-oriented and enforces chart semantics', () => {
  const md = getAllPlaybookMarkdown().toLowerCase();
  expect(md).toMatch(/decision-oriented|decision section/);
  expect(md).toMatch(/validation appendix|visualization-validation/);
  expect(md).toMatch(/scatter.*two numeric|two numeric.*scatter/);
  expect(md).toMatch(/funnel.*discrete stages|discrete stages.*funnel/);
  expect(md).toMatch(/sankey.*source.*target.*flow/);
  expect(md).toMatch(/pie.*meaningful whole|meaningful whole.*pie/);
  expect(md).toMatch(/area.*total.*parts|total.*parts.*area/);
  expect(md).toMatch(/gauge.*target|target.*gauge/);
});
```

- [ ] **Step 2: Add the failing geographic-input test**

Add:

```ts
it('documents every supported native map input without permitting fabricated geography', () => {
  const md = getAllPlaybookMarkdown().toLowerCase();
  expect(md).toMatch(/iso 3166-1|iso3/);
  expect(md).toMatch(/us state|state code/);
  expect(md).toMatch(/latitude.*longitude|longitude.*latitude/);
  expect(md).toMatch(/do not fabricate|never fabricate/);
});
```

- [ ] **Step 3: Run the targeted test and verify failure**

Run:

```bash
pnpm exec vitest run packages/mcp/src/personas/content-developer/v1/prompts.test.ts
```

Expected: FAIL on the new wording contracts while all existing tests remain green.

### Task 3: Revise prompts and playbooks from the first postmortem

**Files:**

- Modify: `packages/mcp/src/personas/content-developer/v1/resources/playbooks/chart-types.md`
- Modify: `packages/mcp/src/personas/content-developer/v1/resources/playbooks/dashboards.md`
- Modify: `packages/mcp/src/personas/content-developer/v1/resources/playbooks/dashboard-design.md`
- Modify only if live evidence requires goal-specific reinforcement: `packages/mcp/src/personas/content-developer/v1/prompts.ts`

**Interfaces:**

- Consumes: failing contracts from Task 2
- Produces: reusable chart semantics in `chart-types.md` and all-types composition procedure in dashboard playbooks

- [ ] **Step 1: Add chart-selection semantics**

In `chart-types.md`, add a compact “semantic fit gate” containing these exact rules:

```markdown
- Scatter: two numeric variables at one shared grain; a categorical x-axis is not a correlation plot.
- Funnel: ordered, discrete stages with a numeric count; categories such as coupon yes/no are not a funnel.
- Sankey: a real source → target flow plus a weight metric; unrelated dimensions do not become a flow merely because the schema accepts them.
- Pie: categories must form a meaningful whole; otherwise use a bar.
- Area: use when the total and its component parts over time both matter; a single series normally belongs in a line chart.
- Gauge: require a defensible bound or target; do not invent `max` from aesthetics.
- Map: require latitude+longitude, ISO 3166-1 alpha-3 country codes, US state codes, or an existing compatible custom-GeoJSON join field. Never fabricate geography to satisfy an all-types checklist.
```

- [ ] **Step 2: Add the all-types composition rule**

In `dashboards.md` and `dashboard-design.md`, require:

```markdown
For an explicit all-types request, split one dashboard into:

1. a decision-oriented section where each primary insight has one best visualization; and
2. a clearly titled visualization-validation appendix for required but redundant chart forms.

The checklist relaxes the normal cull rule only in the appendix. It never relaxes field validity or semantic-fit requirements. Report an unsupported type instead of manufacturing meaningless data.
```

- [ ] **Step 3: Keep prompts thin**

If the live prompt did not carry the new rule into the generated `create_dashboard` message, add one sentence after the Design Spec stop:

```ts
'For explicit all-types work, keep primary insights decision-oriented and place redundant required forms in a labeled validation appendix; never weaken semantic field requirements.';
```

Do not duplicate the semantic-fit bullets in `prompts.ts`.

- [ ] **Step 4: Run the targeted test**

Run:

```bash
pnpm exec vitest run packages/mcp/src/personas/content-developer/v1/prompts.test.ts
```

Expected: PASS.

### Task 4: Build the persistent dashboard with the revised guidance

**Files:**

- No repository files
- External artifact: Lightdash dashboard in `experiments`

**Interfaces:**

- Consumes: revised prompt/playbook resources and verified seed field IDs
- Produces: one dashboard UUID/slug and 13 dashboard-owned chart UUIDs/slugs

- [ ] **Step 1: Create or reuse the shell**

If absent, preview dashboard changes with:

```json
{
  "name": "Jaffle Shop Deep Dive — Visualization Lab",
  "description": "Decision-oriented analysis of order volume, revenue, customer concentration, and coupon behavior, followed by a visualization-validation appendix.",
  "spaceUuid": "267e1102-5466-4be2-96a1-5dddc9846561",
  "tabs": [],
  "tiles": []
}
```

Confirm `resourceKind: dashboard`, `resourceKey: new`, then create with the exact nested `dashboard` body. Record returned UUID and slug.

- [ ] **Step 2: Author the 13 chart variants**

Use these semantic assignments, changing them only when a verified field prerequisite is absent:

```text
bar: monthly order volume
horizontal bar: revenue by customer
line: daily order volume
area: monthly order volume, labeled as validation when single-series
mixed: monthly order volume plus revenue
scatter: customer order count versus customer revenue
pie: coupon share of orders
funnel: verified ordered order stages only
treemap: customer share of revenue
sankey: verified source-to-target order flow only
table: customer orders and revenue detail
big value: total unique orders
gauge: metric with a verified business target only
```

For funnel, Sankey, or gauge, stop that chart and classify a data/model gap if no legitimate verified fields/target exist. Do not substitute coupon booleans as stages, unrelated dimensions as flows, or an invented gauge maximum.

For every supported chart:

1. Clone the closest rendering seed.
2. Keep valid `metricQuery`, `tableConfig`, and cartesian `encode`.
3. Set `dashboardSlug`, `spaceSlug: experiments`, and `skipSpaceCreate: true`.
4. Preview with top-level slug.
5. Confirm with `projectUuid`.
6. Apply with the returned validated token.
7. Capture `charts[0].data.uuid`.

- [ ] **Step 3: Tile in one full update**

Compose a 36-column board:

```text
y=0:  markdown objective, w=36
y=3:  KPI/gauge row
y=9+: decision charts in two columns, w=18 each
final rows: visualization-validation appendix, w=18 each
last row: detail table, w=36
```

Preview, confirm, and apply one nested dashboard update with the full `tiles`, `tabs`, and `filters` arrays. If `diff.removed` contains any of those three keys, re-preview before applying.

- [ ] **Step 4: Validate and compare**

Run `validate_chart` for every created chart, `validate_dashboard` once, then `get_dashboard` and `compare_dashboard_versions`. Verify every created UUID is tiled and no chart was unintentionally space-owned.

### Task 5: Repeat postmortem-driven revisions

**Files:**

- Modify as evidence requires: `packages/mcp/src/personas/content-developer/v1/prompts.test.ts`
- Modify as evidence requires: `packages/mcp/src/personas/content-developer/v1/prompts.ts`
- Modify as evidence requires: `packages/mcp/src/personas/content-developer/v1/resources/playbooks/*.md`
- Modify for stable non-obvious lessons: `AGENTS.md` and/or `CLAUDE.md`

**Interfaces:**

- Consumes: live failures from Task 4
- Produces: one failing regression test and one minimal guidance fix per actionable prompt/playbook defect

- [ ] **Step 1: Classify every live issue before editing**

Use the Task 1 postmortem structure. Do not edit prompts for tool/API errors, absent model fields, 502s, or operator payload mistakes already covered by correct guidance.

- [ ] **Step 2: Add one failing contract per stable instruction defect**

Assert the precise invariant in `prompts.test.ts`. Run the single test file and require the new assertion to fail for the expected missing guidance.

- [ ] **Step 3: Make the smallest reusable fix**

Put reusable procedure in the relevant playbook. Change `prompts.ts` only when a goal/input-specific instruction or topic embedding is missing.

- [ ] **Step 4: Re-run targeted tests**

Run:

```bash
pnpm exec vitest run packages/mcp/src/personas/content-developer/v1/prompts.test.ts
```

Expected: PASS after each revision.

### Task 6: Run repository quality gates

**Files:**

- Verify all modified TypeScript, Markdown, YAML, and documentation files

**Interfaces:**

- Consumes: completed prompt/playbook changes
- Produces: build, test, lint, and unused-code evidence

- [ ] **Step 1: Run MCP build and targeted package tests**

```bash
pnpm --filter @lightdash-tools/mcp build
pnpm --filter @lightdash-tools/mcp test
```

Expected: both PASS.

- [ ] **Step 2: Run TypeScript hygiene checks**

```bash
pnpm lint:eslint
pnpm knip
```

Expected: both PASS.

- [ ] **Step 3: Run full tests and build**

```bash
pnpm test
pnpm build
```

Expected: coverage thresholds and all workspace builds PASS.

- [ ] **Step 4: Run Markdown/repository lint and pre-PR verification**

```bash
pnpm lint
pnpm verify:pr
```

Expected: PASS. If Trunk cannot run because of infrastructure, run the documented local fallbacks and report the limitation without claiming full parity.

### Task 7: Rebuild, restart, and run clean passes

**Files:**

- Runtime only: `docker-compose.dev.yml`

**Interfaces:**

- Consumes: verified repository state
- Produces: restarted `mcp` container serving revised content-developer prompts/playbooks

- [ ] **Step 1: Check for an existing Compose process**

Inspect current terminals and:

```bash
docker compose -f docker-compose.dev.yml --profile semantic-layer ps
```

Do not start a duplicate stack.

- [ ] **Step 2: Rebuild and recreate the MCP service**

```bash
docker compose -f docker-compose.dev.yml --profile semantic-layer up -d --build --force-recreate mcp
```

Expected: image builds and service reaches running state on ports 3100/8080.

- [ ] **Step 3: Confirm startup**

```bash
docker compose -f docker-compose.dev.yml --profile semantic-layer ps
docker compose -f docker-compose.dev.yml --profile semantic-layer logs mcp
```

Expected: no startup exception and HTTP server listening on port 8080.

- [ ] **Step 4: Run a clean live pass**

Read the revised prompt/playbook resources through MCP, inspect the persistent dashboard, preview one representative chart update and one full dashboard update, validate all assets, and run the postmortem. Do not apply a no-op write solely for testing.

- [ ] **Step 5: Repeat until two consecutive clean passes**

A pass is clean only when it yields no new actionable prompt/playbook defect. Reset the clean-pass count after any guidance revision, rebuild/restart again, and continue. Stop at two consecutive clean passes and report:

```text
dashboard UUID and slug
13 requested chart outcomes
map capability gap
validation results
postmortem fixes
quality-gate results
container status
remaining tool/data limitations
```
