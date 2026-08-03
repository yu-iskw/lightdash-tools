# Jaffle Shop RFM Overview — Design Spec

Date: 2026-08-03
Status: implemented (2026-08-03) — dashboard live in experiments space
Approach: **A — Customer-grain RFM board**

### Implementation record

| Field          | Value                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Dashboard UUID | `5c830291-a978-4042-baeb-8ba09f7c78fd`                                                                                     |
| Slug           | `jaffle-shop-rfm-overview`                                                                                                 |
| URL            | https://ubie.lightdash.cloud/projects/3dda11cb-aac8-42f7-82f1-26fa6b1afa80/dashboards/5c830291-a978-4042-baeb-8ba09f7c78fd |
| Tiles          | 9 (1 markdown + 8 charts)                                                                                                  |
| Filter         | Order month (`orders_order_date_month`, empty values)                                                                      |

### Spec self-review (2026-08-03)

- No open product TBD: remaining “TBD pending seed” items are **implementation gates** (Recency bin dim, segment dim thresholds, distinct-customer KPI metric), resolved by seed/`get_chart_as_code` before writes — not deferred product decisions.
- Insight ids Q1–Q7 each have exactly one primary tile (Q1 split across two KPIs by design).
- Single-explore (`orders`) matches the one shared month filter; no multi-explore `tileTargets` ambiguity.
- Scope is one dashboard build; warehouse RFM mart and playbook loop Tasks 6–7 stay out of scope.

## Context

Create an RFM-oriented dashboard under the Lightdash space:

- Project: `3dda11cb-aac8-42f7-82f1-26fa6b1afa80`
- Space: `267e1102-5466-4be2-96a1-5dddc9846561`
- URL: <https://ubie.lightdash.cloud/projects/3dda11cb-aac8-42f7-82f1-26fa6b1afa80/spaces/267e1102-5466-4be2-96a1-5dddc9846561>

Prior jaffle seed discovery (content-developer playbook loop) verified `orders` fieldIds including `orders_customer_id`, `orders_num_unique_order_ids`, `orders_sum_order_amount`, `orders_order_date_day`, `orders_order_date_month`. Recency bins and named-segment dimensions are **not** guaranteed native fields — resolve at build time via seed clone / custom dimension, never invent fieldIds.

## 1. Objective

**Audience:** 経営・アナリティクス（jaffle_shop の顧客価値構造を俯瞰する人）

**Decisions this board supports:**

- 売上は少数の高価値顧客に集中しているか
- 頻度・金額の分布はどこに厚いか
- どの命名セグメントが規模・売上で支配的か
- 月フィルタで切ったとき、その構造はどう変わるか

**Insight questions:**

| Id  | Question                                       |
| --- | ---------------------------------------------- |
| Q1  | 顧客全体の規模と総売上はどの程度か（KPI）      |
| Q2  | Recency（最終注文の新しさ）の分布はどうか      |
| Q3  | Frequency（注文回数）の分布はどうか            |
| Q4  | Monetary（顧客別売上）の分布・上位集中はどうか |
| Q5  | F×M 上で顧客はどう散らばるか（価値マップ）     |
| Q6  | 命名セグメント別の顧客数・売上寄与はどうか     |
| Q7  | 顧客別の明細で個別の R/F/M 近似値を追えるか    |

**Primary metrics / dimensions:**

- Explore: `orders`（顧客粒度 = `orders_customer_id`）
- Frequency: `orders_num_unique_order_ids`
- Monetary: `orders_sum_order_amount`
- Recency: derived from `orders_order_date_day` / `orders_order_date_month` (customer last-order approximation; **TBD pending seed** if custom metric / table calc / bin dimension needed)
- Time filter dimension: `orders_order_date_month`

**Non-goals:**

- キャンペーン実行リストの書き出し
- 真の RFM スコアエンジン（分位スコアの本番パイプライン）の構築
- 全チャートタイプのショーケース
- `customers` explore 必須（使える指標があれば最大 1 タイル。無ければ使わない）
- map / 地理ビズ
- content-developer 上での `run_chart` による結果検証（persona 制約）

## 2. Space & shell

| Field           | Value                                             |
| --------------- | ------------------------------------------------- |
| projectUuid     | `3dda11cb-aac8-42f7-82f1-26fa6b1afa80`            |
| spaceUuid       | `267e1102-5466-4be2-96a1-5dddc9846561`            |
| Dashboard name  | `Jaffle Shop — RFM Overview`                      |
| Dashboard slug  | `jaffle-shop-rfm-overview`                        |
| Chart ownership | dashboard-owned (`dashboardSlug` on create_chart) |
| Space create    | never (`skipSpaceCreate: true`; existing space)   |

## 3. Named segment definitions

Document in the markdown Overview tile. Numeric thresholds are fixed at implementation after inspecting jaffle distributions (do not invent thresholds before seed discovery).

