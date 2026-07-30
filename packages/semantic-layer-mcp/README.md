# @lightdash-tools/semantic-layer-mcp

MCP server for **semantic-layer discovery and query composition** (compile only). No query execution, content mutation, or AI-agent tools.

Tool surface is **package-is-allowlist**: only handlers registered in code appear in `tools/list`. There is no safety-mode or dry-run filter.

### Registered tools (MVP)

| Area     | Tools                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Projects | `list_projects`, `get_project`                                         |
| Explores | `list_explores`, `get_explore`, `list_dimensions`, `get_field_lineage` |
| Metrics  | `list_metrics`, `get_metric`                                           |
| Query    | `compile_query` (compile only — never runs the warehouse query)        |

Tool names are **unprefixed** (not `ldt__`). Follow the playbook resource `lightdash://playbooks/semantic-layer`.

- `list_explores` returns compact summaries `{ name, label, tags, databaseName?, schemaName? }` with optional `search` / `limit` (defaults: limit 50 with search, 100 without). Always search on large projects; disambiguate near-duplicates by label, schema/database, then tags.
- `list_dimensions` returns compact `{ name, label, table, type, fieldId }` where `fieldId` is `{table}_{name}` for `compile_query` (prefer base-table rows where `table` equals the explore id; short names may compile with an empty `SELECT`).
- Warehouse table names are search hints, not explore IDs. `list_metrics` is catalog-wide—filter `tableName === explore id`; `get_metric` needs that same id (not the warehouse label).

## MCP SDK (v2, compatibility-first)

Follows [ADR-0041](../../docs/adr/0041-compatibility-first-mcp-typescript-sdk-v2-migration.md):

| Choice       | Detail                                                                                 |
| ------------ | -------------------------------------------------------------------------------------- |
| Primary SDK  | Exact `@modelcontextprotocol/server@2.0.0` + `@modelcontextprotocol/node@2.0.0` (HTTP) |
| Stdio        | `server.connect(new StdioServerTransport())` — **not** `serveStdio`                    |
| HTTP         | Stateful `NodeStreamableHTTPServerTransport` — **not** `createMcpHandler`              |
| Protocol era | Host-negotiated (smoke tests use `2024-11-05`)                                         |

## Auth modes

| Transport | Auth                                          | Server env                                                                                                                                                            | Host (Cursor/Claude)                                                                                    |
| --------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **stdio** | PAT                                           | `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`                                                                                                                                  | Inject those env vars                                                                                   |
| **HTTP**  | Lightdash OAuth (identity-only, experimental) | `LIGHTDASH_URL`, `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`, `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`, `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1` in production | `LIGHTDASH_OAUTH_CLIENT_ID` / `LIGHTDASH_OAUTH_CLIENT_SECRET` on the **host** — never on the MCP server |

See [ADR-0040](../../docs/adr/0040-oauth-backed-streamable-http-mcp.md), [mcp-oauth-http.md](../../docs/mcp-oauth-http.md), [cursor-lightdash-oauth-mcp.md](../../docs/cursor-lightdash-oauth-mcp.md).

## Pin a project (`X-Lightdash-Project`)

