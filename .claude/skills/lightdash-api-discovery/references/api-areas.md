# Lightdash API Areas (tags)

The public API is grouped into the following areas (OpenAPI tags). Use this to scope which part of the spec to read when implementing the HTTP client.

| Area                    | API version | Description                                                                                 | Example endpoint                                                                                                             |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **My Account**          | v1          | Manage the current user's account                                                           | (See docs for account routes)                                                                                                |
| **Organizations**       | v1          | Manage the organization (most actions admin-only). Each user belongs to one organization.   | Org-level routes under `/api/v1/org/...`                                                                                     |
| **Projects**            | v1          | Manage projects (belong to one org). Users get access via org role or project-level grant.  | `GET /api/v1/projects/{projectUuid}`                                                                                         |
| **Spaces**              | v1          | Organize charts and dashboards within a project; private spaces restrict access.            | Spaces routes under a project                                                                                                |
| **Roles & Permissions** | v1, v2      | Manage roles and permissions for the organization.                                          | [Roles](https://docs.lightdash.com/references/roles); v2: `/api/v2/orgs/.../roles`, `/api/v2/projects/.../roles/assignments` |
| **Query**               | v1, v2      | Execute and manage queries (metric queries, SQL, query results) against the data warehouse. | v1: compile/run under project; v2: `/api/v2/projects/{projectUuid}/query/*`                                                  |

## Quick mapping

- **Projects**: List/get/update projects; project config (dbt, warehouse). Example: `GET /api/v1/projects/{projectUuid}` returns `ApiProjectResponse` with `Project` (name, projectUuid, organizationUuid, dbtConnection, warehouseConnection, etc.).
- **Query**: Saved charts, explores, compile query, run query. Example: get saved chart `GET /api/v1/saved/{chartUuid}`; compile metricQuery with `POST /api/v1/projects/{projectUuid}/explores/{exploreName}/compileQuery`. V2 endpoints live under `/api/v2/projects/{projectUuid}/query/*` (e.g. metric-query, sql, chart, dashboard-chart); the client exposes them via `client.v2.query`.
- **Spaces**: Content organization and access; list/update spaces and items within a project.
- **Organizations**: Org users, settings; e.g. `GET /api/v1/org/users` for user list.
- **My Account**: Current user profile/settings.
- **Roles & Permissions**: Role and permission management; see docs for exact paths. V2 adds org and project role assignments and scopes under `/api/v2/orgs/...` and `/api/v2/projects/.../roles/assignments`.

V2 endpoints also cover content (move/bulk-action), schedulers (saved charts, dashboards), parameters, and feature flags. Use the [OpenAPI spec](https://raw.githubusercontent.com/lightdash/lightdash/refs/heads/main/packages/backend/src/generated/swagger.json) and the [docs index](https://docs.lightdash.com/llms.txt) to get the full list of paths and schemas for any area.
