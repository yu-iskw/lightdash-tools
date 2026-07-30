# [@lightdash-tools/mcp](https://www.npmjs.com/package/@lightdash-tools/mcp) <!-- markdown-link-check-disable-line -->

MCP server for Lightdash **semantic-layer** discovery and query composition (compile only). Tools live in a shared registry; the shipped `semantic-layer` persona selects nine `ldt__*` tools, prompts, and a playbook. Uses `@lightdash-tools/client` for API access. See [ADR-0042](../../docs/adr/0042-shared-mcp-tool-registry-and-persona-manifests-with-fixed-paths.md).

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

Prompts and resources are **persona-owned** (e.g. `src/personas/semantic-layer/`). There is no package-level `src/prompts/` or `src/resources/`.

## Replaces `@lightdash-tools/semantic-layer-mcp`

That package was removed (ADR-0042). Migrate as follows:

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
- Client qualification matrix: [docs/compatibility/mcp-clients.md](../../docs/compatibility/mcp-clients.md).

### Production limitations (`lightdash-oauth`)

`LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth` is **experimental identity-only OAuth**, not full [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) resource-server OAuth.

| What works                                                | What is missing                                                                  |
| :-------------------------------------------------------- | :------------------------------------------------------------------------------- |
| Per-user `Authorization: Bearer` propagation to Lightdash | Proof the token was issued **for this MCP resource/audience**                    |
| `GET /api/v1/user` identity validation                    | MCP-local `mcp:read` / `mcp:write` scope enforcement for opaque Lightdash tokens |
| Session binding to `userUuid` / `organizationUuid`        | Confused-deputy protection against tokens issued to other OAuth clients          |

**Authorization model in this mode:** Lightdash RBAC + process-level `LIGHTDASH_TOOLS_SAFETY_MODE` (production defaults to `read-only`) + `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`. Do not rely on MCP-local OAuth scopes.

Production requires `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1`. Non-read-only safety modes require `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_WRITE_IN_IDENTITY_OAUTH=1`. See [mcp-oauth-http.md](../../docs/mcp-oauth-http.md) and [lightdash-oauth-upstream-contract.md](../../docs/agent-context/lightdash-oauth-upstream-contract.md).

## Environment variables

