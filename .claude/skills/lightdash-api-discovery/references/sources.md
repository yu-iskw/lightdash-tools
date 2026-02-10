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

All public API endpoints use the base path:

- **Base path**: `/api/v1`
- Full URL: `{Lightdash instance base URL}/api/v1/...`  
  Example: `https://app.lightdash.cloud/api/v1/projects/{projectUuid}`

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
