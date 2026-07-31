# Organization-audit endpoint inventory

Capability map for the `organization-audit` MCP persona (OpenAPI pin in `config/lightdash-openapi-ref.txt`).

| Capability               | Method | Path                                                | Client                                      | Notes                                          |
| ------------------------ | ------ | --------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Org profile              | GET    | `/api/v1/org`                                       | `v1.organizations.getCurrentOrganization`   | Bind to session; never accept foreign org UUID |
| Current user             | GET    | `/api/v1/user`                                      | `v1.users.getAuthenticatedUser`             | `organizationUuid`, `role`, `roleUuid`         |
| Members list             | GET    | `/api/v1/org/users`                                 | `v1.users.listMembers`                      | Knex pagination                                |
| Member get               | GET    | `/api/v1/org/users/{userUuid}`                      | `v1.users.getMemberByUuid`                  | Deprecated in OpenAPI; still used              |
| Groups                   | GET    | `/api/v1/org/groups`                                | `v1.groups.listGroups`                      | Optional `includeMembers`                      |
| Projects                 | GET    | `/api/v1/org/projects`                              | `v1.projects.listProjects`                  | No pagination                                  |
| Org role assignments     | GET    | `/api/v2/orgs/{orgUuid}/roles/assignments`          | `v2.organizationRoles.listRoleAssignments`  | Session org only                               |
| Roles list               | GET    | `/api/v2/orgs/{orgUuid}/roles`                      | `v2.organizationRoles.getRoles`             | Custom + system                                |
| Role detail              | GET    | `/api/v2/orgs/{orgUuid}/roles/{roleUuid}`           | `v2.organizationRoles.getRole`              | Includes scopes                                |
| Project role assignments | GET    | `/api/v2/projects/{projectId}/roles/assignments`    | `v2.projectRoleAssignments.listAssignments` |                                                |
| Project direct access    | GET    | `/api/v1/projects/{projectUuid}/access`             | `v1.projectAccess.listProjectAccess`        | Direct grants only                             |
| Spaces list              | GET    | `/api/v1/projects/{projectUuid}/spaces`             | `v1.spaces.listSpacesInProject`             | Summary ACL                                    |
| Space get                | GET    | `/api/v1/projects/{projectUuid}/spaces/{spaceUuid}` | `v1.spaces.getSpace`                        | Full ACL + inheritance                         |
| Content                  | GET    | `/api/v2/content`                                   | `v2.content.searchContent`                  | Views / lastViewedAt                           |
| Dashboard meta           | GET    | `/api/v2/projects/{projectUuid}/dashboards/{id}`    | `v2.dashboards.getDashboard`                | No query execution                             |
| Validation               | GET    | `/api/v2/projects/{projectUuid}/validate`           | `v2.validation.listValidationResults`       |                                                |
| User activity            | GET    | `/api/v1/analytics/user-activity/{projectUuid}`     | `v1.analytics.getUserActivity`              | Replaces missing unused-content                |
| Schedulers list          | GET    | `/api/v1/schedulers/{projectUuid}/list`             | `v1.schedulers.listSchedulers`              | Prefer over per-resource                       |
| Scheduler get            | GET    | `/api/v1/schedulers/{schedulerUuid}`                | `v1.schedulers.getScheduler`                | Redact destinations by default                 |

**Excluded:** `POST /api/v1/analytics/user-activity/{projectUuid}/download` (bulk CSV export).
