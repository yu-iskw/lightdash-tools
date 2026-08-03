# 7. MCP HTTP transport, OAuth broker, SDK v2

Date: 2026-07-31

## Status

Accepted

Amended by [19. MCP stateless protocol core without Redis ephemeral store](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)

## Context

`@lightdash-tools/mcp` must serve STDIO (local agents) and Streamable HTTP (remote). Hosted HTTP needs per-user Lightdash identity. Operators register one Lightdash OAuth application per MCP deployment; the **client secret must not** be shipped to Claude Code / Cursor.

[MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) treats persona MCP paths as OAuth resource servers. The authorization server may be co-located with the resource server. Upstream Lightdash access tokens remain opaque and lack resource/audience binding this process can fully validate.

SDK v2 splits `@modelcontextprotocol/server` and `@modelcontextprotocol/node`. Frozen v1 AS helpers (`mcpAuthRouter`, `ProxyOAuthServerProvider` in `@modelcontextprotocol/server-legacy`) are not adopted. Serving helpers (`serveStdio`, `createMcpHandler`) stay out of scope for host compatibility.

## Decision

1. **Primary HTTP auth:** credential-inferred **OAuth broker + resource server**. Required env: `LIGHTDASH_URL`, `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET`. Shared Lightdash redirect URI: `{PUBLIC_URL}/oauth/callback` (persona-agnostic).
2. **Broker:** MCP host presents AS discovery (`authorization_servers` = `PUBLIC_URL`) and minimal `/oauth/authorize`, `/oauth/callback`, `/oauth/token` (plus a thin DCR stub if clients require registration). It is the confidential client toward Lightdash; MCP clients never receive the client secret.
3. **Resource server:** Persona paths (`/semantic-layer/v1/mcp`, …) accept `Authorization: Bearer`, validate identity via `GET /api/v1/user`, forward the same token upstream. RFC 8707 `resource` is accepted on the broker; full audience enforcement remains limited by opaque Lightdash tokens.
4. **Secondary:** STDIO and local HTTP use PAT (`LIGHTDASH_API_KEY`). Optional `shared-key` gateway when `LIGHTDASH_TOOLS_MCP_SHARED_KEY` is set with a PAT. Unauthenticated HTTP only when `NODE_ENV` is not `production` (e.g. local Compose).
5. **Config surface:** No `LIGHTDASH_TOOLS_MCP_AUTH_MODE` / `EXPERIMENTAL_IDENTITY_OAUTH` / `DANGEROUSLY_*` forest. Infer mode from credentials. Reject obsolete vars at startup with migration errors.
6. **SDK:** Pin exact `@modelcontextprotocol/server@2.0.0` and `@modelcontextprotocol/node@2.0.0` (plus peers such as `hono`). Stdio: `server.connect(StdioServerTransport)`. HTTP: **sessionless** Streamable HTTP (no `Mcp-Session-Id` affinity; [ADR-0019](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)). Do **not** switch to `serveStdio` / `createMcpHandler` without a follow-up decision.
7. **Env naming:** MCP HTTP vars use `LIGHTDASH_TOOLS_MCP_*` / `LIGHTDASH_TOOLS_OAUTH_*` ([ADR-0009](0009-cross-cutting-conventions.md)). Official `LIGHTDASH_URL` / `LIGHTDASH_API_KEY` unchanged.

## Consequences

- Hosted operators configure four primary vars and register one callback in Lightdash; clients use URL-only MCP config.
- Auth extensions (client-credentials, enterprise-managed) are out of scope for this product path.
- Confused-deputy / audience binding remain partially upstream-limited until Lightdash issues resource-bound tokens.
- MCP persona paths are protocol-stateless ([ADR-0019](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)). The in-memory OAuth broker remains process-local — use one replica or sticky `/oauth/*` until signed-state/CIMD.

## References

- [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [SDK v2 Require authorization](https://ts.sdk.modelcontextprotocol.io/v2/serving/authorization.html)
- Operator notes: `docs/mcp-oauth-http.md`, `docs/security/mcp-oauth-threat-model.md`
