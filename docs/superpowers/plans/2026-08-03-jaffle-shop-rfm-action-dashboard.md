# Jaffle Shop RFM Action Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Lightdash dashboard `Jaffle Shop — RFM Action Lists` (slug `jaffle-shop-rfm-action-lists`) in the experiments space per the approved design spec.

**Architecture:** content-developer MCP preview → confirm → apply loop. Soft shell-first: empty dashboard shell, then dashboard-owned charts (`dashboardSlug`), then one final `update_dashboard` for tiles + month filter. All charts use explore `orders`; F×M approximation only (no Recency).

**Tech Stack:** Lightdash Cloud (`ubie.lightdash.cloud`); MCP persona `content-developer` (`project-0-lightdash-tools-test-content-developer-mcp`); tools `preview_*` / `confirm_preview` / `create_*` / `update_dashboard` / `get_*` / `validate_*`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-jaffle-shop-rfm-action-dashboard-design.md`
- `projectUuid`: `3dda11cb-aac8-42f7-82f1-26fa6b1afa80`
- `spaceUuid`: `267e1102-5466-4be2-96a1-5dddc9846561` (`spaceSlug`: `experiments`)
- Always pass `projectUuid` on tool calls when HTTP pin is absent
- Preview payload immutability: reuse the **exact** `changes` / `dashboard` / `chart` body on apply after `confirm_preview`
- Create-chart: top-level `slug` **and** `chart.slug`; `skipSpaceCreate: true`; `dashboardSlug: jaffle-shop-rfm-action-lists`
- Create-dashboard `resourceKey` for confirm is literal `new`
- Concurrent chart create chains: ≤2 at a time
- Never invent fieldIds; clone from seeds via `get_chart_as_code`
- No `run_chart` — UI/row values remain unverified; note in final report
- **Do not git commit** unless the user explicitly asks (author preference)

## File / resource map

| Artifact                                    | Responsibility                                 |
| ------------------------------------------- | ---------------------------------------------- |
| Dashboard `jaffle-shop-rfm-action-lists`    | Shell, markdown Overview, layout, month filter |
| Chart `rfm-action-kpi-active-customers`     | Q1 distinct customers KPI                      |
| Chart `rfm-action-kpi-total-revenue`        | Q1 revenue KPI                                 |
| Chart `rfm-action-scatter-freq-vs-monetary` | Q2 F×M value map                               |
| Chart `rfm-action-bar-fm-bucket-mix`        | Q3 bucket mix **or** Monetary fallback bar     |
| Chart `rfm-action-table-customer-list`      | Q4 action list                                 |
| Spec §9 checkboxes                          | Done criteria recording after Task 7           |

Seed chart UUIDs (re-verify in Task 1):

| Seed                                      | UUID / slug                            |
| ----------------------------------------- | -------------------------------------- |
| # Orders / Day (additionalMetric pattern) | `98e1df8b-7cb7-45d5-a1ec-12eea819cf4e` |
| Total Unique Orders big_number            | `e564d802-ae2c-4192-ba5c-ac226b0631e3` |
| Sum of Order Amount / Customer            | `d65efc9e-4d5f-46b3-ae51-6854bd1142e2` |
| F×M scatter                               | `f1d0cf1f-20c8-499c-a956-e90ecba801ac` |
| Customer detail table                     | `04aaa0da-c3ad-4a3c-abcd-baafaf06bfd4` |
| Revenue by customer h-bar (fallback)      | `417a3183-a587-4479-aad2-e44bbbcc48bc` |
| Bin customDimension pattern               | `49f78c72-82fe-4580-b276-364a4556aaa2` |

---

### Task 1: Preflight seed + customers enrich check

**Files:**

- Read: seed charts via MCP; Spec discovery notes
- Produce: short working notes (agent transcript or `.superpowers/sdd/rfm-action-preflight.md` if writing to disk — optional)

**Interfaces:**

- Consumes: Global Constraints seed UUID table
- Produces: confirmed fieldIds; `customersEnrich: false | { fieldIds: string[] }`; `bucketStrategy: "bin" | "monetary-fallback"`

- [ ] **Step 1: Confirm space and no slug collision**

Call `lightdash_get_space` with `projectUuid`, `spaceUuid`, `includeContent: true`.
Call `lightdash_search_content` with `query: "rfm-action"` and `query: "jaffle-shop-rfm-action"`.

Expected: experiments space reachable; no existing dashboard/chart with slug `jaffle-shop-rfm-action-lists` or the five chart slugs.

- [ ] **Step 2: Re-fetch seed as-code**

For each seed UUID in the map, call `lightdash_get_chart_as_code` with `projectUuid` + `chartUuidOrSlug`.

Confirm these fieldIds still appear:

- `orders_customer_id`
- `orders_num_unique_order_ids`
- `orders_sum_order_amount`
- `orders_order_date_month`

Confirm `# Orders / Day` still has `additionalMetrics` with `type: "count_distinct"` and `baseDimensionName: "order_id"`.

