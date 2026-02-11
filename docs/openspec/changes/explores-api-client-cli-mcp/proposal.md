# Proposal: Explores API in client, CLI, and MCP

## Why

The Lightdash API exposes explores endpoints (list and get) that exist in the OpenAPI spec but are not exposed in our three main surfaces: the HTTP client (`@lightdash-tools/client`), the CLI (`@lightdash-tools/cli`), and the MCP server (`@lightdash-tools/mcp`). Users and automations cannot list or get explores programmatically, via CLI, or through MCP tools without using raw HTTP.

## What Changes

- **Client**: Add `ExploresClient` (v1) with `listExplores(projectUuid)` and `getExplore(projectUuid, exploreId)`. Expose as `client.v1.explores`.
- **CLI**: Add `projects explores list <projectUuid>` and `projects explores get <projectUuid> <exploreId>`. Output JSON. Follow the same pattern as spaces and charts.
- **MCP**: Add `list_explores` and `get_explore` tools that call the client and return JSON.

**NON-BREAKING**: All changes are additive. No existing APIs or commands are removed or changed.

Optional later (out of scope for this change): set explores (PUT), download CSV from explore, get explore file (git integration).

## Capabilities

### New Capabilities

- **client.v1.explores**: List and get explores for a project using typed methods and OpenAPI-derived types.
- **CLI**: `projects explores list` and `projects explores get` for discovery and inspection from the command line.
- **MCP**: `list_explores` and `get_explore` for AI agents and tooling to discover and inspect explores.

## Impact

- **Code**: New file `packages/client/src/api/v1/explores.ts`; new CLI command module `packages/cli/src/commands/explores.ts`; new MCP tools module `packages/mcp/src/tools/explores.ts`. Wiring in client.ts, cli index, and MCP tools index.
- **User Experience**: Users can list and get explores from scripts, CLI, and MCP.
- **Developer Experience**: Single pattern (typed client); types from OpenAPI.

## References

- ADR-0022: Support Lightdash explores API across client, CLI, and MCP
- GitHub Issue: [#52](https://github.com/yu-iskw/lightdash-tools/issues/52) <!-- markdown-link-check-disable-line -->
