# 2. Lightdash HTTP client

Date: 2026-02-10

## Status

Accepted

## Context

We need a supported way to call the Lightdash API from this repository (CLI, MCP, automation). Organization API discovery is done; we need a single place for API contracts, authentication, and transport so that consumers do not duplicate logic or guess at endpoints.

## Decision

We will use a dedicated HTTP client in `packages/client` with:

- Personal Access Token (PAT) authentication only; header `Authorization: ApiKey ldpat_{token}`.
- Typed methods per API area; first area is Organizations (get/update org, list members/projects/groups, create org, delete member; optional list allowed organizations).
- Native `fetch`, JSON request/response, and centralized error handling (Lightdash ApiErrorPayload when present).

Full design, requirements, and scenarios are specified in OpenSpec: [docs/openspec/changes/lightdash-http-client/](../openspec/changes/lightdash-http-client/).

## Consequences

- API contracts and auth live in one place; other packages (cli, mcp) will depend on `@lightdash-tools/client` for Lightdash API access.
- Implementation will follow the OpenSpec change (proposal, specs, design); tasks and code are not yet written.