- [ ] **Step 3: Customers enrich attempt**

Call `lightdash_search_content` with `query: "customers"` and `query: "customer"` (`contentTypes: ["chart"]`).

If no `tableName` / explore evidence for `customers` with joinable attributes, set `customersEnrich = false`.
If a chart uses `customers` fields, record exact fieldIds for optional Action list columns.

- [ ] **Step 4: Decide bucket strategy**

Inspect bin seed `49f78c72-…` `customDimensions` shape. Plan to try a bin on `orders_num_unique_order_ids` (or monetary) in Task 4; if preview/validate fails, lock `bucketStrategy = "monetary-fallback"` and use h-bar seed encode.

- [ ] **Step 5: Record preflight outcome**

Write one paragraph noting `customersEnrich` and `bucketStrategy`. Do **not** commit.

---

### Task 2: Create dashboard shell

**Files:**

- Create (remote): dashboard slug `jaffle-shop-rfm-action-lists`

**Interfaces:**

- Consumes: Task 1 preflight OK
- Produces: `dashboardUuid` (string); slug `jaffle-shop-rfm-action-lists`

- [ ] **Step 1: Preview empty shell**

Call `lightdash_preview_dashboard_changes` with:

```json
{
  "projectUuid": "3dda11cb-aac8-42f7-82f1-26fa6b1afa80",
  "changes": {
    "name": "Jaffle Shop — RFM Action Lists",
    "description": "Marketing action board: F×M approximation lists for jaffle_shop orders (Recency out of scope).",
    "spaceUuid": "267e1102-5466-4be2-96a1-5dddc9846561",
    "tiles": [],
    "tabs": [],
    "filters": { "dimensions": [], "metrics": [], "tableCalculations": [] }
  }
}
```

Expected: `previewToken` returned; `resourceKey` for create is `new`.

- [ ] **Step 2: Confirm preview**

```json
{
  "projectUuid": "3dda11cb-aac8-42f7-82f1-26fa6b1afa80",
  "previewToken": "<from step 1>",
  "resourceKind": "dashboard",
  "resourceKey": "new"
}
```

Expected: new validated `previewToken`.

- [ ] **Step 3: Apply create_dashboard**

Reuse the **exact** `dashboard` object from Step 1 `changes` (same keys/values) plus `previewToken` from Step 2:

```json
{
  "projectUuid": "3dda11cb-aac8-42f7-82f1-26fa6b1afa80",
  "previewToken": "<validated>",
  "dashboard": {
    "name": "Jaffle Shop — RFM Action Lists",
    "description": "Marketing action board: F×M approximation lists for jaffle_shop orders (Recency out of scope).",
    "spaceUuid": "267e1102-5466-4be2-96a1-5dddc9846561",
    "tiles": [],
    "tabs": [],
    "filters": { "dimensions": [], "metrics": [], "tableCalculations": [] }
  }
}
```

Expected: dashboard UUID returned. Save as `DASHBOARD_UUID`.

- [ ] **Step 4: Verify shell**

`lightdash_get_dashboard` with `dashboardUuidOrSlug: jaffle-shop-rfm-action-lists` (or UUID).
Expected: name matches; tiles empty or markdown-less shell OK.

---

### Task 3: Create KPI charts (≤2 concurrent)

**Files:**

- Create (remote): `rfm-action-kpi-active-customers`, `rfm-action-kpi-total-revenue`

**Interfaces:**

- Consumes: `dashboardSlug = jaffle-shop-rfm-action-lists`; additionalMetric pattern from seed
- Produces: `kpiActiveUuid`, `kpiRevenueUuid`

- [ ] **Step 1: Preview + confirm + create Active customers KPI**

`metricQuery` / `chartConfig` payload (clone big_number seed shape; swap metric):

