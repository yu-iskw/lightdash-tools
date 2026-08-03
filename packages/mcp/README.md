# [@lightdash-tools/mcp](https://www.npmjs.com/package/@lightdash-tools/mcp) <!-- markdown-link-check-disable-line -->

MCP server for Lightdash with **persona-scoped** surfaces: `semantic-layer` (explore/compile), `organization-audit` (read-only org governance), `content-reader` (saved-content discovery + bounded execution), `content-developer` (project-scoped authoring with a hard preview gate), `content-governance` (elicitation-gated soft-delete), and `ai-agent-ops` (thin AI-agent APIs + product evaluation runs). Tools live in a shared registry; each persona selects an explicit `lightdash_*` allowlist, prompts, and playbook. Uses `@lightdash-tools/client` for API access. See [ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md), [ADR-0010](../../docs/adr/0010-mcp-organization-audit-persona-read-only-boundary.md), [ADR-0012](../../docs/adr/0012-mcp-content-reader-persona-saved-content-execution-boundary.md), [ADR-0014](../../docs/adr/0014-mcp-content-developer-persona-mutation-boundary.md), [ADR-0015](../../docs/adr/0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md), and [ADR-0018](../../docs/adr/0018-mcp-ai-agent-ops-persona-thin-api-boundary.md).

Irrecoverable admin deletes, permanent content purge, and broad org mutations stay off MCP — use `@lightdash-tools/client` or the CLI. Reversible content authoring is on `content-developer` only (preview → confirm_preview → apply; 25 tools). Soft-delete of charts/dashboards is on `content-governance` only (form elicitation required).

**Response sensitivity** ([ADR-0011](../../docs/adr/0011-mcp-tool-response-sensitivity-classes.md)): `list_projects` / `get_project` return project metadata only (warehouse/dbt connection secrets are never exposed). Organization-audit tools mask emails by default (`includeEmail=true` to reveal) and redact scheduler destinations by default (`revealDestinations=true` to reveal). There is no global `withSensitive` flag.

## Directory map

| Edit…                                                   | Path                                                                                                                |
| :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| Shared tools / registry                                 | `src/tools/` (`registry.ts`, domain modules)                                                                        |
| Persona (tools allowlist, prompts, playbook, HTTP path) | `src/personas/<id>/`                                                                                                |
| Destructive confirmation (form elicitation / MRTR)      | `src/destructive/`                                                                                                  |
| HTTP transport / sessions                               | `src/transports/`                                                                                                   |
| HTTP auth                                               | `src/auth/`                                                                                                         |
| Runtime client + guardrail env                          | `src/config/runtime.ts`                                                                                             |
| HTTP env / loader                                       | `src/config/env.ts`, `src/config/load-mcp-config.ts`                                                                |
| Ephemeral store (memory/redis)                          | `src/store/` ([ADR-0016](../../docs/adr/0016-mcp-pluggable-ephemeral-store-for-http-preview-sessions-and-oauth.md)) |
| Audit logging helpers                                   | `src/audit/`                                                                                                        |
| Entrypoints                                             | `src/bin.ts`, `src/index.ts` (stdio), `src/http.ts`                                                                 |

Prompts and resources are **persona-owned** (e.g. `src/personas/semantic-layer/v1/`). There is no package-level `src/prompts/` or `src/resources/`.

## Replaces `@lightdash-tools/semantic-layer-mcp`

That package was removed (ADR-0006). Migrate as follows:

| Removed                               | Use instead              |
| ------------------------------------- | ------------------------ |
| `@lightdash-tools/semantic-layer-mcp` | `@lightdash-tools/mcp`   |
| Binary `lightdash-semantic-layer-mcp` | `lightdash-mcp`          |
| HTTP `/mcp` (old)                     | `/semantic-layer/v1/mcp` |
| Unprefixed tool names                 | `lightdash_*`            |

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

| What works                                                      | Gap                                                                                                                                                                                                                       |
| :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server-held confidential client + `{PUBLIC_URL}/oauth/callback` | Full RFC 8707 audience binding on opaque Lightdash tokens                                                                                                                                                                 |
| PRM + broker AS metadata; per-user Bearer to Lightdash          | MCP-local scope enforcement for opaque tokens                                                                                                                                                                             |
| Session binding to `userUuid` / `organizationUuid`              | Multi-instance scale: default in-memory needs sticky routing; opt into Redis via `LIGHTDASH_TOOLS_MCP_STORE=redis` ([ADR-0016](../../docs/adr/0016-mcp-pluggable-ephemeral-store-for-http-preview-sessions-and-oauth.md)) |

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

