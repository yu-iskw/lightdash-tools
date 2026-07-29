# RFC 0041: Compatibility-first MCP TypeScript SDK v2 migration

> **Status:** Accepted (implementation in progress / this PR)  
> **Date:** 2026-07-29  
> **Target package:** `packages/mcp` (`@lightdash-tools/mcp`)  
> **ADR:** [ADR-0041](../adr/0041-compatibility-first-mcp-typescript-sdk-v2-migration.md)

---

## Decision

Migrate `@lightdash-tools/mcp` off the monolithic `@modelcontextprotocol/sdk` onto exact pins:

| Package                            | Version |
| ---------------------------------- | ------- |
| `@modelcontextprotocol/server`     | `2.0.0` |
| `@modelcontextprotocol/node`       | `2.0.0` |
| `@modelcontextprotocol/client`     | `2.0.0` (devDependency / tests) |

Preserve the **legacy-era** protocol path used by current hosts:

- **Stdio:** `server.connect(new StdioServerTransport())` — do **not** adopt `serveStdio` yet.
- **HTTP:** keep stateful `NodeStreamableHTTPServerTransport` + existing auth/session model (ADR-0017 / ADR-0040) — do **not** adopt `createMcpHandler` yet.
- Speak the established **2025-era** MCP protocol by default (not 2026-07-28 unless a future opt-in flag).

## Import mapping (v1 → v2)

| v1 (`@modelcontextprotocol/sdk`)                         | v2                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `@modelcontextprotocol/sdk/server/mcp.js` (`McpServer`, `ResourceTemplate`) | `@modelcontextprotocol/server`                                        |
| `@modelcontextprotocol/sdk/server/completable.js`        | `@modelcontextprotocol/server` (`completable`)                        |
| `@modelcontextprotocol/sdk/server/stdio.js`              | `@modelcontextprotocol/server/stdio`                                  |
| `@modelcontextprotocol/sdk/server/streamableHttp.js` (`StreamableHTTPServerTransport`) | `@modelcontextprotocol/node` (`NodeStreamableHTTPServerTransport`) |
| `@modelcontextprotocol/sdk/client/index.js`              | `@modelcontextprotocol/client`                                        |
| `@modelcontextprotocol/sdk/inMemory.js`                  | `@modelcontextprotocol/server` (`InMemoryTransport`)                  |

## Non-goals (Phase 6 — deferred)

- `createMcpHandler` / `serveStdio` / dual-era or modern protocol mode flags
- Default negotiation of protocol era `2026-07-28`
- Express/Hono rewrite of the custom HTTP server
- Tool renames, auth-model changes, or permanent v1+v2 dual dependency stack

## Client compatibility requirements

Before release, qualify against:

| Client      | Transports to verify      |
| ----------- | ------------------------- |
| Claude Code | stdio + Streamable HTTP   |
| Cursor      | stdio + Streamable HTTP   |

Track results in [docs/compatibility/mcp-clients.md](../compatibility/mcp-clients.md). Automated tests cover protocol/transport wiring; they do **not** replace real-client OAuth UX checks.

## Appendix A — Claude Code stdio smoke config

Build first (`pnpm --filter @lightdash-tools/mcp build`), then point Claude Code at the absolute path of `packages/mcp/dist/bin.js`:

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["/absolute/path/to/repo/packages/mcp/dist/bin.js"],
      "env": {
        "LIGHTDASH_URL": "https://app.lightdash.cloud",
        "LIGHTDASH_API_KEY": "${LIGHTDASH_API_KEY}"
      }
    }
  }
}
```

Smoke: list tools (expect `ldt__*` names), call a read-only tool such as `ldt__list_projects`.

## Appendix B — Cursor stdio smoke config

Project `.cursor/mcp.json` or global `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["/absolute/path/to/repo/packages/mcp/dist/bin.js"],
      "env": {
        "LIGHTDASH_URL": "https://app.lightdash.cloud",
        "LIGHTDASH_API_KEY": "${env:LIGHTDASH_API_KEY}"
      }
    }
  }
}
```

Completely quit and reopen Cursor after changing MCP config. For Streamable HTTP / OAuth, see [cursor-lightdash-oauth-mcp.md](../cursor-lightdash-oauth-mcp.md).
