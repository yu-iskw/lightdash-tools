# Content-reader endpoint inventory

Capability map for the `content-reader` MCP persona (OpenAPI pin in `config/lightdash-openapi-ref.txt`). See [ADR-0012](adr/0012-mcp-content-reader-persona-saved-content-execution-boundary.md) for execution boundaries.

| Capability         | Method | Path                                                              | Client                                | Notes                                                                                                                                     |
| ------------------ | ------ | ----------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Project get        | GET    | `/api/v1/projects/{projectUuid}`                                  | `v1.projects.getProject`              | Scoped to resolved project; omits `warehouseConnection` / `dbtConnection` ([ADR-0011](adr/0011-mcp-tool-response-sensitivity-classes.md)) |
| Content search     | GET    | `/api/v2/content`                                                 | `v2.content.searchContent`            | `projectUuids` forced to resolved project; sortBy: name, space_name, last_updated_at, views                                               |
| Spaces list        | GET    | `/api/v1/projects/{projectUuid}/spaces`                           | `v1.spaces.listSpacesInProject`       | Summary ACL                                                                                                                               |
| Space get          | GET    | `/api/v1/projects/{projectUuid}/spaces/{spaceUuid}`               | `v1.spaces.getSpace`                  | Full ACL + inheritance                                                                                                                    |
| Dashboard get      | GET    | `/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}` | `v2.dashboards.getDashboard`          | Metadata + tile layout; no query execution on GET                                                                                         |
| Chart get          | GET    | `/api/v2/projects/{projectUuid}/saved/{chartUuidOrSlug}`          | `v2.saved.getSavedChart`              | Client method TBD; chart type drives execute eligibility                                                                                  |
| Parameters list    | GET    | `/api/v2/projects/{projectUuid}/parameters/list`                  | `v2.parameters.listProjectParameters` | Client method TBD                                                                                                                         |
| Parameters get     | GET    | `/api/v2/projects/{projectUuid}/parameters`                       | `v2.parameters.getProjectParameters`  | Client method TBD; read by name only                                                                                                      |
| Run saved chart    | POST   | `/api/v2/projects/{projectUuid}/query/chart`                      | `v2.query.runChartQuery`              | Semantic saved charts only; values-only parameter/filter overrides                                                                        |
| Export chart image | POST   | `/api/v1/saved/{chartUuid}/export`                                | `v1.charts.exportChartImagePng`       | Single PNG snapshot (`resultCapability: image_snapshot`); requires headless browser; not CSV/bulk download                                |
| Run dashboard tile | POST   | `/api/v2/projects/{projectUuid}/query/dashboard-chart`            | `v2.query.runDashboardChartQuery`     | Dashboard context + inherited filters; semantic tiles only                                                                                |
| Query results      | GET    | `/api/v2/projects/{projectUuid}/query/{queryUuid}`                | `v2.query.getAsyncQueryResults`       | Client method TBD; bounded paginated rows (`resultCapability: bounded_aggregate_rows`)                                                    |
| Cancel query       | POST   | `/api/v2/projects/{projectUuid}/query/{queryUuid}/cancel`         | `v2.query.cancelAsyncQuery`           | Client method TBD; in-memory ledger v1 correlates handles                                                                                 |

**SQL chart execute (API exists; MCP disabled by default):**

| Capability              | Method | Path                                                       | Client | Notes                                          |
| ----------------------- | ------ | ---------------------------------------------------------- | ------ | ---------------------------------------------- |
| Run SQL chart           | POST   | `/api/v2/projects/{projectUuid}/query/sql-chart`           | —      | Not on MCP allowlist; `CONTENT_NOT_EXECUTABLE` |
| Run dashboard SQL chart | POST   | `/api/v2/projects/{projectUuid}/query/dashboard-sql-chart` | —      | Not on MCP allowlist; `CONTENT_NOT_EXECUTABLE` |

**Excluded:** `POST …/query/metric-query`, `POST …/query/sql`, `POST …/query/underlying-data`, `POST …/query/{queryUuid}/download`, `POST …/query/{queryUuid}/schedule-download`, dashboard `POST /api/v2/dashboards/{dashboardUuid}/exports`, and all content/org/project mutations (create, update, delete, move, bulk-action). Single-chart PNG via `export_chart_image` is allowed (ADR-0012 carve-out).
