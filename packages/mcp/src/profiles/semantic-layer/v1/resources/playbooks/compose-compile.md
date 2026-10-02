# Semantic-layer — compose & compile

URI: `lightdash://playbooks/semantic-layer/compose-compile`

## Recommended sequence

1. Scope: `get_project` with the user-given project UUID (do not switch from org-wide `list_projects`).
2. Discover: search explores → disambiguate → `list_dimensions` shortlist + `get_explore` → `tables[baseTable].metrics`.
3. Build `metricQuery` using **only** copied `fieldId`s.
4. `compile_query` → **verify SELECT aliases** → stop (or ≤2 fix retries).

## metricQuery skeleton

```json
{
  "exploreName": "{exploreId}",
  "dimensions": ["{exploreId}_{dim}"],
  "metrics": ["{exploreId}_{metric}"],
  "filters": {},
  "sorts": [{ "fieldId": "{exploreId}_{dim}", "descending": false }],
  "limit": 50,
  "tableCalculations": []
}
```

`metrics` may be `[]`. Every string in `dimensions` / `metrics` / `sorts[].fieldId` must appear in prior tool output.

MCP `compile_query` always sets `exploreName` from the tool `exploreId` (path is authoritative), defaults missing `tableCalculations` and `sorts` to `[]`, and **fills missing FilterGroup/FilterRule `id`s** (does not invent wrappers for unknown shapes). Keep the full skeleton for other OpenAPI-required keys (`filters`, `limit`, …) and for CLI/JSON callers. Prefer SELECT aliases / metric `compiledSql` over metric **name/label** when they disagree.

When filters are non-empty, prefer an explicit FilterGroup:

```json
{
  "filters": {
    "dimensions": {
      "id": "dim-filters-1",
      "and": [
        {
          "id": "rule-1",
          "target": { "fieldId": "{exploreId}_{dim}" },
          "operator": "equals",
          "values": ["example"]
        }
      ]
    }
  }
}
```

MCP may inject missing `id`s; still copy this shape so non-MCP clients and hosts that bypass hardeners succeed.

## Field IDs — failure modes

| Symptom                                                              | Cause                                                                                                                               | Fix                                                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `unknown field id` / hard error                                      | Short names or typos                                                                                                                | Use full `fieldId` from `list_dimensions` / `{exploreId}_{metricName}`                                                                |
| Server `isError` + empty SELECT                                      | Upstream accepted bad ids with **zero** columns                                                                                     | Replace with real fieldIds; re-compile once                                                                                           |
| Server `isError` + missing SELECT aliases                            | Invented id, dotted STRUCT id (`…_customer.first_name` vs `…_customer__first_name`), or ARRAY join id without `baseTableOnly=false` | Copy `fieldId` from `list_dimensions` (STRUCT dots → `__`; ARRAY via join tables); re-compile                                         |
| Server `isError` + compiled SQL `/* ERROR:` comment                  | Unknown filter (or other) fieldId; Lightdash embeds an ERROR comment while still returning SQL                                      | Copy filter `fieldId`s from `list_dimensions`; re-compile                                                                             |
| SQL “succeeds” but a requested dim/metric is **missing** from SELECT | Invented or wrong fieldId while another field still projected (pre-guard / non-MCP clients)                                         | Re-check against `list_dimensions` / metrics map; re-compile                                                                          |
| `UPSTREAM_VALIDATION` / `'tableCalculations' is required`            | Body omitted `tableCalculations` (pre-harden / non-MCP clients)                                                                     | MCP defaults to `[]`; pass `tableCalculations: []` explicitly if needed                                                               |
| `UPSTREAM_VALIDATION` / `'sorts' is required`                        | Body omitted `sorts` (pre-harden / non-MCP clients)                                                                                 | MCP defaults to `[]`; pass `sorts: []` explicitly if needed                                                                           |
| `UPSTREAM_VALIDATION` / `'exploreName' is required`                  | Body omitted `exploreName` (pre-harden / non-MCP clients) or wrong exploreId                                                        | Pass locked `exploreId`; MCP fills `exploreName` — re-compile once                                                                    |
| `UPSTREAM_VALIDATION` on `filters.dimensions` (`'id'/'or' required`) | FilterGroup missing top-level `id` (rules alone are not enough; pre-harden / non-MCP)                                               | Prefer `{ "id": "…", "and": [ { "id": "…", "target": { "fieldId": "…" }, "operator": "…", "values": […] } ] }`; MCP fills missing ids |
| `UPSTREAM_VALIDATION` / operator `should be one of …`                | Invented operator (e.g. `isNotNull`)                                                                                                | Use `notNull` / `isNull` (not `isNotNull`)                                                                                            |
| `Metric not found` on `get_metric`                                   | `tableName` was warehouse label                                                                                                     | Use full explore id                                                                                                                   |
| Lineage works with short name but compile fails                      | `get_field_lineage` accepts short names; `compile_query` does not                                                                   | Always copy full `fieldId` into `metricQuery`                                                                                         |

Compiled SQL may include **extra related metrics** the semantic layer pulls in — OK if every **requested** fieldId still appears as a SELECT alias. Prefer SELECT aliases / metric `compiledSql` over metric **name/label** when they disagree (e.g. a metric named `num_unique_order_ids` that actually `COUNT(DISTINCT customer_id)`).

## Verify after every compile (mandatory)

MCP `compile_query` sets `isError` when the SELECT is empty, when compiled SQL embeds a `/* ERROR:` comment (e.g. unknown filter fieldId), or when requested `dimensions` / `metrics` are missing from SELECT aliases. Still verify locally (belt-and-suspenders for hosts that ignore `isError`):

1. Parse the compiled `query` SELECT list (aliases / AS names).
2. Confirm **each** requested dimension and metric `fieldId` is present.
3. If any are missing → treat as failure even when the tool did not set `isError`.
4. Confirm `ORDER BY` / sorts only reference fields that exist in the SELECT (or known group keys).

## Multi-insight composition

When the user asks for N insights on one table/explore:

1. Disambiguate explore **once**; reuse the same `exploreId` and metric shortlist.
2. Pick **diverse** cuts from available fields (trend, categorical breakdown, rate/quality, outcome, acquisition) — only when those fields exist. Don’t repeat the same grain N times.
3. Compile each; verify aliases; present **title + fieldIds + SQL** (or errors).
4. Metrics that join other tables may produce large CTE SQL — still OK; mention the join briefly.

## Debug checklist

- Unknown field id / short names / empty SELECT / missing SELECT alias → fix fieldIds from `list_dimensions` + explore-local metrics; re-compile (≤2 retries). Prefer SELECT aliases / `compiledSql` over metric name/label.
- Other OpenAPI-required keys still failing (`filters`, `limit`, …) → copy the skeleton; MCP already fills `exploreName`, missing `tableCalculations` / `sorts`, and missing filter `id`s.
- Wrong explore → re-disambiguate (`schemaName`; exact `label` or `name` `__{table}`; skip empty schema / eda unless asked).
- Catalog empty / metric not found → `get_explore` `tables[baseTable].metrics`; compile as `{exploreId}_{metricName}`.
- Stop after a good verified compile or a clear blocker.
