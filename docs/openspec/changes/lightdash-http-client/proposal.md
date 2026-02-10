# Proposal: Lightdash HTTP client

## Why

This repository needs a supported, typed way to call the Lightdash API from tooling (CLI, MCP, automation). Organization API discovery is done; we need a single place for API contracts, authentication, and transport so consumers do not duplicate logic or guess at endpoints. This change establishes the design and specifications only; implementation follows in a later change.

## What Changes

- Introduce design and specification artifacts for a Lightdash HTTP client to live in `packages/client`.
- Client will use Personal Access Token (PAT) authentication and target the Lightdash public API base path `/api/v1`.
- First API area in scope: **Organizations** (get/update org, list members/projects/groups, create org, delete member; optional My Account: list allowed organizations).
- No code or dependency changes in this change—documentation only (proposal, specs, design). Tasks and implementation are out of scope.

## Capabilities

### New Capabilities

- `lightdash-http-client`: A typed HTTP client for the Lightdash API. Covers client configuration (base URL, API key), transport (native `fetch`, JSON), authentication (PAT header), error handling (ApiErrorPayload), and the Organizations API surface (endpoints, request/response types, namespaced methods). Future areas (Projects, Query, etc.) will extend this capability.

### Modified Capabilities

- None. No existing specs are changed.

## Impact

- **Future code:** `packages/client` will implement this design; current stub (`greet`) will be replaced or repurposed.
- **Future consumers:** `packages/cli`, `packages/mcp`, and other workspace packages may depend on `@lightdash-ai/client` for Lightdash API access.
- **Dependencies:** No new runtime dependencies planned (native `fetch` on Node 18+). No impact in this docs-only change.