| Segment     | Intent (R / F / M)         |
| ----------- | -------------------------- |
| Champions   | 高 R・高 F・高 M           |
| Loyal       | 中〜高 R・高 F             |
| Potential   | 高 R・低〜中 F（伸びしろ） |
| At Risk     | 低 R・高 F/M（かつて優良） |
| Hibernating | 低 R・低 F                 |

If a native or custom segment dimension cannot be built safely, tile 7 falls back to a documented approximation (e.g. Monetary/Frequency quartile proxy) and the Overview states the limitation. Never fabricate fieldIds.

## 4. Tiles

Budget: **8 charts + 1 markdown** (within default ≤8 chart cap).

| #   | Tile name              | Viz                          | Insight | `tableName` | Proposed slug                    | Seed / notes                                                                 |
| --- | ---------------------- | ---------------------------- | ------- | ----------- | -------------------------------- | ---------------------------------------------------------------------------- |
| 0   | Overview               | markdown                     | —       | —           | —                                | Restate Objective + segment definitions + reading order                      |
| 1   | Active customers       | `big_number`                 | Q1      | `orders`    | `rfm-kpi-active-customers`       | Distinct customers; confirm metric via seed                                  |
| 2   | Total revenue          | `big_number`                 | Q1      | `orders`    | `rfm-kpi-total-revenue`          | `orders_sum_order_amount`                                                    |
| 3   | Recency distribution   | cartesian `bar`              | Q2      | `orders`    | `rfm-bar-recency-bins`           | Last-order bins; TBD pending seed; else month-of-last-activity approximation |
| 4   | Frequency distribution | cartesian `bar`              | Q3      | `orders`    | `rfm-bar-frequency-dist`         | Customer grain × `orders_num_unique_order_ids`                               |
| 5   | Monetary concentration | cartesian `bar` (horizontal) | Q4      | `orders`    | `rfm-bar-top-customers-monetary` | Top N by `orders_sum_order_amount`; seed: sum amount / customer              |
| 6   | Value map (F×M)        | cartesian `scatter`          | Q5      | `orders`    | `rfm-scatter-freq-vs-monetary`   | x=F, y=M, grain dim `orders_customer_id` (validate grain warning expected)   |
| 7   | Segment size & revenue | cartesian `bar`              | Q6      | `orders`    | `rfm-bar-segment-mix`            | Named segment dim TBD pending seed; fallback per §3                          |
| 8   | Customer RFM detail    | `table`                      | Q7      | `orders`    | `rfm-table-customer-detail`      | customer_id + F + M + last order date (R approx)                             |

**Seed policy:** Clone via `get_chart_as_code` from known working charts (`# Orders / Month`, sum amount / customer, big_number KPI, scatter with customer grain). Do not invent fieldIds or skinny cartesian encode.

## 5. Layout sketch (36-col grid)

```
y=0   [markdown Overview                    w:36 h:4]
y=4   [KPI Active customers w:18 h:4] [KPI Total revenue w:18 h:4]
y=8   [Recency bar w:18 h:9]          [Frequency bar w:18 h:9]
y=17  [Top Monetary bar w:18 h:9]     [F×M scatter w:18 h:9]
y=26  [Segment mix bar                     w:36 h:9]
y=35  [Customer RFM detail table           w:36 h:10]
```

Reading order: KPI → R/F distributions → Monetary + value map → segment contribution → detail table.

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
2. Preview gate: `preview_*` → `confirm_preview` → apply; pass `projectUuid` when HTTP pin absent.
3. Concurrent chart creates: ≤2 preview→confirm→apply chains (hosted tunnel stability).
4. content-developer cannot `run_chart`; report UI render as unverified.
5. Scatter grain dimension must remain for correct one-row-per-customer F×M; `validate_chart` unused-dimension warning is expected.
6. Do not add map tiles; do not fabricate geography or segment fieldIds.

## 9. Done criteria

- [x] Objective unchanged unless user amends this spec
- [x] Every chart tile maps to Q1–Q7
- [x] Charts tiled on the dashboard (ownership alone insufficient)
- [x] Empty-value month filter present; default all-time
- [x] Overview markdown restates Objective + segment definitions
- [x] FieldIds verified from seed / explore before apply
- [x] Untiled dashboard-owned leftovers: none (all 8 charts tiled)
- [x] UI render noted as unverified on this persona (`run_chart` unavailable)
- [x] `validate_chart` on scatter: expected unused-grain warning for `orders_customer_id` (do not drop)
- [x] `validate_chart` on KPI + segment proxy: clean

## 10. Out of scope for this spec’s implementation plan

- Playbook/prompt loop Tasks 6–7 (separate workstream)
- content-governance soft-delete of unrelated lab dashboards
- Building a warehouse-side RFM mart