Preferred names use the `LIGHTDASH_TOOLS_*` / `LIGHTDASH_TOOLS_MCP_*` prefixes (see ADR-0035). Prefer env vars from the parent process. Avoid plaintext `.env` when AI agents have file access. If using `.env`, use [dotenvx](https://dotenvx.com/) for encrypted secrets. See [docs/secrets-and-credentials.md](../../docs/secrets-and-credentials.md).

### Stdio

| Required                             | Optional (process guardrails)                                                                |
| :----------------------------------- | :------------------------------------------------------------------------------------------- |
| `LIGHTDASH_URL`, `LIGHTDASH_API_KEY` | `LIGHTDASH_TOOLS_SAFETY_MODE`, `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`, `LIGHTDASH_TOOLS_DRY_RUN` |

Do **not** set `LIGHTDASH_TOOLS_MCP_*` for stdio.

### HTTP `shared-key` (production-ready)

| Required                                                                                                           | Common optional                                                                                            |
| :----------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`, `LIGHTDASH_TOOLS_MCP_AUTH_MODE=shared-key`, `LIGHTDASH_TOOLS_MCP_SHARED_KEY` | `LIGHTDASH_TOOLS_MCP_HTTP_PORT`, `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`, session limits, process guardrails |

### HTTP `lightdash-oauth` (experimental identity-only)

| Required                                                                                                                                                                              | Common optional                                                                                                                                                    |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_URL`, `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`, `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`; in `NODE_ENV=production` also `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1` | `LIGHTDASH_TOOLS_MCP_HTTP_PORT`, `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` (required in production unless any-origin danger flag), token cache TTL, process guardrails |

`LIGHTDASH_API_KEY` is **not** required. Clients send `Authorization: Bearer <access-token>`. Validation is identity-only via `GET /api/v1/user` — not resource/audience binding.

**Do not set in `lightdash-oauth`:** `LIGHTDASH_TOOLS_MCP_PATH`, `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES`, `LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED`, `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES` (startup rejects them).

### Advanced (HTTP)

Session TTL/max/cleanup, body size, host bind, and danger/experimental overrides (`DANGEROUSLY_*`, `VALIDATE_TOKEN`, insecure public URL, write-in-identity-oauth) are documented in [mcp-oauth-http.md](../../docs/mcp-oauth-http.md).

Legacy `MCP_*` aliases still warn and map to `LIGHTDASH_TOOLS_MCP_*`; migrate before a future minor removes them.

Endpoint path is persona-owned: `/semantic-layer/v1/mcp` (setting `LIGHTDASH_TOOLS_MCP_PATH` is rejected).

See also:

- [OAuth HTTP operator guide](../../docs/mcp-oauth-http.md)
- [Cursor remote MCP setup](../../docs/cursor-lightdash-oauth-mcp.md)
- [Cloud Run deployment](../../docs/cloud-run-mcp-oauth.md)
- [OAuth threat model](../../docs/security/mcp-oauth-threat-model.md)

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
# Backward-compatible
npx @lightdash-tools/mcp --http

# Explicit subcommand
npx @lightdash-tools/mcp serve-http

# Experimental hosted OAuth mode (identity-only; not production-grade MCP OAuth yet)
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_MCP_AUTH_MODE="lightdash-oauth"
export LIGHTDASH_TOOLS_MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH="1"
npx @lightdash-tools/mcp serve-http
```

The server listens on `http://localhost:3100` (or `LIGHTDASH_TOOLS_MCP_HTTP_PORT`). MCP endpoint: `POST/GET/DELETE /semantic-layer/v1/mcp` (persona-owned fixed path; `/mcp` returns 404). Sessions are created on first `initialize`; subsequent requests must include the `Mcp-Session-Id` header returned by the server.

**Local Compose (dev):** `docker compose -f docker-compose.dev.yml --profile semantic-layer up --build` then Cursor `url: http://localhost:8080/semantic-layer/v1/mcp`.

**Auth modes (HTTP):** default is `none` (unauthenticated endpoint; startup warning). For **production** use `shared-key`. `lightdash-oauth` is experimental identity-only OAuth — see [mcp-oauth-http.md](../../docs/mcp-oauth-http.md).

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
- `--safety-mode <mode>` — Filter registered tools by safety mode (`read-only`, `write-idempotent`, `write-destructive`). Tools not allowed in this mode will not be registered, hiding them from AI agents (Static Filtering).
- `--projects <uuids>` — Comma-separated list of allowed project UUIDs (overrides `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`; empty = all allowed).
- `--dry-run` — Simulate write operations without executing them (overrides `LIGHTDASH_TOOLS_DRY_RUN`).

## Safety Modes

The MCP server implements a hierarchical safety model. You can control which tools are available to AI agents using the `LIGHTDASH_TOOLS_SAFETY_MODE` environment variable or the `--safety-mode` CLI option.

- `read-only` (default): Only allows non-modifying tools (e.g., `list_*`, `get_*`).
- `write-idempotent`: Allows read tools and non-destructive writes (e.g., `upsert_chart_as_code`).
- `write-destructive`: Allows reversible destructive tools (e.g., `delete_group`, `delete_project_agent`). Irrecoverable ops are not registered on MCP at all.

### Enforcement Layers

1. **Dynamic Enforcement (Visible but Disabled)**: Using `LIGHTDASH_TOOLS_SAFETY_MODE` environment variable. Tools are registered and visible to the agent, but return an error if called. This allows agents to understand that a capability exists but is restricted.
2. **Static Filtering (Hidden)**: Using the `--safety-mode` CLI option. Tools not allowed in the selected mode are not registered at all. They are completely hidden from the AI agent.

When a tool is disabled via dynamic enforcement, the server will return a descriptive error message if an agent attempts to call it.

### Agent-safe surface and destructive tools

See [ADR-0037](../../docs/adr/0037-agent-safe-mcp-cli-surface.md). Irrecoverable operations (e.g. removing an org member) are **not** MCP tools — use `@lightdash-tools/client` instead.

Reversible destructive tools (`destructiveHint: true`, e.g. `delete_group`) remain on MCP. MCP clients should prompt before executing them; agents should obtain explicit confirmation. `--safety-mode` filters reversible destructive tools but does not substitute for excluding irrecoverable ops from the surface.

### Input validation

Resource IDs (project UUIDs, slugs) are validated before execution. Invalid inputs (control characters, `?`, `#`, `%`, path traversal) are rejected. This guards against adversarial or hallucinated inputs when used by AI agents. See [docs/agent-context/CONTEXT.md](../../docs/agent-context/CONTEXT.md) for agent-specific guidance.

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