```json
{
  "projectUuid": "3dda11cb-aac8-42f7-82f1-26fa6b1afa80",
  "slug": "rfm-action-kpi-active-customers",
  "changes": {
    "name": "Active Customers (F×M Action)",
    "description": "Q1: distinct customers in filtered order set.",
    "tableName": "orders",
    "slug": "rfm-action-kpi-active-customers",
    "spaceSlug": "experiments",
    "version": 1,
    "dashboardSlug": "jaffle-shop-rfm-action-lists",
    "skipSpaceCreate": true,
    "metricQuery": {
      "exploreName": "orders",
      "dimensions": [],
      "metrics": ["orders_customer_id_count_distinct_of_customer_id"],
      "filters": {},
      "sorts": [],
      "limit": 500,
      "tableCalculations": [],
      "additionalMetrics": [
        {
          "name": "customer_id_count_distinct_of_customer_id",
          "label": "Count distinct of Customer id",
          "description": "Count distinct of Customer id on the table orders",
          "sql": "${TABLE}.customer_id",
          "table": "orders",
          "type": "count_distinct",
          "baseDimensionName": "customer_id",
          "formatOptions": { "type": "default", "separator": "default" }
        }
      ],
      "customDimensions": [],
      "timezone": "project_timezone"
    },
    "chartConfig": {
      "type": "big_number",
      "config": {
        "flipColors": false,
        "selectedField": "orders_customer_id_count_distinct_of_customer_id",
        "showComparison": false,
        "comparisonFormat": "raw",
        "showBigNumberLabel": true
      }
    },
    "tableConfig": {
      "columnOrder": ["orders_customer_id_count_distinct_of_customer_id"]
    }
  }
}
```

Flow: `preview_chart_changes` → `confirm_preview` (`resourceKind: chart`, `resourceKey: rfm-action-kpi-active-customers`) → `create_chart` with identical `chart` body + top-level `slug`.

If preview/validate fails on metric id naming, adjust `name` / `selectedField` to match Lightdash’s returned additionalMetric fieldId from the preview diff — do not invent a second pattern.

- [ ] **Step 2: Preview + confirm + create Total revenue KPI**

```json
{
  "slug": "rfm-action-kpi-total-revenue",
  "changes": {
    "name": "Total Revenue (F×M Action)",
    "description": "Q1: sum of order amount.",
    "tableName": "orders",
    "slug": "rfm-action-kpi-total-revenue",
    "spaceSlug": "experiments",
    "version": 1,
    "dashboardSlug": "jaffle-shop-rfm-action-lists",
    "skipSpaceCreate": true,
    "metricQuery": {
      "exploreName": "orders",
      "dimensions": [],
      "metrics": ["orders_sum_order_amount"],
      "filters": {},
      "sorts": [],
      "limit": 500,
      "tableCalculations": [],
      "additionalMetrics": [],
      "customDimensions": [],
      "timezone": "project_timezone"
    },
    "chartConfig": {
      "type": "big_number",
      "config": {
        "flipColors": false,
        "selectedField": "orders_sum_order_amount",
        "showComparison": false,
        "comparisonFormat": "raw",
        "showBigNumberLabel": true
      }
    },
    "tableConfig": { "columnOrder": ["orders_sum_order_amount"] }
  }
}
```

Steps 1–2 may run as one concurrent pair (≤2 chains).

- [ ] **Step 3: Optional validate**

`lightdash_validate_chart` on each created UUID (health check only; does not unlock writes).

Expected: revenue clean; active customers clean or fix additionalMetric if errors.

---

### Task 4: Scatter + bucket mix (or Monetary fallback)

**Files:**

- Create (remote): `rfm-action-scatter-freq-vs-monetary`, `rfm-action-bar-fm-bucket-mix`

**Interfaces:**

- Consumes: Deep Dive scatter encode; Task 1 `bucketStrategy`
- Produces: `scatterUuid`, `bucketUuid`; final `bucketStrategy` used; Overview limitation flag if fallback

- [ ] **Step 1: Create F×M scatter (clone Deep Dive)**

From seed `f1d0cf1f-…`, keep:

- dimensions: `["orders_customer_id"]`
- metrics: `["orders_num_unique_order_ids", "orders_sum_order_amount"]`
- series type `scatter` with `encode.xRef` = F, `encode.yRef` = M

Set `slug` / `dashboardSlug` / names per spec. preview → confirm → create.

Do **not** drop `orders_customer_id` if `validate_chart` warns unused grain.

