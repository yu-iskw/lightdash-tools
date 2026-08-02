# Semantic-layer — compose & compile

URI: `lightdash://playbooks/semantic-layer/compose-compile`

## Multi-insight composition (“compose N queries”)

When the user asks for several insights on one table/explore:

1. Disambiguate explore once; reuse the same `exploreId` and metric shortlist.
2. Pick **diverse** cuts from available metrics/dims (don’t repeat the same grain N times)—e.g. trend, breakdown by a categorical dim, quality/rate metrics, outcome metrics, acquisition/source—only when those fields exist.
3. Compile each with `lightdash_compile_query`; verify SELECT columns; present **insight title + metric/dimension fieldIds + compiled SQL** (or errors). Do not paste full dimension/explore payloads.
4. Metrics that join other tables may produce large CTE SQL — still OK; mention the join briefly.

## Field IDs and empty SELECT

Prefer `fieldId` from `lightdash_list_dimensions` / `{exploreId}_{metricName}`.

Short names alone are unsafe:

1. Upstream may “succeed” with an **empty `SELECT`** — this server returns **`isError`**. Fix to `fieldId`s and re-compile once.
2. Or hard-error on unknown field id.

Compiled SQL may include **extra related metrics** the semantic layer pulls in — verify columns against the goal; unexpected helpers can be OK if the requested fields are present.

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

`metrics` may be `[]`.

## Recommended sequence

1. Scope: `lightdash_get_project` with the user-given project UUID (do not switch from an org-wide list)
2. Discover: search explores → disambiguate → base-table dimensions (shortlist) + explore-local metrics (`get_explore` metrics map; catalog keyword optional)
3. `lightdash_compile_query` with `fieldId`s (repeat for multi-insight)
4. Verify SELECT columns; stop

## Compose / debug stop criteria

- Deliverable: insight title(s) + fieldIds + compiled SQL (or errors). Never paste full explore/dimension/metric/lineage payloads.
- Stop after a good compile. Re-compile only while debugging (empty SELECT / unknown field id / wrong explore / metric not found).
- Multi-insight: N titled queries with fieldIds + SQL; one explore resolution shared across them.
- Empty SELECT or unknown field id → use fieldIds from `lightdash_list_dimensions` (base table) and re-compile once.
- Wrong explore → re-disambiguate (schemaName; label or name `__{table}`).
- Metric not found / catalog empty → `get_explore` `tables[baseTable].metrics`; `tableName` must be the full explore id; compile as `{exploreId}_{metricName}`.
