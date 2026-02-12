# @lightdash-tools/mcp

MCP server for Lightdash: exposes projects, charts, dashboards, spaces, users, and groups as tools. Uses `@lightdash-tools/client` for all API access.

## Installation

You can run the MCP server using `npx`:

```bash
npx @lightdash-tools/mcp
```

Or install it globally:

```bash
npm install -g @lightdash-tools/mcp
```

## Transports

- **Stdio** — for local use (e.g. Claude Desktop, IDE). One process per client.
- **Streamable HTTP** — for remote use. Session-based; supports optional endpoint auth.

## Environment variables

### Required (both modes)

- `LIGHTDASH_URL` — Lightdash instance base URL (e.g. `https://app.lightdash.cloud`).
- `LIGHTDASH_API_KEY` — Personal access token or API key.

### Streamable HTTP only

- `MCP_HTTP_PORT` — Port for the HTTP server (default: `3100`).
- `MCP_AUTH_ENABLED` — Set to `1`, `true`, or `yes` to require auth on the MCP endpoint.
- `MCP_API_KEY` — When auth is enabled, requests must send this value via `Authorization: Bearer <MCP_API_KEY>` or `X-API-Key: <MCP_API_KEY>`.

## Running

### Stdio (local)

For use with Claude Desktop or IDEs, use `npx`:

```bash
npx @lightdash-tools/mcp
```

Or if installed globally:

```bash
lightdash-mcp
```

Logging goes to stderr only; stdout is JSON-RPC.

### Streamable HTTP (remote)

```bash
npx @lightdash-tools/mcp --http
```

The server listens on `http://localhost:3100` (or `MCP_HTTP_PORT`). MCP endpoint: `POST/GET/DELETE /mcp`. Sessions are created on first `initialize`; subsequent requests must include the `Mcp-Session-Id` header returned by the server.

With auth disabled (default), any client can call the endpoint. With `MCP_AUTH_ENABLED` set, send `Authorization: Bearer <token>` or `X-API-Key: <key>` matching `MCP_API_KEY`; otherwise the server returns 401.

## Tools

Same set in both modes: `list_projects`, `get_project`, `list_explores`, `get_explore`, `list_charts`, `list_charts_as_code`, `upsert_chart_as_code`, `list_dashboards`, `list_spaces`, `get_space`, `list_organization_members`, `get_member`, `delete_member`, `list_groups`, `get_group`, `compile_query`.

### Destructive tools

Tools with `destructiveHint: true` (e.g. `delete_member`) perform irreversible or high-impact actions. MCP clients should show a warning and/or require user confirmation before executing them. AI agents should ask the user for explicit confirmation before calling such tools.

## License

Apache-2.0
