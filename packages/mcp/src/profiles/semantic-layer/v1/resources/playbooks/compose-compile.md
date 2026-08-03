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

## Field IDs — failure modes

| Symptom                                                              | Cause                                                                                             | Fix                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `unknown field id` / hard error                                      | Short names or typos                                                                              | Use full `fieldId` from `list_dimensions` / `{exploreId}_{metricName}` |
| Server `isError` + empty SELECT                                      | Upstream accepted bad ids with **zero** columns                                                   | Replace with real fieldIds; re-compile once                            |
| SQL “succeeds” but a requested dim/metric is **missing** from SELECT | Invented or wrong fieldId (e.g. non-existent `*_session_day`) while another field still projected | Re-check against `list_dimensions` / metrics map; re-compile           |
| `Metric not found` on `get_metric`                                   | `tableName` was warehouse label                                                                   | Use full explore id                                                    |

Compiled SQL may include **extra related metrics** the semantic layer pulls in — OK if every **requested** fieldId still appears as a SELECT alias.

## Verify after every compile (mandatory)

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

- Empty SELECT / unknown field id / missing alias → fix fieldIds from `list_dimensions` + explore-local metrics; re-compile (≤2 retries).
- Wrong explore → re-disambiguate (`schemaName`; exact `label` or `name` `__{table}`; skip empty schema / eda unless asked).
- Catalog empty / metric not found → `get_explore` `tables[baseTable].metrics`; compile as `{exploreId}_{metricName}`.
- Stop after a good verified compile or a clear blocker.
