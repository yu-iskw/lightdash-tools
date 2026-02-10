# Lightdash API Sources

Use these sources to discover and understand the Lightdash API when implementing an HTTP client.

## Documentation index

Fetch the complete documentation index to discover all available pages:

- **URL**: <https://docs.lightdash.com/llms.txt>
- Use this file to find relevant API reference pages before drilling into specific endpoints.

## API introduction

- **URL**: <https://docs.lightdash.com/api-reference/v1/introduction>
- Describes the public Lightdash API and points to authentication (Personal Access Token).

## Base path

All public API endpoints use a versioned base path. See **API versions** below.

## API versions

The public API is versioned. The same OpenAPI spec (Swagger JSON) contains both v1 and v2 paths; filter by path prefix `/api/v1` or `/api/v2` when discovering by version.

- **v1**
  - Base path: `/api/v1`
  - Full URL: `{Lightdash instance base URL}/api/v1/...`
    Example: `https://app.lightdash.cloud/api/v1/projects/{projectUuid}`
  - Docs intro and recipes: `api-reference/v1/` (e.g. introduction, recipes).
- **v2**
  - Base path: `/api/v2`
  - Example paths: `/api/v2/projects/{projectUuid}/query/metric-query`, `/api/v2/projects/{projectUuid}/query/sql`, `/api/v2/orgs/...`, `/api/v2/saved/...`, `/api/v2/dashboards/...`, `/api/v2/content`, etc.
  - Same Swagger JSON URL lists all paths; use the path prefix to scope to v2.

Authentication is the same for all versions. Client and types in this repo use versioned namespaces (see ADR-0007, ADR-0008).

## Authentication

- **Method**: Personal Access Token (PAT)
- **Header**: `Authorization: ApiKey ldpat_{your_personal_access_token}`
- **Create a token**: [Personal tokens](https://docs.lightdash.com/references/workspace/personal-tokens) (workspace/org docs).
- Use the PAT in every API request; no session cookies required for the API.

## Recipes and multi-step flows

- **Recipes (docs)**: <https://docs.lightdash.com/api-reference/v1/recipes>
- **Examples repo**: <https://github.com/lightdash/lightdash-api-examples>
- Recipes show how to combine multiple endpoints (e.g. fetch chart → extract metricQuery → compile to SQL; dashboard audit; user export). Use these when the HTTP client must support multi-step workflows.

## OpenAPI / full spec

- **Swagger JSON**: <https://raw.githubusercontent.com/lightdash/lightdash/refs/heads/main/packages/backend/src/generated/swagger.json>
- Use this for the complete list of paths, operations, and schemas when you need precise request/response types or to discover all endpoints for an API area (tag).
