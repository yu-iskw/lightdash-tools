# Jaffle Shop RFM Action Lists — Design Spec

Date: 2026-08-03
Status: implemented (2026-08-03) — built via Inline Lab Batch SOP (no SDD)
Approach: **1 — List-first action board** (F×M approximation; Recency out of scope)

### Implementation record

| Field               | Value                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard UUID      | `be726a30-9ed5-43fa-b8fe-a58039cb6bcc`                                                                                                  |
| Slug                | `jaffle-shop-rfm-action-lists`                                                                                                          |
| URL                 | https://ubie.lightdash.cloud/projects/3dda11cb-aac8-42f7-82f1-26fa6b1afa80/dashboards/be726a30-9ed5-43fa-b8fe-a58039cb6bcc              |
| Tiles               | 6 (1 markdown + 5 charts)                                                                                                               |
| Filter              | Order month (`orders_order_date_month`, empty values)                                                                                   |
| bucketStrategy      | `monetary-fallback` (top customers by `orders_sum_order_amount`; frequency bins invalid — bins require numeric dimensions, not metrics) |
| customersEnrich     | `false` (id-only action list)                                                                                                           |
| UI/row verification | unverified (no `run_chart` on content-developer)                                                                                        |

| Chart slug                            | UUID                                   |
| ------------------------------------- | -------------------------------------- |
| `rfm-action-kpi-active-customers`     | `f1b8343c-3b27-40a8-9661-18fe30f02414` |
| `rfm-action-kpi-total-revenue`        | `03392705-9680-421f-9472-8261e4eb6eec` |
| `rfm-action-scatter-freq-vs-monetary` | `c1802f77-73b8-4d69-8ed5-982d13542fba` |
| `rfm-action-bar-fm-bucket-mix`        | `d8e031fe-a4f3-4674-9c5b-27d7e61e26d3` |
| `rfm-action-table-customer-list`      | `bf49d21a-6fd1-4f5b-a29c-27541f1d078b` |

Related (different product intent): [2026-08-03-jaffle-shop-rfm-dashboard-design.md](./2026-08-03-jaffle-shop-rfm-dashboard-design.md) — prior “RFM Overview” (Approach A). That board is **not** currently present in the experiments space (search `rfm` = 0 as of design discovery).

## Context

Create a marketing-oriented RFM **action** dashboard under:

- Project: `3dda11cb-aac8-42f7-82f1-26fa6b1afa80` (jaffle-shop)
- Space: `267e1102-5466-4be2-96a1-5dddc9846561` (`experiments`)
- URL: <https://ubie.lightdash.cloud/projects/3dda11cb-aac8-42f7-82f1-26fa6b1afa80/spaces/267e1102-5466-4be2-96a1-5dddc9846561>

### Discovery notes (design-time)

Verified via content-developer `get_chart_as_code` / `get_space` / `search_content` (no `run_chart` on this persona — **row values not observed**):

| Role                        | fieldId                       | Seed evidence                                                      |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| Customer key                | `orders_customer_id`          | Sum of Order Amount / Customer; Deep Dive scatter & table          |
| Frequency (F)               | `orders_num_unique_order_ids` | # Orders / Month; Deep Dive scatter                                |
| Monetary (M)                | `orders_sum_order_amount`     | Sum of Order Amount / Customer                                     |
| Day                         | `orders_order_date_day`       | # Orders / Day                                                     |
| Month filter                | `orders_order_date_month`     | # Orders / Month                                                   |
| additionalMetric pattern    | `count_distinct` on dim       | # Orders / Day (`order_id`)                                        |
| customDimension bin pattern | `binType: fixed_number`       | `table-with-custom-metric-dimensions` (virtual view; pattern only) |

Gaps:

- No saved charts named `customers` / `rfm` in project search.
- No native Recency / named-segment dimensions on verified seeds.
- Distinct-customer KPI metric not present as a named seed metric — build via `additionalMetrics` `count_distinct` on `customer_id`.
- Nearby board: **Jaffle Shop Deep Dive — Visualization Lab** (`a765419c-ca64-40a2-a9e7-d2ddcd43f258`) already has F×M scatter and customer F/M table; this spec is a **separate** action-oriented board, not a replacement.

