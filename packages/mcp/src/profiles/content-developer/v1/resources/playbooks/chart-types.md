# Content-developer — chart types

URI: `lightdash://playbooks/content-developer/chart-types`

Pick a viz type to **answer an insight question** from the Design Spec Objective. The table below is a **reference map**, not a build order — do not walk every row unless the user explicitly asked for multi-viz / all chart types. Prefer **clone** (`get_chart_as_code` / `duplicate_chart`) over inventing viz configs. Docs: [overview](https://docs.lightdash.com/references/chart-types/overview).

When the user **does** ask for all types: follow dashboards **Multi-viz batch SOP** (shell → ≤2 concurrent chart creates → one tile update), split the board into a decision-oriented section plus a visualization-validation appendix (see `dashboards` / `dashboard-design`), and check every candidate type against the **semantic fit gate** below before adding it.

## Semantic fit gate

Schema acceptance is not suitability — check every type against its semantics before adding it, including in a validation appendix:

- Scatter: two numeric variables at one shared grain; a categorical x-axis is not a correlation plot.
- Funnel: ordered, discrete stages with a numeric count; categories such as coupon yes/no are not a funnel.
- Sankey: a real source → target flow plus a weight metric; unrelated dimensions do not become a flow merely because the schema accepts them.
- Pie: categories must form a meaningful whole; otherwise use a bar.
- Area: use when the total and its component parts over time both matter; a single series normally belongs in a line chart.
- Gauge: require a defensible bound or target; do not invent `max` from aesthetics. When no natural bound exists, use an explicitly labeled illustrative benchmark rather than inventing one silently.
- Map: require latitude+longitude, ISO 3166-1 alpha-3 country codes, US state codes, or an existing compatible custom-GeoJSON join field. Never fabricate geography to satisfy an all-types checklist — report the type as unsupported instead.

When an explicit all-types override still creates a funnel/Sankey (or similar) chart that fails this gate, label it as a validation-only proxy instead of skipping it — canonical template for `name`/`description`: `"<Metric> (<Type>) — Visualization Validation, Not a Real <Funnel/Flow>"` plus one sentence stating what the chart actually shows and that it is not a real funnel/flow.

## UI intent → as-code `chartConfig.type`

| User / UI intent                    | As-code                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bar / line / area / scatter / mixed | `cartesian` — series `type` is `bar` \| `line` \| `area` \| `scatter`; mixed = multiple series types                                             |
| Horizontal bar                      | `cartesian` + `layout.flipAxes: true` + series `type: bar`                                                                                       |
| Pie / donut                         | `pie` (`groupFieldIds`, `metricId`; `isDonut` optional)                                                                                          |
| Funnel                              | `funnel` (`fieldId` metric; usually `dataInput: row` + one stage dimension)                                                                      |
| Treemap                             | `treemap` (`groupFieldIds`, `sizeMetricId`)                                                                                                      |
| Sankey                              | `sankey` (`sourceFieldId`, `targetFieldId`, `metricFieldId`; needs **two** dimensions)                                                           |
| Table                               | `table` (`config: {}` is fine; keep `tableConfig.columnOrder`)                                                                                   |
| Big value / KPI                     | `big_number` (`selectedField`; empty `dimensions`)                                                                                               |
| Gauge                               | `gauge` (`selectedField`, numeric `min`/`max` or `maxFieldId`)                                                                                   |
| Map                                 | `map` — requires latitude/longitude, ISO 3166-1 alpha-3 or US state codes, or a custom-GeoJSON join; **skip** and report if the explore has none |
| Custom / data-app viz               | out of scope unless a rendering seed exists                                                                                                      |

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

Mixed charts: one series per metric (e.g. bar + line) with matching encodes; optional dual axis via `yAxisIndex: 0|1`.

Horizontal bar: same as bar plus `layout.flipAxes: true`.

## Non-cartesian shapes (clone when possible)

```yaml
# pie
chartConfig:
  type: pie
  config:
    groupFieldIds: [orders_status]
    metricId: orders_num_unique_order_ids
    isDonut: false
    showLegend: true
    showPercentage: true
    showValue: true

# funnel (row stages = dimension values)
chartConfig:
  type: funnel
  config:
    fieldId: orders_num_unique_order_ids
    dataInput: row

# treemap
chartConfig:
  type: treemap
  config:
    groupFieldIds: [orders_status]
    sizeMetricId: orders_num_unique_order_ids

# sankey (two dims in metricQuery.dimensions; keep customDimensions if cloned)
chartConfig:
  type: sankey
  config:
    sourceFieldId: use_coupon
    targetFieldId: orders_status
    metricFieldId: orders_num_unique_order_ids

# big_number
chartConfig:
  type: big_number
  config:
    selectedField: orders_num_unique_order_ids
    showBigNumberLabel: true
    showComparison: false
    comparisonFormat: raw

# gauge
chartConfig:
  type: gauge
  config:
    selectedField: orders_num_unique_order_ids
    min: 0
    max: 200
    showAxisLabels: true
    showPercentage: false

# table
chartConfig:
  type: table
  config: {}
```

## Hard rules

- Clone `chartConfig` from a rendering seed on the same `tableName`; change series `type` / top-level type only when needed.
- FieldIds only from seed / `get_chart` / semantic-layer — never invent. this profile has **no** explore/field list tools.
- Field IDs shown in the YAML examples below (e.g. `orders_status`) are **illustrative**, not guaranteed to exist on any given explore — verify against a seed via `get_chart_as_code` (or `get_chart`) before use.
- When cloning charts that use SQL/bin custom dims (e.g. coupon flags), copy `metricQuery.customDimensions` verbatim.
- Every `metricQuery.dimensions` entry must appear in viz layout / group / sankey source-target / pivot — unused dimensions corrupt GROUP BY (“Results may be incorrect”). **Exception:** a scatter with two metric axes legitimately keeps its grain dimension (e.g. customer id) in `metricQuery.dimensions` to produce one row per entity — `validate_chart` will still flag it as "unused" because the validator only recognizes x/y-axis or group-by references, not grain-only dimensions. That warning is expected on a correct two-metric scatter; do not drop the dimension to silence it.
- For dashboard work set `dashboardSlug` **and** tile via `update_dashboard` (ownership alone does not place tiles).
- `create_chart` success body is `{ charts: [{ action, data: { uuid, slug, … } }] }` — read UUID from `charts[0].data.uuid` for tiles.
- Multi-viz boards: raise the new-chart budget; prefer **≤2 concurrent** preview→confirm→apply chains (hosted tunnels often 502 under heavier parallelism).