- [ ] **Step 2: Attempt bucket-mix bar**

Try customDimension bin on frequency (adapt bin seed shape to `orders` + `orders_num_unique_order_ids`), metric `orders_sum_order_amount` or count of customers.

If `preview_chart_changes` or `validate_chart` fails, **stop bin attempt** and set `bucketStrategy = "monetary-fallback"`.

- [ ] **Step 3: Fallback Monetary bar if needed**

Clone `417a3183-…` / `d65efc9e-…` horizontal bar: dim `orders_customer_id`, metric `orders_sum_order_amount`, `flipAxes: true`, sort M desc, limit 500 (or tighter top-N if seed uses limit).

Name tile clearly: `Top Customers by Revenue (Bucket Fallback)` so Overview can explain Q3 limitation.

- [ ] **Step 4: Save UUIDs**

Record both chart UUIDs for Task 6 tiling.

---

### Task 5: Action list table

**Files:**

- Create (remote): `rfm-action-table-customer-list`

**Interfaces:**

- Consumes: Deep Dive table seed; Task 1 `customersEnrich`
- Produces: `actionListUuid`

- [ ] **Step 1: Build table payload**

Base (id-only):

```json
{
  "name": "Customer Action List (F×M)",
  "description": "Q4: per-customer Frequency and Monetary for action triage. Sorted by revenue desc.",
  "tableName": "orders",
  "slug": "rfm-action-table-customer-list",
  "spaceSlug": "experiments",
  "version": 1,
  "dashboardSlug": "jaffle-shop-rfm-action-lists",
  "skipSpaceCreate": true,
  "metricQuery": {
    "exploreName": "orders",
    "dimensions": ["orders_customer_id"],
    "metrics": ["orders_num_unique_order_ids", "orders_sum_order_amount"],
    "filters": {},
    "sorts": [{ "fieldId": "orders_sum_order_amount", "descending": true }],
    "limit": 500,
    "tableCalculations": [],
    "additionalMetrics": [],
    "customDimensions": [],
    "timezone": "project_timezone"
  },
  "chartConfig": { "type": "table", "config": {} },
  "tableConfig": {
    "columnOrder": ["orders_customer_id", "orders_num_unique_order_ids", "orders_sum_order_amount"]
  }
}
```

If `customersEnrich` is true, only add fieldIds proven in Task 1 (never invent). Prefer staying on `orders` if join fields are unclear — ship id-only rather than break the chart.

- [ ] **Step 2: preview → confirm → create**

`resourceKey` = `rfm-action-table-customer-list`.

- [ ] **Step 3: Spot-check definition**

`get_chart_as_code` on new UUID; confirm sort descending on `orders_sum_order_amount`.

---

### Task 6: Assemble tiles + filters

**Files:**

- Modify (remote): dashboard `jaffle-shop-rfm-action-lists`

**Interfaces:**

- Consumes: all five chart UUIDs; Overview markdown text; month filter YAML from spec
- Produces: tiled dashboard matching layout sketch

- [ ] **Step 1: Compose Overview markdown content**

Include:

1. Restated Objective (audience + decisions)
2. F×M approx language table (High F/High M; High M/Low–Mid F; Low F/Low M)
3. Explicit: Recency / formal RFM segments out of scope
4. If monetary fallback: one sentence that tile 4 is revenue concentration, not F×M bins
5. If id-only list: `customers` attributes not connected
6. Reading order: KPI → map + bucket → action list

- [ ] **Step 2: Preview update_dashboard with full tiles**

Use 36-col layout from spec. Example tile skeleton (replace chart UUIDs; generate fresh tile UUIDs):