Register Lightdash redirect URI: `{PUBLIC_URL}/oauth/callback`. Clients: URL only to `/semantic-layer/v1/mcp`, `/organization-audit/v1/mcp`, `/content-reader/v1/mcp`, `/content-developer/v1/mcp`, `/content-governance/v1/mcp`, or `/ai-agent-ops/v1/mcp`.

### Content-governance (destructive soft-delete)

| Required (non-test)                     | Notes                                                                                       |
| :-------------------------------------- | :------------------------------------------------------------------------------------------ |
| `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` | ≥32-byte secret for HMAC-signed opaque `requestState` (not encrypted; fail closed if unset) |
| Client form elicitation                 | Missing capability → `ELICITATION_REQUIRED`; no DELETE / promote                            |

### HTTP shared-key / local (secondary)

| Mode       | Env                                                    |
| :--------- | :----------------------------------------------------- |
| Shared-key | `LIGHTDASH_API_KEY` + `LIGHTDASH_TOOLS_MCP_SHARED_KEY` |
| Local none | `NODE_ENV=development` (not `production`)              |

Obsolete `LIGHTDASH_TOOLS_MCP_AUTH_MODE`, `EXPERIMENTAL_*`, `DANGEROUSLY_*`, and `INSECURE_DEV` vars are **rejected**. Endpoint path is persona-owned (`LIGHTDASH_TOOLS_MCP_PATH` rejected).

### Ephemeral store (HTTP sessions / preview / OAuth)

Start with **memory** (default). Add **Redis** when scaling beyond a single HTTP instance ([ADR-0016](../../docs/adr/0016-mcp-pluggable-ephemeral-store-for-http-preview-sessions-and-oauth.md)).

| Env                             | Default  | Notes                                     |
| :------------------------------ | :------- | :---------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_STORE`     | `memory` | `memory` \| `redis`                       |
| `LIGHTDASH_TOOLS_MCP_REDIS_URL` | —        | Required when `STORE=redis` (fail closed) |

What Redis shares vs what stays local:

| Concern                             | memory        | redis                                                                                               |
| :---------------------------------- | :------------ | :-------------------------------------------------------------------------------------------------- |
| Content-developer preview ledger    | process-local | shared                                                                                              |
| OAuth pending / codes / DCR clients | process-local | shared (full multi-instance OAuth)                                                                  |
| Streamable HTTP session transports  | process-local | process-local + Redis session _index_; sticky or single instance still required for live transports |

Stdio and tests use memory. Production may use memory on a single instance (HTTP logs a multi-instance/restart warning).

See also: [mcp-oauth-http.md](../../docs/mcp-oauth-http.md), [cursor-lightdash-oauth-mcp.md](../../docs/cursor-lightdash-oauth-mcp.md), [cloud-run-mcp-oauth.md](../../docs/cloud-run-mcp-oauth.md), [threat model](../../docs/security/mcp-oauth-threat-model.md).

## Running

### Stdio (local)

For use with Claude Desktop or IDEs, use `npx`:

```bash
npx @lightdash-tools/mcp
# or explicit personas:
npx @lightdash-tools/mcp semantic-layer
npx @lightdash-tools/mcp organization-audit
npx @lightdash-tools/mcp content-reader
npx @lightdash-tools/mcp content-developer
npx @lightdash-tools/mcp content-governance
npx @lightdash-tools/mcp ai-agent-ops
```

Or if installed globally:

```bash
lightdash-mcp
lightdash-mcp organization-audit
lightdash-mcp content-reader
lightdash-mcp content-developer
lightdash-mcp content-governance
lightdash-mcp ai-agent-ops
```

Logging goes to stderr only; stdout is JSON-RPC. Bare `lightdash-mcp` defaults to `semantic-layer`.

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

The server listens on `http://localhost:3100` (or `LIGHTDASH_TOOLS_MCP_HTTP_PORT`). Persona MCP endpoints:

- `POST/GET/DELETE /semantic-layer/v1/mcp`
- `POST/GET/DELETE /organization-audit/v1/mcp`
- `POST/GET/DELETE /content-reader/v1/mcp`
- `POST/GET/DELETE /content-developer/v1/mcp`
- `POST/GET/DELETE /content-governance/v1/mcp`
- `POST/GET/DELETE /ai-agent-ops/v1/mcp`

Register `{PUBLIC_URL}/oauth/callback` in Lightdash. See [mcp-oauth-http.md](../../docs/mcp-oauth-http.md).

**Local Compose (dev):**

