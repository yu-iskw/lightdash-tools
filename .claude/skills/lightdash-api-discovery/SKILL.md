---
name: lightdash-api-discovery
description: Deeply discover and understand the Lightdash API spec (docs, OpenAPI, auth, recipes) so you can implement a custom HTTP client. Use when figuring out Lightdash APIs, HTTP client design, API spec, endpoints, auth, or recipes.
---

# SOP: Lightdash API Discovery

## Purpose

Understand the Lightdash API completely and precisely so the team can implement an HTTP client that calls Lightdash APIs correctly. Follow this workflow to produce a structured summary (base URL, auth, endpoints with method/path/body/response, and recipes where relevant) suitable for implementing or extending the client (e.g. `packages/client`).

## Workflow Checklist

- [ ] **Step 1: Preparation**
  - [ ] Read [references/sources.md](references/sources.md) for base URL, auth, and where to find the full spec and recipes.
- [ ] **Step 2: Scope**
  - [ ] Use [references/api-areas.md](references/api-areas.md) to choose which API area(s) the client must support (e.g. Projects, Query).
  - [ ] Decide which API version(s) the client will use (v1, v2, or both) and scope areas accordingly.
- [ ] **Step 3: Discover spec**
  - [ ] Fetch the docs index (e.g. llms.txt) and/or the OpenAPI spec for the chosen area; open the relevant API reference pages.
- [ ] **Step 4: Summarize for client**
  - [ ] For each endpoint needed: method, path, path/query/body parameters, request/response schemas, and error shape; cite OpenAPI or docs. Optionally fill [assets/endpoint-summary-template.md](assets/endpoint-summary-template.md).
  - [ ] Tag each endpoint with its API version (v1 or v2) and use the matching base path and types namespace (`LightdashApi.V1` or `LightdashApi.V2`) when implementing. Use the endpoint-summary template and set **API version** for every endpoint.
- [ ] **Step 5: Recipes**
  - [ ] If the use case involves multi-step flows (e.g. SQL from a saved chart, dashboard audit), follow or reference the [recipes](https://docs.lightdash.com/api-reference/v1/recipes) and [lightdash-api-examples](https://github.com/lightdash/lightdash-api-examples).
- [ ] **Step 6: Validation**
  - [ ] Ensure all endpoints the client will implement are documented with enough precision (types and status codes).

## Detailed Instructions

### 1. Preparation

Read the [sources](references/sources.md) reference for:

- Documentation index URL (discover all docs pages).
- API intro and base path (`/api/v1`).
- Authentication: Personal Access Token (PAT) and header format.
- Where to get the full OpenAPI spec and recipe examples.

### 2. Scope

Use the [API areas](references/api-areas.md) reference to map "what the client should do" to API tags (My Account, Organizations, Projects, Spaces, Roles & Permissions, Query). Pick the area(s) relevant to the current task.

### 3. Discover spec

Fetch or open:

- The docs index (e.g. `https://docs.lightdash.com/llms.txt`) to find relevant pages.
- The OpenAPI spec (swagger.json) for the chosen area, or the specific API reference pages from the docs.

### 4. Summarize for client

For each endpoint the client will implement, document:

- HTTP method and path.
- Path, query, and body parameters (names, types, required/optional).
- Request body schema (when applicable).
- Response schema and status codes.
- Error payload shape (e.g. `ApiErrorPayload`).

Use the [endpoint summary template](assets/endpoint-summary-template.md) for consistent output when helpful.

### 5. Recipes

For workflows that chain multiple endpoints (e.g. extract SQL from a chart, dashboard cleanup, user export), use the [API recipes](https://docs.lightdash.com/api-reference/v1/recipes) and the [lightdash-api-examples](https://github.com/lightdash/lightdash-api-examples) repo. Summarize the sequence of calls and any shared identifiers (e.g. project UUID, chart UUID).

### 6. Validation

Before finishing, confirm that every endpoint the client will implement has:

- Exact path and method.
- Parameter and body types.
- Response and error shapes sufficient to implement the client without guessing.

## Success Criteria

- Output is a structured summary (and optionally a filled endpoint-summary template) that is sufficient to implement or extend the HTTP client in this repo without guessing at contracts.
- All referenced endpoints are traceable to the OpenAPI spec or official docs.
- Endpoint summaries and client implementation notes clearly indicate which API version each endpoint belongs to (v1 vs v2).
