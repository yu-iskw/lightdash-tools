# Data-analyst explore

URI: `lightdash://playbooks/data-analyst/explore`

## Goal

Answer a data question by iterating Explore-style queries **without saving** a chart.

## Procedure

1. `get_project` → confirm pin / `projectUuid`.
2. `list_explores` with **`search` + `limit` (≤15)**. Prefer exact `label` or explore `name` containing `__{table}`; skip empty `schemaName` / errors.
3. `get_explore` → lock `exploreId` (= explore `name` = `exploreName` for `run_metric_query`).
4. Shortlist dimensions (`list_dimensions`, base table default) and metrics (`list_metrics` filtered to this explore, or `tables[baseTable].metrics` from `get_explore`).
5. Optional: `compile_query` with the same fieldIds; verify SELECT aliases; ≤2 fix retries.
6. `run_metric_query` with:
   - `exploreName` = locked explore name
   - `dimensions` / `metrics` = full **fieldIds** only (`{table}_{name}`)
   - `filters` (dimensions/metrics only) / `sorts` / `limit` as needed — never send `tableCalculations`
7. If status is running, poll `get_query_result` with the returned `queryUuid`. Cancel with `cancel_query` when abandoning.
8. Iterate: change dims/metrics/filters and re-run. Do **not** create charts unless the user asks to save (then hand off to content-developer).

## Coverage

- `coverage.complete` is true only when query status is `complete` and results are not truncated.
- Cite warnings (`TRUNCATED`, `QUERY_RUNNING`, `QUERY_TIMEOUT`) as first-class evidence.
