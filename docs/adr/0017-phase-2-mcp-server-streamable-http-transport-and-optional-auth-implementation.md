# 17. Phase 2 MCP server: Streamable HTTP transport and optional auth implementation

Date: 2026-02-11

## Status

Accepted

## Context

Phase 2 of the MCP server adds Streamable HTTP as a second transport and optional endpoint auth so that remote deployments can protect the MCP endpoint. ADR-0013 states the high-level decision (Streamable HTTP, optional Bearer/API key middleware, configurable auth). This ADR records the implementation choices for Phase 2.

## Decision

1. **HTTP server**: Use Node built-in `http` module (no Express). Use `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js`.

2. **Session storage**: In-memory map `sessionId -> transport`. On first request without `Mcp-Session-Id` (and with MCP `initialize` in body), create a new transport and server session, generate a session id, store in the map, and return the session id in the response. On subsequent requests, look up the transport by `Mcp-Session-Id` header.

3. **Auth middleware**: Run before the MCP handler. When auth is enabled, require either `Authorization: Bearer <token>` or `X-API-Key` header to match the configured value. Respond with 401 when auth is required and the token/key is missing or invalid. Do not log token or key values.

4. **Config**: `MCP_AUTH_ENABLED` (truthy to enable auth), `MCP_API_KEY` (expected API key or Bearer token value). Load from environment at startup.

5. **Entrypoint**: Separate script (e.g. `dist/http.js`) so that `node dist/index.js` runs Stdio and `node dist/http.js` runs the HTTP server. Same tool set and client as Stdio.

## Consequences

- **Positive**: Same tool set as Stdio; remote deployments can protect the MCP endpoint with a shared secret; local use can run HTTP without auth by leaving `MCP_AUTH_ENABLED` unset.
- **Risks**: In-memory sessions are lost on server restart; single PAT per process (multi-tenant would require a later phase).

## References

- ADR-0013: Implement Lightdash MCP server in packages/mcp using HTTP client (phased transport) (Phase 2 implementation)
- GitHub: Issue #26 (parent), Issue #29 (Phase 2), sub-issues #37–#40
- OpenSpec: `docs/openspec/changes/mcp-server-lightdash-client/`
