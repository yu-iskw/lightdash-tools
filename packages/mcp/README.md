# [@lightdash-tools/mcp](https://www.npmjs.com/package/@lightdash-tools/mcp) <!-- markdown-link-check-disable-line -->

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

### Optional (both modes)

- `LIGHTDASH_TOOL_SAFETY_MODE` — Safety mode for dynamic enforcement (`read-only`, `write-idempotent`, `write-destructive`). See [Safety Modes](#safety-modes) for details.

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

To hide destructive tools from the agent:

```bash
npx @lightdash-tools/mcp --safety-mode write-idempotent
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

The server registers the following tools (names prefixed with `lightdash_tools__`):

- **Projects**: `list_projects`, `get_project`, `validate_project`, `get_validation_results`
- **Explores**: `list_explores`, `get_explore`, `list_dimensions`, `get_field_lineage`
- **Charts**: `list_charts`, `list_charts_as_code`, `upsert_chart_as_code`
- **Dashboards**: `list_dashboards`
- **Spaces**: `list_spaces`, `get_space`
- **Users**: `list_organization_members`, `get_member`, `delete_member`
- **Groups**: `list_groups`, `get_group`
- **Metrics**: `list_metrics`
- **Schedulers**: `list_schedulers`
- **Tags**: `list_tags`
- **Query**: `compile_query`
- **Content**: `search_content`

### CLI Options

- `--http` — Run as HTTP server instead of Stdio.
- `--safety-mode <mode>` — Filter registered tools by safety mode (`read-only`, `write-idempotent`, `write-destructive`). Tools not allowed in this mode will not be registered, hiding them from AI agents (Static Filtering).

## Safety Modes

The MCP server implements a hierarchical safety model. You can control which tools are available to AI agents using the `LIGHTDASH_TOOL_SAFETY_MODE` environment variable or the `--safety-mode` CLI option.

- `read-only` (default): Only allows non-modifying tools (e.g., `list_*`, `get_*`).
- `write-idempotent`: Allows read tools and non-destructive writes (e.g., `upsert_chart_as_code`).
- `write-destructive`: Allows all tools, including destructive ones (e.g., `delete_member`).

### Enforcement Layers

1. **Dynamic Enforcement (Visible but Disabled)**: Using `LIGHTDASH_TOOL_SAFETY_MODE` environment variable. Tools are registered and visible to the agent, but return an error if called. This allows agents to understand that a capability exists but is restricted.
2. **Static Filtering (Hidden)**: Using the `--safety-mode` CLI option. Tools not allowed in the selected mode are not registered at all. They are completely hidden from the AI agent.

When a tool is disabled via dynamic enforcement, the server will return a descriptive error message if an agent attempts to call it.

### Destructive tools

Tools with `destructiveHint: true` (e.g. `delete_member`) perform irreversible or high-impact actions. MCP clients should show a warning and/or require user confirmation before executing them. AI agents should ask the user for explicit confirmation before calling such tools.

## Testing

This package includes unit tests and integration tests. Integration tests run against a real Lightdash API and are only executed if the required environment variables are set.

### Running unit tests

```bash
pnpm test
```

### Running integration tests

To run tests against a real Lightdash instance, provide your credentials:

```bash
LIGHTDASH_URL=https://app.lightdash.cloud LIGHTDASH_API_KEY=your_api_key pnpm test
```

The integration tests will automatically detect these environment variables and run additional scenarios, such as verifying authentication and tool execution against the live API.

## License

Apache-2.0
