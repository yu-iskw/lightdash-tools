# Lightdash API Areas (tags)

The public API is grouped into the following areas (OpenAPI tags). Use this to scope which part of the spec to read when implementing the HTTP client.

| Area                    | Description                                                                                 | Example endpoint                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **My Account**          | Manage the current user's account                                                           | (See docs for account routes)                        |
| **Organizations**       | Manage the organization (most actions admin-only). Each user belongs to one organization.   | Org-level routes under `/api/v1/org/...`             |
| **Projects**            | Manage projects (belong to one org). Users get access via org role or project-level grant.  | `GET /api/v1/projects/{projectUuid}`                 |
| **Spaces**              | Organize charts and dashboards within a project; private spaces restrict access.            | Spaces routes under a project                        |
| **Roles & Permissions** | Manage roles and permissions for the organization.                                          | [Roles](https://docs.lightdash.com/references/roles) |
| **Query**               | Execute and manage queries (metric queries, SQL, query results) against the data warehouse. | Compile/run queries under project and explores       |

## Quick mapping

- **Projects**: List/get/update projects; project config (dbt, warehouse). Example: `GET /api/v1/projects/{projectUuid}` returns `ApiProjectResponse` with `Project` (name, projectUuid, organizationUuid, dbtConnection, warehouseConnection, etc.).
- **Query**: Saved charts, explores, compile query, run query. Example: get saved chart `GET /api/v1/saved/{chartUuid}`; compile metricQuery with `POST /api/v1/projects/{projectUuid}/explores/{exploreName}/compileQuery`.
- **Spaces**: Content organization and access; list/update spaces and items within a project.
- **Organizations**: Org users, settings; e.g. `GET /api/v1/org/users` for user list.
- **My Account**: Current user profile/settings.
- **Roles & Permissions**: Role and permission management; see docs for exact paths.

Use the [OpenAPI spec](https://raw.githubusercontent.com/lightdash/lightdash/refs/heads/main/packages/backend/src/generated/swagger.json) and the [docs index](https://docs.lightdash.com/llms.txt) to get the full list of paths and schemas for any area.
