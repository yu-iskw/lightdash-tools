# [@lightdash-tools/mcp](https://www.npmjs.com/package/@lightdash-tools/mcp) <!-- markdown-link-check-disable-line -->

MCP server for Lightdash **semantic-layer** discovery and query composition (compile only). Tools live in a shared registry; the shipped `semantic-layer` persona selects nine `ldt__*` tools, prompts, and a playbook. Uses `@lightdash-tools/client` for API access. See [ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md).

Broad admin surfaces (charts, dashboards, users, AI agents, …) are **not** registered on this binary — use `@lightdash-tools/client` or the CLI.

## Directory map

| Edit…                                                   | Path                                                 |
| :------------------------------------------------------ | :--------------------------------------------------- |
| Shared tools / registry                                 | `src/tools/` (`registry.ts`, domain modules)         |
| Persona (tools allowlist, prompts, playbook, HTTP path) | `src/personas/<id>/`                                 |
| HTTP transport / sessions                               | `src/transports/`                                    |
| HTTP auth                                               | `src/auth/`                                          |
| Runtime client + guardrail env                          | `src/config/runtime.ts`                              |
| HTTP env / loader                                       | `src/config/env.ts`, `src/config/load-mcp-config.ts` |
| Audit logging helpers                                   | `src/audit/`                                         |
| Entrypoints                                             | `src/bin.ts`, `src/index.ts` (stdio), `src/http.ts`  |

Prompts and resources are **persona-owned** (e.g. `src/personas/semantic-layer/v1/`). There is no package-level `src/prompts/` or `src/resources/`.

## Replaces `@lightdash-tools/semantic-layer-mcp`

That package was removed (ADR-0006). Migrate as follows:

| Removed                               | Use instead              |
| ------------------------------------- | ------------------------ |
| `@lightdash-tools/semantic-layer-mcp` | `@lightdash-tools/mcp`   |
| Binary `lightdash-semantic-layer-mcp` | `lightdash-mcp`          |
| HTTP `/mcp` (old)                     | `/semantic-layer/v1/mcp` |
| Unprefixed tool names                 | `ldt__*`                 |

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

### SDK / protocol compatibility

- Uses MCP TypeScript SDK v2 (`@modelcontextprotocol/server`, `@modelcontextprotocol/node`).
- Speaks the established 2025-era protocol by default (not `2026-07-28` unless a future flag).
- Hosted OAuth client setup: [docs/cursor-lightdash-oauth-mcp.md](../../docs/cursor-lightdash-oauth-mcp.md). Protocol/auth details: [docs/mcp-oauth-http.md](../../docs/mcp-oauth-http.md).

### Hosted OAuth (primary HTTP)

