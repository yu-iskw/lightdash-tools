# Content-developer — chart types

URI: `lightdash://playbooks/content-developer/chart-types`

Prefer **clone** (`get_chart_as_code` / `duplicate_chart`) over inventing viz configs. Docs: [overview](https://docs.lightdash.com/references/chart-types/overview).

## UI intent → as-code `chartConfig.type`

| User / UI intent                    | As-code                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Bar / line / area / scatter / mixed | `cartesian` — series `type` is `bar` \| `line` \| `area` \| `scatter`; mixed = multiple series types |
| Horizontal bar                      | `cartesian` + `layout.flipAxes: true` + series `type: bar`                                           |
| Pie / donut                         | `pie` (`groupFieldIds`, `metricId`; `isDonut` optional)                                              |
| Funnel                              | `funnel` (`fieldId` metric; usually row `dataInput` + one stage dimension)                           |
| Treemap                             | `treemap` (`groupFieldIds`, `sizeMetricId`)                                                          |
| Sankey                              | `sankey` (`sourceFieldId`, `targetFieldId`, `metricFieldId`; needs **two** dimensions)               |
| Table                               | `table`                                                                                              |
| Big value / KPI                     | `big_number` (`selectedField`)                                                                       |
| Gauge                               | `gauge` (`selectedField`, `min`/`max` or field bounds)                                               |
| Map                                 | `map` — requires lat/lon (or location) fieldIds; **skip** and report if the explore has none         |
| Custom / data-app viz               | out of scope unless a rendering seed exists                                                          |

Bar/line/area/scatter are **series** types under one `cartesian` chart — not separate top-level `chartConfig.type` values.

## Required cartesian shape

Every series needs `type` **and** `encode.xRef` / `yRef`. Never ship `{ series: [{ type: "bar" }] }` alone (UI can TypeError).

```yaml
chartConfig:
  type: cartesian
  config:
    layout:
      xField: orders_status
      yField:
        - orders_num_unique_order_ids
    eChartsConfig:
      series:
        - type: bar
          encode:
            xRef:
              field: orders_status
            yRef:
              field: orders_num_unique_order_ids
          yAxisIndex: 0
```

Mixed charts: one series per metric (e.g. bar + line) with matching encodes; optional dual axis via `yAxisIndex`.

## Non-cartesian shapes (clone when possible)

Minimal keys (still prefer a seed of the same type):

- **pie:** `groupFieldIds` + `metricId`
- **funnel:** `fieldId` (+ stage dimension in `metricQuery.dimensions`)
- **treemap:** `groupFieldIds` + `sizeMetricId`
- **sankey:** `sourceFieldId` + `targetFieldId` + `metricFieldId` (two dims in query)
- **big_number / gauge:** `selectedField` (often empty dimensions)
- **table:** `type: table` (+ sensible `tableConfig.columnOrder`)
- **map:** only with real geo fields — otherwise omit and note the gap

## Hard rules

- Clone `chartConfig` from a rendering seed on the same `tableName`; change series `type` / top-level type only when needed.
- FieldIds only from seed / `get_chart` / semantic-layer — never invent.
- Every `metricQuery.dimensions` entry must appear in viz layout / group / sankey source-target / pivot — unused dimensions corrupt GROUP BY (“Results may be incorrect”).
- For dashboard work set `dashboardSlug` **and** tile via `update_dashboard` (ownership alone does not place tiles).