### Decisions captured in brainstorming

- Primary purpose: **marketing action** (not exec overview-only).
- First move: **cross-segment lists on one board**.
- Identity: **`orders_customer_id` required**; enrich with `customers` explore attributes **if** discoverable at build time.
- Segmentation: prefer **C (F×M approximation)** over **B (relative quartiles)**; do **not** use fixed named-segment thresholds (A).

## 1. Objective

**Audience:** マーケ / オペレーション（jaffle_shop で誰に何のアクションを取るかを決める人）

**Decisions this board supports:**

- F×M 上でどの顧客群を優先するか（横断）
- 高価値・高頻度 vs 伸びしろ vs 低活性をどう振り分けるか
- 月で切ったとき、アクション対象の規模はどう変わるか

**Insight questions:**

| Id  | Question                                                  |
| --- | --------------------------------------------------------- |
| Q1  | 対象顧客数・総売上の規模は？                              |
| Q2  | F×M 上で顧客はどう散らばるか？                            |
| Q3  | F×M 近似バケット別の顧客数・売上寄与は？                  |
| Q4  | アクション用に顧客別 F/M（+可能なら属性）を一覧できるか？ |

**Primary metrics / dimensions:**

- Explore: `orders`（顧客粒度 = `orders_customer_id`）
- Frequency: `orders_num_unique_order_ids`
- Monetary: `orders_sum_order_amount`
- Time filter: `orders_order_date_month`
- Optional enrich: `customers` explore fields only if found at build; otherwise ship id-only

**Non-goals:**

- 真の Recency スコア / 本番 RFM セグメントエンジン
- キャンペーン実行ツール連携・リスト書き出し API
- 全チャートタイプのショーケース
- Deep Dive Visualization Lab の置き換え
- content-developer 上での `run_chart` による行データ検証（persona 制約）

## 2. Space & shell

| Field           | Value                                             |
| --------------- | ------------------------------------------------- |
| projectUuid     | `3dda11cb-aac8-42f7-82f1-26fa6b1afa80`            |
| spaceUuid       | `267e1102-5466-4be2-96a1-5dddc9846561`            |
| Dashboard name  | `Jaffle Shop — RFM Action Lists`                  |
| Dashboard slug  | `jaffle-shop-rfm-action-lists`                    |
| Chart ownership | dashboard-owned (`dashboardSlug` on create_chart) |
| Space create    | never (`skipSpaceCreate: true`; existing space)   |

## 3. F×M approximation language (Overview tile)

Document these labels in the markdown Overview. They are **reading aids**, not warehouse dimensions:

| Label              | Intent (F×M only)                |
| ------------------ | -------------------------------- |
| High F / High M    | Champions / Loyal **candidates** |
| High M / Low–Mid F | 育成・個別フォロー候補           |
| Low F / Low M      | 低優先                           |

Recency and formal RFM named segments (Champions / At Risk / … as scored bands) are **out of scope** for this board. If bucket mix cannot be built safely, fall back per §4 and state the limitation in Overview.

## 4. Tiles

Budget: **5 charts + 1 markdown**.

