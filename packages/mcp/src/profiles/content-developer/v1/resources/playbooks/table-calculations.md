# Content-developer — table calculations

URI: `lightdash://playbooks/content-developer/table-calculations`

Add chart-local metrics on top of explore dimensions/metrics via `metricQuery.tableCalculations`. Prefer clone (`get_chart_as_code`) then append calcs. This profile **cannot** run queries to verify row values.

Docs: [overview](https://docs.lightdash.com/guides/table-calculations) · [formula](https://docs.lightdash.com/guides/formula-table-calculations) · [SQL templates](https://docs.lightdash.com/guides/table-calculations/sql-templates) · [as-code](https://docs.lightdash.com/guides/developer/dashboards-as-code) · [row](https://docs.lightdash.com/references/table-calculation-functions/row-functions) / [pivot](https://docs.lightdash.com/references/table-calculation-functions/pivot-functions) / [aggregate](https://docs.lightdash.com/references/table-calculation-functions/aggregate-functions) functions.

## When to use

- Chart-specific PoP, % of total, rank, running total, rolling window, pivot share.
- If the same calc is reused across many boards → put it in **dbt** / the semantic layer instead ([overview](https://docs.lightdash.com/guides/table-calculations)).

## Preference (playbook policy)

1. **`template`** — quick types + `window_function` (OpenAPI `TemplateTableCalculation`).
2. **`formula`** — portable spreadsheet syntax starting with `=` ([formula docs](https://docs.lightdash.com/guides/formula-table-calculations)); column names match results headers.
3. **`sql`** — only for `total()` / `row_total()` / `pivot_*`, or when formula cannot express it.

Formula and SQL modes are **not** interconvertible — delete and recreate to switch ([formula FAQ](https://docs.lightdash.com/guides/formula-table-calculations)).

## Intent → shape

| Intent                                   | Prefer                  | OpenAPI / expression                                                                                                                       |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| % change from previous                   | `template`              | `type: percent_change_from_previous` + `fieldId` + `orderBy`                                                                               |
| % of previous value                      | `template`              | `type: percent_of_previous_value` + `fieldId` + `orderBy`                                                                                  |
| % of column total                        | `template`              | `type: percent_of_column_total` + `fieldId`                                                                                                |
| Rank in column                           | `template`              | `type: rank_in_column` + `fieldId`                                                                                                         |
| Running total                            | `template`              | `type: running_total` + `fieldId`                                                                                                          |
| Rolling / moving window                  | `template` or `formula` | `window_function` + `frame`, or `MOVING_AVG` / `MOVING_SUM`                                                                                |
| Simple ratio / IF / date math            | `formula`               | e.g. `=orders_sum_order_amount / orders_num_unique_order_ids`                                                                              |
| Grand % of total (correct metric re-agg) | `sql`                   | `${metric} / total(${metric})` ([aggregate](https://docs.lightdash.com/references/table-calculation-functions/aggregate-functions))        |
| Pivot row share / cross-column           | `sql`                   | `row_total` / `pivot_*` **only when pivoted** ([pivot](https://docs.lightdash.com/references/table-calculation-functions/pivot-functions)) |

SQL template guides: [percent change](https://docs.lightdash.com/guides/table-calculations/table-calculation-sql-templates/percent-change-from-previous), [percent of previous](https://docs.lightdash.com/guides/table-calculations/table-calculation-sql-templates/percent-of-previous-value), [percent of column](https://docs.lightdash.com/guides/table-calculations/table-calculation-sql-templates/percent-of-total-column), [percent of group/pivot](https://docs.lightdash.com/guides/table-calculations/table-calculation-sql-templates/percent-of-group-pivot-total), [rank](https://docs.lightdash.com/guides/table-calculations/table-calculation-sql-templates/rank-in-column), [running total](https://docs.lightdash.com/guides/table-calculations/table-calculation-sql-templates/running-total), [rolling window](https://docs.lightdash.com/guides/table-calculations/table-calculation-sql-templates/rolling-window).

## Format and totals

- Percent-style calcs: set `format: { type: 'percent' }` (and `type: 'number'` when needed).
- `totalMode`: `formula` for ratios evaluated at total grain; `sum_of_rows` for windows / template windows; `none` when a total is meaningless ([totals](https://docs.lightdash.com/guides/table-calculations)).

## JSON skeletons

Field IDs are **illustrative** — copy real `fieldId`s from the explore / seed.

### Template (percent change)

```json
{
  "name": "amount_pct_change",
  "displayName": "% change vs previous",
  "type": "number",
  "format": { "type": "percent" },
  "totalMode": "sum_of_rows",
  "template": {
    "type": "percent_change_from_previous",
    "fieldId": "orders_sum_order_amount",
    "orderBy": [{ "fieldId": "orders_order_date_month", "order": "asc" }]
  }
}
```

### Formula (ratio)

```json
{
  "name": "avg_order_value",
  "displayName": "Average order value",
  "type": "number",
  "totalMode": "formula",
  "formula": "=orders_sum_order_amount / orders_num_unique_order_ids"
}
```

### SQL (percent of grand total)

```json
{
  "name": "amount_pct_of_total",
  "displayName": "% of total",
  "type": "number",
  "format": { "type": "percent" },
  "totalMode": "formula",
  "sql": "${orders.sum_order_amount} / total(${orders.sum_order_amount})"
}
```

## Authoring SOP

1. Clone via `get_chart_as_code` (or `duplicate_chart`) — that returns upsert-shaped `chartConfig` + `metricQuery`. Append to `metricQuery.tableCalculations` (never omit the array — OpenAPI requires it). Use `get_chart` only to inspect existing calc expressions; it does **not** return `chartConfig`.
2. Align `metricQuery.sorts` with window `orderBy` / formula `ORDER BY`.
3. If the calc is plotted, reference its `name` in viz encode / series like any metric fieldId.
4. `preview_chart_changes` → `confirm_preview` → `create_chart` / `update_chart` with the **identical** proposed body.
5. Do not claim verified numbers — this profile has no `run_chart` / warehouse execute.

## Hard bans

- Do not invent `fieldId`s or results-header column names. Copy them from `get_chart_as_code` / explore seeds — playbook skeletons are examples only.
- `preview_chart_changes` / `confirm_preview` do **not** prove template `fieldId`s or formula headers exist; inventing IDs can still preview-validate and only fail at query time.
- Do not convert formula ↔ sql in place — recreate the calc.
- Do not use `pivot_*` / `row_total` without a pivoted dimension (`pivotConfig.columns`).
- Do not author SQL **charts** or open data-analyst / raw SQL execution to “fix” a table calc on this profile.
- Do not freestyle warehouse-specific `OVER()` SQL when a `template` or `formula` covers the intent.