HTTP only — same as [official Lightdash MCP](https://docs.lightdash.com/references/integrations/lightdash-mcp#pin-a-project-with-the-x-lightdash-project-header). There is no env or CLI pin on this package.

When the header is a **valid project UUID**:

- It is stored on the request context as `governance.pinnedProjectUuid` for upcoming tool handlers to consume (no tools enforce it yet)
- Once `list_projects` / `set_project` are registered, they will be omitted from `tools/list` when pinned
- Invalid UUID values are **ignored** (no pin)
- Access is still enforced by the caller’s Lightdash permissions
- Prompts still require an explicit `projectUuid` argument until tools use the pin

### Cursor (remote HTTP + pin)

```json
{
  "mcpServers": {
    "lightdash-semantic-layer-sales": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "X-Lightdash-Project": "00000000-0000-0000-0000-000000000000"
      }
    }
  }
}
```

(Plus OAuth / discovery as for remote HTTP. Host holds OAuth client credentials.)

## Install / run

```bash
pnpm --filter @lightdash-tools/semantic-layer-mcp build

# Stdio (PAT)
LIGHTDASH_URL=https://app.lightdash.cloud LIGHTDASH_API_KEY=... \
  node packages/semantic-layer-mcp/dist/bin.js stdio

# HTTP (OAuth resource server)
LIGHTDASH_URL=https://app.lightdash.cloud \
LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://mcp.example.com \
LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth \
LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1 \
  node packages/semantic-layer-mcp/dist/bin.js serve-http
```

### Docker (stdio + PAT)

Build from the **monorepo root** (Docker reads `.dockerignore` from the build context root; this repo keeps a symlink `.dockerignore` → `packages/semantic-layer-mcp/.dockerignore`):

```bash
docker build \
  -f packages/semantic-layer-mcp/Dockerfile \
  -t lightdash-semantic-layer-mcp:local \
  .
```

Image CMD is **stdio only** (`node dist/bin.js stdio`). Rebuild after code changes — Cursor does not rebuild the image.

Required in `./.env` (or the host env Cursor inherits):

| Variable            | Required |
| ------------------- | -------- |
| `LIGHTDASH_URL`     | yes      |
| `LIGHTDASH_API_KEY` | yes      |

The server never loads `.env` itself. Cursor loads it via official STDIO `envFile`; Docker forwards named vars with `-e NAME` (no value).

```json
{
  "mcpServers": {
    "lightdash-semantic-layer-mcp-local": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "LIGHTDASH_URL",
        "-e",
        "LIGHTDASH_API_KEY",
        "lightdash-semantic-layer-mcp:local"
      ],
      "envFile": "${workspaceFolder}/.env"
    }
  }
}
```

This image is **not** for HTTP/OAuth or Cloud Run (`serve-http` remains a separate host/Cloud Run path).

### Cursor (stdio + PAT, host Node)

```json
{
  "mcpServers": {
    "lightdash-semantic-layer": {
      "command": "node",
      "args": ["/absolute/path/to/packages/semantic-layer-mcp/dist/bin.js", "stdio"],
      "env": {
        "LIGHTDASH_URL": "https://app.lightdash.cloud",
        "LIGHTDASH_API_KEY": "<pat>"
      }
    }
  }
}
```

### Cursor (remote HTTP + OAuth)

OAuth client credentials stay in the host config. Point Cursor at your Cloud Run HTTPS URL with Streamable HTTP + Lightdash OAuth discovery (same flow as [cursor-lightdash-oauth-mcp.md](../../docs/cursor-lightdash-oauth-mcp.md), binary `lightdash-semantic-layer-mcp serve-http`).

### Claude Code (stdio)

```bash
claude mcp add --transport stdio \
  -s user lightdash-semantic-layer \
  --env LIGHTDASH_URL=https://app.lightdash.cloud \
  --env LIGHTDASH_API_KEY="<pat>" \
  -- node /absolute/path/to/packages/semantic-layer-mcp/dist/bin.js stdio
```

## Prompts (user-controlled)

| Name                                 | Purpose                                                |
| ------------------------------------ | ------------------------------------------------------ |
| `lightdash_semantic_explore`         | Find explores/metrics/dimensions                       |
| `lightdash_semantic_compose_compile` | Compose a metric query and `compile_query` (never run) |
| `lightdash_semantic_compile_debug`   | Fix compile errors and re-compile                      |

## Playbook resource

| Field | Value                                  |
| ----- | -------------------------------------- |
| Name  | `semantic_layer_playbook`              |
| URI   | `lightdash://playbooks/semantic-layer` |
| MIME  | `text/markdown`                        |

## Cloud Run (sketch)

Same shape as [cloud-run-mcp-oauth.md](../../docs/cloud-run-mcp-oauth.md), but:

- CMD: `node packages/semantic-layer-mcp/dist/bin.js serve-http`
- No `LIGHTDASH_TOOLS_SAFETY_MODE` (compile-only fixed tools)
- No OAuth client secrets on the service
- Optional project scope via `X-Lightdash-Project` on each request (not env allowlist)

## Related

- [ADR-0040](../../docs/adr/0040-oauth-backed-streamable-http-mcp.md), [ADR-0041](../../docs/adr/0041-compatibility-first-mcp-typescript-sdk-v2-migration.md)
- [docs/compatibility/mcp-clients.md](../../docs/compatibility/mcp-clients.md)
- [docs/agent-context/CONTEXT.md](../../docs/agent-context/CONTEXT.md)
