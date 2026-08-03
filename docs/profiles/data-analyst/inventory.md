# Data-analyst endpoint inventory

Capability map for the `data-analyst` MCP persona (OpenAPI pin in `config/lightdash-openapi-ref.txt`). See [ADR-0020](../../adr/0020-mcp-data-analyst-persona-ad-hoc-metric-query-boundary.md).

| Capability       | Method | Path                                                               | Client                          | Notes                                   |
| ---------------- | ------ | ------------------------------------------------------------------ | ------------------------------- | --------------------------------------- |
| Project get      | GET    | `/api/v1/projects/{projectUuid}`                                   | `v1.projects.getProject`        | Scoped; omits warehouse/dbt credentials |
| Explores list    | GET    | `/api/v1/projects/{projectUuid}/explores`                          | `v1.explores.listExplores`      | Client-side search/limit                |
| Explore get      | GET    | `/api/v1/projects/{projectUuid}/explores/{exploreId}`              | `v1.explores.getExplore`        | Field source of truth                   |
| Dimensions list  | GET    | (derived from explore get)                                         | `v1.explores.listDimensions`    | Prefer base table                       |
| Metrics list     | GET    | `/api/v1/projects/{projectUuid}/dataCatalog/metrics`               | `v1.metrics.listMetrics`        | Filter to explore                       |
| Compile query    | POST   | `/api/v1/projects/{projectUuid}/explores/{exploreId}/compileQuery` | `v1.query.compileQuery`         | SQL only; no warehouse rows             |
| Run metric query | POST   | `/api/v2/projects/{projectUuid}/query/metric-query`                | `v2.query.runMetricQuery`       | Unsaved Explore execute; bounded rows   |
| Query results    | GET    | `/api/v2/projects/{projectUuid}/query/{queryUuid}`                 | `v2.query.getAsyncQueryResults` | Paginated / poll                        |
| Cancel query     | POST   | `/api/v2/projects/{projectUuid}/query/{queryUuid}/cancel`          | `v2.query.cancelAsyncQuery`     | Release budget on cancel                |

**Excluded (v1):** `POST …/query/chart`, `…/dashboard-chart`, `…/sql`, `…/sql-chart`, `…/underlying-data`, `…/field-values`, downloads / schedule-download, metric-query `tableCalculations` / raw SQL, and all content mutations.

**Deprecated — do not use:** `POST /api/v1/projects/{projectUuid}/explores/{exploreId}/runQuery`.
