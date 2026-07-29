# MCP client compatibility matrix

Real-client qualification is **mandatory before release**. Automated Vitest suites cover protocol handshake and transport wiring (stdio process smoke, in-memory `tools/list`); they do **not** exercise full IDE OAuth UX (browser redirects, token refresh, Cursor/Claude Code session binding).

Fill in **Client version**, **stdio**, **HTTP**, and **OAuth** after manual smoke checks. Use `Pass` / `Fail` / `Pending` / `N/A`.

| Date       | Server version      | SDK   | Client      | Client version |   stdio |    HTTP |   OAuth | Notes                       |
| ---------- | ------------------- | ----- | ----------- | -------------- | ------: | ------: | ------: | --------------------------- |
| 2026-07-29 | 0.6.0 (pre-release) | 2.0.0 | Claude Code | TBD            | Pending | Pending | Pending | Legacy-era SDK v2 migration |
| 2026-07-29 | 0.6.0 (pre-release) | 2.0.0 | Cursor      | TBD            | Pending | Pending | Pending | Legacy-era SDK v2 migration |

## How to run smoke checks

1. Build the MCP package: `pnpm --filter @lightdash-tools/mcp build`
2. Use an **absolute** path to `packages/mcp/dist/bin.js` in the client config (see [RFC-0041 appendices](../rfc/0041-compatibility-first-mcp-sdk-v2-migration.md)).
3. Set `LIGHTDASH_URL` and `LIGHTDASH_API_KEY` (stdio / shared-key). Prefer env injection from the host; do not commit secrets.

### Claude Code (stdio)

Add an `mcpServers.lightdash` entry with `command: "node"` and `args: ["<repo>/packages/mcp/dist/bin.js"]` plus env vars. Confirm tools list shows `ldt__*` and a read-only call (e.g. `ldt__list_projects`) succeeds.

### Cursor (stdio)

Same shape in `.cursor/mcp.json` or `~/.cursor/mcp.json`. Quit and reopen Cursor after edits. Confirm tools list and a read-only tool call.

### Streamable HTTP / OAuth

For remote HTTP and experimental `lightdash-oauth`, follow [mcp-oauth-http.md](../mcp-oauth-http.md) and [cursor-lightdash-oauth-mcp.md](../cursor-lightdash-oauth-mcp.md). Record OAuth column results separately from plain HTTP `none` / `shared-key`.

## Related

- [RFC-0041](../rfc/0041-compatibility-first-mcp-sdk-v2-migration.md)
- [ADR-0041](../adr/0041-compatibility-first-mcp-typescript-sdk-v2-migration.md)
