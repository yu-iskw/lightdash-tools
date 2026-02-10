# Proposal: MCP server in packages/mcp using Lightdash HTTP client

## Why

We need to expose Lightdash (projects, charts, dashboards, spaces, users, groups, query, etc.) to AI hosts (Claude Desktop, IDEs) via the Model Context Protocol (MCP) in a secure and well-governed way. The repository already has a typed HTTP client (`@lightdash-tools/client`) with authentication, rate limiting, retry, and error handling. Implementing the MCP server in `packages/mcp` on top of that client provides a single gateway, reuses governance (rate limit, retry), and keeps credentials and errors under one abstraction.

## What Changes

- **Phase 1 (Stdio)**: Implement an MCP server in `packages/mcp` that runs over Stdio. Configuration (base URL, PAT) comes from environment variables. Tools delegate to `LightdashClient` (projects, charts, dashboards, spaces, users, groups). Errors from the client are mapped to MCP text content; logging uses stderr only.
- **Phase 2 (Streamable HTTP + optional auth)**: Add Streamable HTTP as a second transport. Same tool implementations. Optional middleware validates Bearer token or API key before handling MCP requests; auth is configurable so local use can run without endpoint auth.

**NON-BREAKING**: New package behavior only; no changes to existing CLI or client public API.

## Capabilities

### New Capabilities

- **mcp-server-tools**: The MCP server SHALL expose tools that call `@lightdash-tools/client` for: list/get projects, list/get charts, list/get dashboards, list/get spaces (project-scoped), list/get organization members, list/get groups. Tool input SHALL use Zod schemas; errors SHALL be mapped to MCP content (no stack or tokens).
- **mcp-transport-stdio**: Phase 1 SHALL use Stdio transport only; logging SHALL use stderr only.
- **mcp-transport-http**: Phase 2 SHALL add Streamable HTTP transport with session handling; optional auth middleware SHALL return 401 when auth is required and missing or invalid.

### Modified Capabilities

- **packages/mcp**: Today it exports a placeholder (`greet`). It SHALL export an MCP server entrypoint and SHALL depend on `@lightdash-tools/client` and `@modelcontextprotocol/sdk`.

## Impact

- **Code**: New and updated files in `packages/mcp/src/` (config, server bootstrap, tools, error mapping; Phase 2: HTTP server, auth middleware). New dependency on `@lightdash-tools/client`, `@modelcontextprotocol/sdk`, `zod`.
- **User Experience**: Users can run the MCP server (Stdio or HTTP) and connect from Claude Desktop or other MCP clients to operate Lightdash via tools.
- **Developer Experience**: Single pattern for Lightdash access (client only); MCP layer is thin and testable.

## References

- ADR-0013: Implement Lightdash MCP server in packages/mcp using HTTP client (phased transport)
- GitHub Issue: #26 (parent), sub-issues #27–#30
- OpenSpec (skill): `docs/openspec/changes/develop-mcp-server-ts-skill/`