- Unauthenticated / PAT smoke: `docker compose -f docker-compose.dev.yml --profile semantic-layer up --build` then Cursor `url: http://localhost:8080/semantic-layer/v1/mcp` (`NODE_ENV=development` + PAT from `.env`).
- Hosted OAuth smoke: expose `:3100` with Cloudflare Tunnel (`cloudflared tunnel --url http://127.0.0.1:3100`), set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in `.env` to the `*.trycloudflare.com` URL, recreate the container, register `{PUBLIC_URL}/oauth/callback` in Lightdash, and point Cursor at `{PUBLIC_URL}/semantic-layer/v1/mcp`. Do not use free ngrok. Details: [cursor-lightdash-oauth-mcp.md](../../docs/cursor-lightdash-oauth-mcp.md).

## Tools

### `semantic-layer` persona

Registers these tools (names prefixed with `lightdash_`):

- **Projects**: `list_projects`, `get_project`
- **Explores**: `list_explores`, `get_explore`, `list_dimensions`, `get_field_lineage`
- **Metrics**: `list_metrics`, `get_metric`
- **Query**: `compile_query` (empty SELECT → `isError`; no run-query)

Prompts and playbook: `lightdash://playbooks/semantic-layer` (cite `lightdash_*` names only).

### `organization-audit` persona

Read-only organization inventory, access, content health, usage signals, and schedulers ([ADR-0010](../../docs/adr/0010-mcp-organization-audit-persona-read-only-boundary.md)). MCP server display name is `lightdash-mcp-org-audit` (60-char client limit). Endpoint inventory: [docs/organization-audit-endpoint-inventory.md](../../docs/organization-audit-endpoint-inventory.md).

- **Inventory**: `get_org_profile`, `list_org_members`, `get_org_member`, `list_org_groups`, `list_org_projects`
- **Access**: `list_org_role_assignments`, `list_custom_roles`, `get_custom_role`, `list_project_roles`, `list_project_direct_access`, `list_space_access`, `resolve_effective_access`
- **Content / health**: `list_content`, `get_dashboard_meta`, `list_validation_results`, `get_project_user_activity`
- **Delivery**: `list_project_schedulers`, `get_scheduler`

Prompts and playbook: `lightdash://playbooks/organization-audit` (host orchestrates multi-step audits via primitives). No mutation, warehouse queries, or user-activity CSV download.

### `content-reader` persona

Project-scoped saved-content consumption ([ADR-0012](../../docs/adr/0012-mcp-content-reader-persona-saved-content-execution-boundary.md)). MCP server display name is `lightdash-mcp-content` (60-char client limit). Endpoint inventory: [docs/content-reader-endpoint-inventory.md](../../docs/content-reader-endpoint-inventory.md).

- **Scope / discovery**: `get_project`, `search_content`, `list_spaces`, `get_space`
- **Metadata**: `get_dashboard`, `get_chart`, `list_project_parameters`, `get_project_parameters`, `explain_content`
- **Execution**: `run_chart`, `run_dashboard_tile` (semantic saved content only; SQL charts disabled by default)
- **Lifecycle**: `get_query_result`, `cancel_query` (session-owned ledger)

Project resolution: `X-Lightdash-Project` → `LIGHTDASH_TOOLS_PROJECT_UUID` → tool `projectUuid`. Prompts and playbook: `lightdash://playbooks/content-reader`.

### `content-developer` persona

Project-scoped content authoring ([ADR-0014](../../docs/adr/0014-mcp-content-developer-persona-mutation-boundary.md)). MCP server display name is `lightdash-mcp-cdev` (60-char client limit). Endpoint inventory: [docs/content-developer-endpoint-inventory.md](../../docs/content-developer-endpoint-inventory.md).

- **Discovery**: `get_project`, `search_content`, `list_spaces`, `get_space`, `get_dashboard`, `get_chart`
- **Preview / confirm / validate / diff**: `preview_chart_changes`, `preview_dashboard_changes`, `preview_content_move`, `confirm_preview`, `validate_chart`, `validate_dashboard`, `compare_chart_versions`, `compare_dashboard_versions`
- **Charts (as-code)**: `create_chart`, `update_chart`, `duplicate_chart`
- **Dashboards (REST)**: `create_dashboard`, `update_dashboard`, `duplicate_dashboard`
- **Layout**: `add_dashboard_tile`, `move_dashboard_tile`, `remove_dashboard_tile`, `resize_dashboard_tile`
- **Spaces**: `list_spaces`, `get_space`, `move_content` (no create/update space; use `preview_content_move` before apply)