Auth is **inferred** from credentials ([ADR-0007](../../docs/adr/0007-mcp-http-transport-auth-modes-sdk-v2.md)). The MCP host holds the Lightdash OAuth app client id/secret and brokers login; Claude Code / Cursor use URL-only config. Protocol reference: [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

| What works                                                      | Gap                                                                      |
| :-------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Server-held confidential client + `{PUBLIC_URL}/oauth/callback` | Full RFC 8707 audience binding on opaque Lightdash tokens                |
| PRM + broker AS metadata; per-user Bearer to Lightdash          | MCP-local scope enforcement for opaque tokens                            |
| Session binding to `userUuid` / `organizationUuid`              | Horizontal scale without sticky sessions (in-memory broker/MCP sessions) |

Authorization: Lightdash RBAC + persona tool surface ([ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md)) + optional `X-Lightdash-Project` pin. See [mcp-oauth-http.md](../../docs/mcp-oauth-http.md).

## Environment variables

Preferred names use the `LIGHTDASH_TOOLS_*` prefixes (see [ADR-0009](../../docs/adr/0009-cross-cutting-conventions.md)). Prefer env vars from the parent process. Avoid plaintext `.env` when AI agents have file access. If using `.env`, use [dotenvx](https://dotenvx.com/). See [docs/secrets-and-credentials.md](../../docs/secrets-and-credentials.md).

### Stdio (secondary)

| Required                             | Optional                    |
| :----------------------------------- | :-------------------------- |
| `LIGHTDASH_URL`, `LIGHTDASH_API_KEY` | `LIGHTDASH_TOOLS_AUDIT_LOG` |

Do **not** set OAuth client secrets for stdio. MCP does not use CLI `SAFETY_MODE` / `ALLOWED_PROJECTS` / `DRY_RUN`.

### HTTP OAuth (primary)

| Required                                                                                                                    | Common optional                                     |
| :-------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| `LIGHTDASH_URL`, `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET` | port, `ALLOWED_ORIGINS`, audit log, token cache TTL |

Register Lightdash redirect URI: `{PUBLIC_URL}/oauth/callback`. Clients: URL only to `/semantic-layer/v1/mcp`.

### HTTP shared-key / local (secondary)

| Mode       | Env                                                    |
| :--------- | :----------------------------------------------------- |
| Shared-key | `LIGHTDASH_API_KEY` + `LIGHTDASH_TOOLS_MCP_SHARED_KEY` |
| Local none | `NODE_ENV=development` (not `production`)              |

Obsolete `LIGHTDASH_TOOLS_MCP_AUTH_MODE`, `EXPERIMENTAL_*`, `DANGEROUSLY_*`, and `INSECURE_DEV` vars are **rejected**. Endpoint path is persona-owned (`LIGHTDASH_TOOLS_MCP_PATH` rejected).

See also: [mcp-oauth-http.md](../../docs/mcp-oauth-http.md), [cursor-lightdash-oauth-mcp.md](../../docs/cursor-lightdash-oauth-mcp.md), [cloud-run-mcp-oauth.md](../../docs/cloud-run-mcp-oauth.md), [threat model](../../docs/security/mcp-oauth-threat-model.md).

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
# Backward-compatible
npx @lightdash-tools/mcp --http

# Explicit subcommand
npx @lightdash-tools/mcp serve-http

# Hosted OAuth (server-held Lightdash confidential client)
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export LIGHTDASH_TOOLS_OAUTH_CLIENT_ID="..."
export LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET="..."
npx @lightdash-tools/mcp serve-http
```

The server listens on `http://localhost:3100` (or `LIGHTDASH_TOOLS_MCP_HTTP_PORT`). MCP endpoint: `POST/GET/DELETE /semantic-layer/v1/mcp`. Register `{PUBLIC_URL}/oauth/callback` in Lightdash. See [mcp-oauth-http.md](../../docs/mcp-oauth-http.md).

**Local Compose (dev):**

- Unauthenticated / PAT smoke: `docker compose -f docker-compose.dev.yml --profile semantic-layer up --build` then Cursor `url: http://localhost:8080/semantic-layer/v1/mcp` (`NODE_ENV=development` + PAT from `.env`).
- Hosted OAuth smoke: expose `:3100` with Cloudflare Tunnel (`cloudflared tunnel --url http://127.0.0.1:3100`), set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in `.env` to the `*.trycloudflare.com` URL, recreate the container, register `{PUBLIC_URL}/oauth/callback` in Lightdash, and point Cursor at `{PUBLIC_URL}/semantic-layer/v1/mcp`. Do not use free ngrok. Details: [cursor-lightdash-oauth-mcp.md](../../docs/cursor-lightdash-oauth-mcp.md).

## Tools

The `semantic-layer` persona registers these tools (names prefixed with `ldt__`):

- **Projects**: `list_projects`, `get_project`
- **Explores**: `list_explores`, `get_explore`, `list_dimensions`, `get_field_lineage`
- **Metrics**: `list_metrics`, `get_metric`
- **Query**: `compile_query` (empty SELECT → `isError`; no run-query)

Prompts and playbook: `lightdash://playbooks/semantic-layer` (cite `ldt__*` names only).

### CLI Binary

If installed globally, you can use the `lightdash-mcp` binary:

```bash
lightdash-mcp --help
```

### CLI Options

- `--http` — Run as HTTP server instead of Stdio.
- `stdio` / `serve-http` — Explicit transport subcommands (`serve-http` accepts `--auth-mode`).

## Safety (persona-first)

MCP safety is **persona-first** ([ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md), [ADR-0008](../../docs/adr/0008-mcp-request-scope-and-hardening.md)):

| Concern      | Mechanism                                                                  |
| :----------- | :------------------------------------------------------------------------- |
| Which tools  | Persona `toolIds` in code (shipped: semantic-layer, nine read-only tools)  |
| Who          | Auth mode + Lightdash API RBAC                                             |
| Where (HTTP) | Optional `X-Lightdash-Project` pin                                         |
| Hardening    | Input validation on known ID fields + optional `LIGHTDASH_TOOLS_AUDIT_LOG` |

Process `LIGHTDASH_TOOLS_SAFETY_MODE` / allowlist / dry-run are **CLI-only**, not used by this package.

### Agent-safe surface

See [ADR-0004](../../docs/adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md) and [ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md). Broad admin ops stay on `@lightdash-tools/client` / CLI. The shipped MCP persona is compile/discovery only.

### Input validation

Resource IDs (project UUIDs, slugs) are validated before execution. Invalid inputs (control characters, `?`, `#`, `%`, path traversal) are rejected. See [docs/agent-context/CONTEXT.md](../../docs/agent-context/CONTEXT.md).

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

For OAuth HTTP mode, set `LIGHTDASH_TOOLS_TEST_OAUTH_ACCESS_TOKEN` (and `LIGHTDASH_URL`) to run the optional live OAuth integration test.

## License

Apache-2.0
