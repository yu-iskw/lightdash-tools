# 41. Compatibility-first MCP TypeScript SDK v2 migration

Date: 2026-07-29

## Status

Accepted

## Context

`@lightdash-tools/mcp` must migrate off the monolithic `@modelcontextprotocol/sdk` ^1.29.0 onto the split SDK packages `@modelcontextprotocol/server@2.0.0` and `@modelcontextprotocol/node@2.0.0` (with `hono` as a peer for HTTP). Claude Code and Cursor connectivity must keep working through the cutover.

SDK v2 also introduces modern serving helpers (`serveStdio`, `createMcpHandler`) and newer protocol eras (including 2026-07-28). Adopting those by default would change transport wiring, session behavior, and host compatibility in one release. A permanent dual stack of v1 and v2 packages would increase maintenance cost without a clear end state.

## Decision

Use a **compatibility-first staged migration**:

1. **First production release** pins exact v2 packages (`@modelcontextprotocol/server@2.0.0`, `@modelcontextprotocol/node@2.0.0`, plus required peers such as `hono`).
2. **Stdio** continues to use legacy-era serving via `server.connect(StdioServerTransport)` (imports from `@modelcontextprotocol/server`).
3. **HTTP** keeps the existing stateful `NodeStreamableHTTPServerTransport` path (from `@modelcontextprotocol/node`) and custom auth/session handling from ADR-0017 / ADR-0040.
4. **Do not** adopt `serveStdio`, `createMcpHandler`, or the 2026-07-28 protocol era by default in this release.
5. **Defer** modern dual-era serving and helper-based transports to a follow-up ADR/RFC once hosts and our HTTP auth/session model are validated against those APIs.

## Consequences

- **Positive**: Host connectivity preserved; auth/session invariants from ADR-0017 and ADR-0040 unchanged; no permanent v1/v2 dual dependency stack; rollback is redeploying the previous package version.
- **Negative**: Custom HTTP transport and legacy connect path remain until a follow-up; modern SDK serving helpers are unused initially.
- **Risks**: Follow-up work is required before claiming full “SDK v2 idiomatic” serving; package path churn in imports must stay documented so ADRs 0017/0040 remain accurate historically.

## References

- Implementing RFC: [docs/rfc/0041-compatibility-first-mcp-sdk-v2-migration.md](../rfc/0041-compatibility-first-mcp-sdk-v2-migration.md)
- Client compatibility matrix: [docs/compatibility/mcp-clients.md](../compatibility/mcp-clients.md)
- ADR-0017: Phase 2 Streamable HTTP transport and optional auth
- ADR-0040: OAuth-backed Streamable HTTP MCP
- Packages: `@modelcontextprotocol/server@2.0.0`, `@modelcontextprotocol/node@2.0.0`