| #   | Tile name        | Viz                 | Insight | `tableName` | Proposed slug                         | Seed / notes                                                                                                                                                                 |
| --- | ---------------- | ------------------- | ------- | ----------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Overview         | markdown            | —       | —           | —                                     | Objective + F×M approx language + reading order + limitations                                                                                                                |
| 1   | Active customers | `big_number`        | Q1      | `orders`    | `rfm-action-kpi-active-customers`     | `additionalMetrics` count_distinct on `customer_id` (pattern from # Orders / Day)                                                                                            |
| 2   | Total revenue    | `big_number`        | Q1      | `orders`    | `rfm-action-kpi-total-revenue`        | `orders_sum_order_amount`                                                                                                                                                    |
| 3   | Value map (F×M)  | cartesian `scatter` | Q2      | `orders`    | `rfm-action-scatter-freq-vs-monetary` | Clone Deep Dive scatter encode; keep `orders_customer_id` grain                                                                                                              |
| 4   | F×M bucket mix   | cartesian `bar`     | Q3      | `orders`    | `rfm-action-bar-fm-bucket-mix`        | Prefer customDimension bin on F or M; else relative cut if safe; else **fallback** top-N Monetary bar (`viz-lab-hbar-revenue-by-customer` / sum-amount seed) + Overview note |
| 5   | Action list      | `table`             | Q4      | `orders`    | `rfm-action-table-customer-list`      | Clone Deep Dive customer detail; columns: customer_id + F + M (M desc); add `customers` attrs only if explore/seed confirms fieldIds                                         |

**Seed policy:** Clone via `get_chart_as_code` from known working charts. Do not invent fieldIds or skinny cartesian encode.

## 5. Layout sketch (36-col grid)

```
y=0   [markdown Overview                         w:36 h:4]
y=4   [KPI Active customers w:18 h:4] [KPI Total revenue w:18 h:4]
y=8   [F×M scatter w:18 h:10]         [Bucket mix / fallback w:18 h:10]
y=18  [Action list table                         w:36 h:12]
```

Reading order: KPI → value map + bucket mix → action table.

Compose full `x/y/w/h` on write (`get_dashboard` often omits layout).

## 6. Filters

One shared filter; all chart tiles use `orders` so auto-apply (no `tileTargets` excludes).

```yaml
filters:
  dimensions:
    - id: filter-orders-month
      label: Order month
      operator: equals
      values: [] # empty = all-time default; viewers may restrict
      disabled: false
      required: false
      target:
        fieldId: orders_order_date_month
        tableName: orders
  metrics: []
  tableCalculations: []
```

## 7. Tabs

None.

## 8. Implementation constraints

1. Soft dashboard-shell-first SOP: create dashboard → charts with `dashboardSlug` → single (or staged) `update_dashboard` for tiles/filters.
2. Preview gate: `preview_*` → `confirm_preview` → apply; reuse the **exact** preview payload on apply; pass `projectUuid` when HTTP pin absent.
3. Concurrent chart creates: ≤2 preview→confirm→apply chains (hosted tunnel stability).
4. content-developer cannot `run_chart`; report UI render / row values as unverified.
5. Scatter grain dimension must remain for correct one-row-per-customer F×M; `validate_chart` unused-dimension warning is expected.
6. Before writes: re-check `customers` explore / charts; if absent, ship id-only Action list and document in Overview.
7. Do not fabricate Recency metrics, named-segment fieldIds, or geography.

## 9. Done criteria

- [x] Objective unchanged unless user amends this spec
- [x] Every chart tile maps to Q1–Q4
- [x] Charts tiled on the dashboard (ownership alone insufficient)
- [x] Empty-value month filter present; default all-time
- [x] Overview markdown restates Objective + F×M approx language + limitations
- [x] FieldIds verified from seed / explore before apply
- [x] Action list sorted by Monetary descending
- [x] Bucket mix either implemented or explicit Monetary fallback documented on Overview
- [x] `customers` enrich attempted; outcome recorded (connected or id-only)
- [x] UI render / row values noted as unverified on this persona
- [x] Untiled dashboard-owned leftovers: none

## 10. Out of scope for this spec’s implementation plan

- Warehouse-side RFM mart or Recency score pipeline
- content-governance soft-delete of Deep Dive / unrelated lab content
- Playbook/prompt loop workstreams
- Committing this design doc (explicitly deferred by author request)

## Spec self-review

- No product TBD left open: bucket-mix fallback and customers enrich are **implementation gates** with documented outcomes, not deferred product choices.
- Q1–Q4 each map to tiles; Q1 uses two KPIs by design.
- Single-explore (`orders`) matches one shared month filter.
- Scope is one new action dashboard; prior Overview spec remains a separate artifact.
- Ambiguity resolved: segmentation = F×M reading aids + optional bin/fallback, not fixed Champions/At Risk thresholds.