Hard gate (25 tools): every SAFE_WRITE requires preview → `confirm_preview` → apply. Apply is claim → mutate → mark applied (not delete-before-I/O); `contentHash` must match the apply payload. Ephemeral preview ledger defaults to `LIGHTDASH_TOOLS_MCP_STORE=memory`; use `redis` for multi-instance HTTP ([ADR-0016](../../docs/adr/0016-mcp-pluggable-ephemeral-store-for-http-preview-sessions-and-oauth.md)). No warehouse execution, SQL authoring, or hard delete in v1. Same project resolution as content-reader. Prompts and playbook: `lightdash://playbooks/content-developer`.

### `content-governance` persona

Project-scoped soft-delete with form elicitation ([ADR-0015](../../docs/adr/0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md)). MCP server display name is `lightdash-mcp-gov` (60-char client limit). Endpoint inventory: [docs/content-governance-endpoint-inventory.md](../../docs/content-governance-endpoint-inventory.md). Client matrix: [docs/content-governance-client-compatibility.md](../../docs/content-governance-client-compatibility.md).

- **Soft-delete**: `delete_chart`, `delete_dashboard` (restorable; permanent purge is client-only)
- **Promote**: `get_dashboard_promote_diff`, elicitation-gated `promote_dashboard` (upstream via Data Ops config)
- **Confirmation**: MCP form elicitation (`decision` + typed `confirmationText`) + HMAC-signed opaque `requestState` (do not put secrets in the token payload); fail closed without form capability
- **Not included**: bulk delete, space delete, permanent purge, chart/SQL promote, authoring, warehouse queries

Prompts and playbooks: `lightdash://playbooks/content-governance` (core + charts + dashboards topics).

### `ai-agent-ops` persona

Project-scoped thin AI-agent APIs and product evaluation runs ([ADR-0018](../../docs/adr/0018-mcp-ai-agent-ops-persona-thin-api-boundary.md)). MCP server display name is `lightdash-mcp-aops` (60-char client limit). Endpoint inventory: [docs/ai-agent-ops-endpoint-inventory.md](../../docs/ai-agent-ops-endpoint-inventory.md). Distributed loop (MCP + CLI `agentops` + host): [docs/ai-agent-ops-loop.md](../../docs/ai-agent-ops-loop.md).

- **Inventory**: `list_project_agents`, `get_project_agent`
- **Discovery**: `evaluate_agent_readiness`, `get_agent_suggestions`, `get_agent_models`, `get_explore_access_summary`
- **Threads (read)**: `list_agent_threads`, `get_agent_thread` (message bodies redacted by default)
- **Evaluations**: suite CRUD + `run_agent_evaluation` + run list/get

No agent create/update/delete, no thread generate/continue, no offline scorers or Git dataset tools on MCP. Promotion gates stay on CLI `agentops evaluate-gate`. Same project resolution as content-reader. Prompts and playbooks: `lightdash://playbooks/ai-agent-ops`.

### CLI Binary

If installed globally, you can use the `lightdash-mcp` binary:

```bash
lightdash-mcp --help
```

### CLI Options

- `--http` — Run as HTTP server instead of Stdio.
- `stdio` / `semantic-layer` / `organization-audit` / `content-reader` / `content-developer` / `content-governance` / `ai-agent-ops` / `serve-http` — Explicit transport/persona subcommands.

## Safety (persona-first)

MCP safety is **persona-first** ([ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md), [ADR-0008](../../docs/adr/0008-mcp-request-scope-and-hardening.md)):

| Concern      | Mechanism                                                                                                          |
| :----------- | :----------------------------------------------------------------------------------------------------------------- |
| Which tools  | Persona `toolIds` in code (including `content-governance` soft-delete)                                             |
| Who          | Auth mode + Lightdash API RBAC                                                                                     |
| Where (HTTP) | Optional `X-Lightdash-Project` pin; content-reader/content-developer also use `LIGHTDASH_TOOLS_PROJECT_UUID`       |
| Hardening    | Input validation + audit log + org-audit GET asserts + preview ledger + elicitation/`requestState` for soft-delete |

Process `LIGHTDASH_TOOLS_SAFETY_MODE` / allowlist / dry-run are **CLI-only**, not used by this package.

### Agent-safe surface

See [ADR-0004](../../docs/adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md) and [ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md). Irrecoverable admin deletes and permanent content purge stay on `@lightdash-tools/client` / CLI. Content authoring is limited to `content-developer` ([ADR-0014](../../docs/adr/0014-mcp-content-developer-persona-mutation-boundary.md)). Soft-delete is limited to `content-governance` with form elicitation ([ADR-0015](../../docs/adr/0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md)).

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