```json
{
  "projectUuid": "3dda11cb-aac8-42f7-82f1-26fa6b1afa80",
  "dashboardUuidOrSlug": "jaffle-shop-rfm-action-lists",
  "changes": {
    "name": "Jaffle Shop — RFM Action Lists",
    "description": "Marketing action board: F×M approximation lists for jaffle_shop orders (Recency out of scope).",
    "tiles": [
      {
        "uuid": "a1000000-0000-4000-8000-000000000001",
        "type": "markdown",
        "x": 0,
        "y": 0,
        "w": 36,
        "h": 4,
        "properties": {
          "title": "Overview",
          "content": "<PASTE OVERVIEW MARKDOWN>"
        }
      },
      {
        "uuid": "a1000000-0000-4000-8000-000000000002",
        "type": "saved_chart",
        "x": 0,
        "y": 4,
        "w": 18,
        "h": 4,
        "properties": { "savedChartUuid": "<kpiActiveUuid>", "hideTitle": false }
      },
      {
        "uuid": "a1000000-0000-4000-8000-000000000003",
        "type": "saved_chart",
        "x": 18,
        "y": 4,
        "w": 18,
        "h": 4,
        "properties": { "savedChartUuid": "<kpiRevenueUuid>", "hideTitle": false }
      },
      {
        "uuid": "a1000000-0000-4000-8000-000000000004",
        "type": "saved_chart",
        "x": 0,
        "y": 8,
        "w": 18,
        "h": 10,
        "properties": { "savedChartUuid": "<scatterUuid>", "hideTitle": false }
      },
      {
        "uuid": "a1000000-0000-4000-8000-000000000005",
        "type": "saved_chart",
        "x": 18,
        "y": 8,
        "w": 18,
        "h": 10,
        "properties": { "savedChartUuid": "<bucketUuid>", "hideTitle": false }
      },
      {
        "uuid": "a1000000-0000-4000-8000-000000000006",
        "type": "saved_chart",
        "x": 0,
        "y": 18,
        "w": 36,
        "h": 12,
        "properties": { "savedChartUuid": "<actionListUuid>", "hideTitle": false }
      }
    ],
    "tabs": [],
    "filters": {
      "dimensions": [
        {
          "id": "filter-orders-month",
          "label": "Order month",
          "operator": "equals",
          "values": [],
          "disabled": false,
          "required": false,
          "target": {
            "fieldId": "orders_order_date_month",
            "tableName": "orders"
          }
        }
      ],
      "metrics": [],
      "tableCalculations": []
    }
  }
}
```

If preview `diff.removed` includes `tiles`/`tabs`/`filters` unexpectedly, re-preview with those arrays included — do not apply a description-only body.

Match tile property shape to whatever `get_dashboard` / working Deep Dive tiles use if the above keys differ (adapt to live API; do not invent chart configs).

- [ ] **Step 3: confirm_preview**

`resourceKind: dashboard`, `resourceKey: <dashboard UUID or slug as bound by preview>`.

- [ ] **Step 4: update_dashboard with exact same body**

Expected: success; no `PREVIEW_STALE`.

- [ ] **Step 5: Verify assembly**

`get_dashboard`: 1 markdown + 5 saved_chart tiles; month filter present with empty `values`.

---

### Task 7: Done criteria + spec update

**Files:**

- Modify: `docs/superpowers/specs/2026-08-03-jaffle-shop-rfm-action-dashboard-design.md` (status + implementation record + §9 checkboxes)
- Do not commit unless user asks

**Interfaces:**

- Consumes: live dashboard UUID/URL; Task 1–6 outcomes
- Produces: updated spec ready for human review

- [ ] **Step 1: Inventory check**

`get_space` / search: all five charts exist; none left untiled as orphans under the dashboard ownership story (dashboard-owned charts should appear on the board).

- [ ] **Step 2: Fill implementation record on spec**

Add at top (below title):

| Field               | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Dashboard UUID      | `…`                                                                                            |
| Slug                | `jaffle-shop-rfm-action-lists`                                                                 |
| URL                 | `https://ubie.lightdash.cloud/projects/3dda11cb-aac8-42f7-82f1-26fa6b1afa80/dashboards/<uuid>` |
| bucketStrategy      | `bin` or `monetary-fallback`                                                                   |
| customersEnrich     | `false` or fieldId list                                                                        |
| UI/row verification | unverified (no `run_chart`)                                                                    |

Set `Status: implemented (YYYY-MM-DD)`.

- [ ] **Step 3: Check off §9 Done criteria**

Mark each checkbox true only if verified.

- [ ] **Step 4: Final user report**

Report dashboard URL, tile count, fallback/enrich outcomes, and that commits were skipped.

---

## Plan self-review

1. **Spec coverage:** Objective Q1–Q4 → Tasks 3–5; shell/space → Task 2; Overview language + limitations → Task 6; filters → Task 6; seed/customers gates → Task 1; done criteria → Task 7. Non-goals (Recency engine, Deep Dive replace) have no tasks.
2. **Placeholders:** No TBD steps; bucket/customers are explicit decision points with fallback actions.
3. **Consistency:** Slugs, `dashboardSlug`, `projectUuid`, and fieldIds match the spec throughout.
