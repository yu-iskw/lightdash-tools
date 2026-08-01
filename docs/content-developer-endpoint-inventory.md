# Content-developer endpoint inventory

Capability map for the `content-developer` MCP persona (OpenAPI pin in `config/lightdash-openapi-ref.txt`). See [ADR-0014](adr/0014-mcp-content-developer-persona-mutation-boundary.md) for mutation boundaries and the hard preview gate.

| Capability                  | Method | Path                                                                | Client                                                      | Notes                                                      |
| --------------------------- | ------ | ------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Project get                 | GET    | `/api/v1/projects/{projectUuid}`                                    | `v1.projects.getProject`                                    | Scoped; omits credentials; returns `developerCapabilities` |
| Content search              | GET    | `/api/v2/content`                                                   | `v2.content.searchContent`                                  | Dual-profile with content-reader                           |
| List spaces                 | GET    | `/api/v1/projects/{projectUuid}/spaces`                             | `v1.spaces.listSpacesInProject`                             | Dual-profile                                               |
| Get space                   | GET    | `/api/v1/projects/{projectUuid}/spaces/{spaceUuid}`                 | `v1.spaces.getSpace`                                        | Dual-profile                                               |
| Get dashboard               | GET    | `/api/v2/projects/{projectUuid}/dashboards/{id}`                    | `v2.dashboards.getDashboard`                                | Dual-profile                                               |
| Get chart                   | GET    | `/api/v2/projects/{projectUuid}/saved/{id}`                         | `v2.charts.getSavedChart`                                   | Dual-profile                                               |
| Preview chart/dashboard     | —      | MCP composition                                                     | composed get + local diff                                   | Issues `previewId` (draft)                                 |
| Validate chart              | POST   | `/api/v1/projects/{projectUuid}/validate/chart/{chartUuid}`         | `v1.validation.validateChart`                               | Marks preview validated                                    |
| Validate dashboard          | POST   | `/api/v1/projects/{projectUuid}/validate/dashboard/{dashboardUuid}` | `v1.validation.validateDashboard`                           | Marks preview validated                                    |
| Chart history / version     | GET    | `/api/v1/saved/{chartUuid}/history\|version/{versionUuid}`          | `v1.charts.getChartHistory` / `getChartVersion`             | Local compare                                              |
| Dashboard history / version | GET    | `/api/v1/dashboards/{id}/history\|version/{versionUuid}`            | `v1.dashboards.getDashboardHistory` / `getDashboardVersion` | Local compare                                              |
| Create/update chart         | POST   | `/api/v1/projects/{projectUuid}/code/charts/{slug}`                 | `v1.charts.upsertChartAsCode`                               | Requires validated `previewId`                             |
| Duplicate chart             | —      | MCP composition                                                     | getChartsAsCode + upsertChartAsCode                         | Requires validated `previewId`                             |
| Create dashboard            | POST   | `/api/v1/projects/{projectUuid}/dashboards`                         | `v1.dashboards.createDashboard`                             | Optional `duplicateFrom`; preview-gated                    |
| Update dashboard            | PATCH  | `/api/v2/projects/{projectUuid}/dashboards/{id}`                    | `v2.dashboards.updateDashboard`                             | Full tiles/filters/tabs; preview-gated                     |
| Tile layout ops             | —      | MCP composition                                                     | getDashboard + updateDashboard                              | add/move/remove/resize                                     |
| Create space                | POST   | `/api/v1/projects/{projectUuid}/spaces`                             | `v1.spaces.createSpace`                                     | Preview-gated                                              |
| Update space                | PATCH  | `/api/v1/projects/{projectUuid}/spaces/{spaceUuid}`                 | `v1.spaces.updateSpace`                                     | Preview-gated                                              |
| Move content                | POST   | `/api/v2/content/bulk-action/{projectUuid}/move`                    | `v2.content.bulkMoveContent`                                | Preview-gated                                              |

**Excluded:** `metric-query`, `sql`, `underlying-data`, downloads, hard DELETE chart/dashboard/space, rollback, promote, SQL chart as-code, saved-query execution (`run_chart` — use content-reader).

**Hard gate:** SAFE_WRITE tools require session-owned validated `previewId` matching `contentHash`; apply consumes the id.
