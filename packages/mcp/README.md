# [@lightdash-tools/mcp](https://www.npmjs.com/package/@lightdash-tools/mcp) <!-- markdown-link-check-disable-line -->

MCP server for Lightdash with **profile-scoped** surfaces. One package, eight profiles: explore/compile, org audit, saved-content reads, chart/dashboard authoring, soft-delete governance, AI-agent ops, AI-agent chat, and ad-hoc Explore queries. Uses [`@lightdash-tools/client`](https://www.npmjs.com/package/@lightdash-tools/client) for API access. <!-- markdown-link-check-disable-line -->

Developing this package? See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Choose a profile

| Profile              | Use when                                   | HTTP path                    | Stdio `--profile`    | Catalog                                                          |
| :------------------- | :----------------------------------------- | :--------------------------- | :------------------- | :--------------------------------------------------------------- |
| `semantic-layer`     | Explore metrics, compile queries           | `/semantic-layer/v1/mcp`     | `semantic-layer`     | —                                                                |
| `organization-audit` | Read-only org governance                   | `/organization-audit/v1/mcp` | `organization-audit` | [inventory](../../docs/profiles/organization-audit/inventory.md) |
| `content-reader`     | Discover and run saved content             | `/content-reader/v1/mcp`     | `content-reader`     | [inventory](../../docs/profiles/content-reader/inventory.md)     |
| `content-developer`  | Author charts/dashboards (preview gate)    | `/content-developer/v1/mcp`  | `content-developer`  | [inventory](../../docs/profiles/content-developer/inventory.md)  |
| `content-governance` | Soft-delete / promote (form elicitation)   | `/content-governance/v1/mcp` | `content-governance` | [inventory](../../docs/profiles/content-governance/inventory.md) |
| `ai-agent-ops`       | Thin AI-agent APIs + product eval runs     | `/ai-agent-ops/v1/mcp`       | `ai-agent-ops`       | [inventory](../../docs/profiles/ai-agent-ops/inventory.md)       |
| `ai-agent-chat`      | Use existing AI Agents as the current user | `/ai-agent-chat/v1/mcp`      | `ai-agent-chat`      | [inventory](../../docs/profiles/ai-agent-chat/inventory.md)      |
| `data-analyst`       | Unsaved Explore metric queries             | `/data-analyst/v1/mcp`       | `data-analyst`       | [inventory](../../docs/profiles/data-analyst/inventory.md)       |

Tool names are prefixed with `lightdash_`. MCP display names are shortened where needed for client length limits (e.g. `lightdash-mcp-content`).

## Quick start

Commands: `stdio` | `http`. Stdio requires `--profile <id>` (see table). Bare invoke exits with help on stderr. Run `stdio --help` or `http --help` for a live list of profile ids, HTTP paths, and mounted tools.

### Stdio (local)

Required form: `stdio --profile <id>` — no default profile, no profile-as-command.

```bash
npx @lightdash-tools/mcp stdio --profile semantic-layer
npx @lightdash-tools/mcp stdio --profile content-reader
pnpm dlx @lightdash-tools/mcp stdio --profile <id>
```

Required env: `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`. Logs go to **stderr**; stdout is JSON-RPC only ([stdio transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)).

Example Cursor / Claude Desktop config:

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "npx",
      "args": ["-y", "@lightdash-tools/mcp", "stdio", "--profile", "content-reader"],
      "env": {
        "LIGHTDASH_URL": "https://app.lightdash.cloud",
        "LIGHTDASH_API_KEY": "your_pat"
      }
    }
  }
}
```

Or install globally: `npm install -g @lightdash-tools/mcp`, then `lightdash-mcp stdio --profile <id>`.

### Streamable HTTP (remote)

`http` mounts every fixed path from the profile table by default (no `--profile`); clients pick the path in the URL. Optionally restrict mounts with `LIGHTDASH_TOOLS_MCP_PROFILES` (comma-separated profile ids; unset or empty → all).

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export LIGHTDASH_TOOLS_OAUTH_CLIENT_ID="..."
export LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET="..."
npx @lightdash-tools/mcp http
# pnpm one-shot: pnpm dlx @lightdash-tools/mcp http
```

Profile MCP endpoints accept **POST** only ([Streamable HTTP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http); no protocol sessions). Default listen port: `3100` (`LIGHTDASH_TOOLS_MCP_HTTP_PORT`). On Cloud Run / containers, when that env is unset, the platform `PORT` is used.

HTTP process probes (unauthenticated, not MCP tools; always mounted even when `LIGHTDASH_TOOLS_MCP_PROFILES` restricts profile paths). Stdio has no health paths.

| Path                | Typical use                            | Success                       | Failure                           |
| :------------------ | :------------------------------------- | :---------------------------- | :-------------------------------- |
| `GET /health/live`  | Liveness / Compose / Cloud Run startup | `200` `{ "status": "ok" }`    | process down                      |
| `GET /health/ready` | Readiness (shared-key / local `none`)  | `200` `{ "status": "ready" }` | `503` `{ "status": "not ready" }` |

`/health/ready` only checks that a Lightdash API client can be constructed when the process uses an API key. Hosted OAuth mode does not require a key, so ready ≈ live — it does **not** ping upstream Lightdash. Probe recipe: [cloud-run.md](../../docs/operators/cloud-run.md).

- Hosted OAuth (Cursor URL-only): [docs/operators/cursor-claude.md](../../docs/operators/cursor-claude.md)
- Operator guide: [docs/operators/mcp-oauth.md](../../docs/operators/mcp-oauth.md)

Local Compose smoke: `docker compose -f docker-compose.dev.yml up --build` → `http://localhost:8080/semantic-layer/v1/mcp` (Compose healthcheck is `GET /health/live`).

## Configuration

Prefer `LIGHTDASH_TOOLS_*` env from the parent process. Avoid plaintext `.env` when agents can read files; if needed, use [dotenvx](https://dotenvx.com/). See [docs/operators/secrets.md](../../docs/operators/secrets.md).

### Stdio

| Required                             | Optional                                                                                                            |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `LIGHTDASH_URL`, `LIGHTDASH_API_KEY` | `LIGHTDASH_TOOLS_AUDIT_LOG` (file; else stderr JSON), [`LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`](#project-allowlist) |

Do **not** set OAuth client secrets for stdio. MCP ignores CLI `SAFETY_MODE` / `DRY_RUN`.

### HTTP OAuth (primary)

| Required                                                                                                                    | Common optional                                                                                                                                                                                                              |
| :-------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_URL`, `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET` | port, `ALLOWED_ORIGINS`, [`LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS`](#extra-invoke-origins), [`LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`](#project-allowlist), [`LIGHTDASH_TOOLS_MCP_PROFILES`](#profile-allowlist), token cache TTL |

On Cloud Run / hosted HTTP, leave `LIGHTDASH_TOOLS_AUDIT_LOG` unset — tool audits are stderr JSON (`channel: "audit"`) → Cloud Logging. See [cloud-run.md](../../docs/operators/cloud-run.md).

Register Lightdash redirect URI: `{PUBLIC_URL}/oauth/callback`. Clients connect with URL only to a profile path above. Protocol: [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

### Extra invoke origins

Optional private-network hostnames (internal LB, internal DNS) that should advertise their own PRM and token/DCR while Google authorize/callback stay on `PUBLIC_URL`. See [mcp-oauth.md](../../docs/operators/mcp-oauth.md#extra-invoke-origins-private-load-balancer--internal-dns) and [ADR-0027](../../docs/adr/0027-mcp-oauth-extra-invoke-origins.md).

```bash
export LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS="http://mcp.ilb.internal"
```

On those Hosts, leave the client Resource URL empty. Do not point `@modelcontextprotocol/client` v2 at an HTTP extra origin — use public HTTPS.

### Content-developer / content-governance signing

| Required (non-test)                     | Notes                                                                                                                                                                                                     |
| :-------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` | ≥32-byte secret for HMAC `previewToken` / `requestState` (fail closed if unset; not encryption). Required only when `content-developer` or `content-governance` is mounted (including unrestricted HTTP). |

Governance soft-delete needs client form elicitation; missing capability → `ELICITATION_REQUIRED`.

### HTTP shared-key / local (secondary)

| Mode       | Env                                                    |
| :--------- | :----------------------------------------------------- |
| Shared-key | `LIGHTDASH_API_KEY` + `LIGHTDASH_TOOLS_MCP_SHARED_KEY` |
| Local none | `NODE_ENV=development` (not `production`)              |

### Profile allowlist

Optional HTTP-only mount ceiling. Unset or empty → all eight shipped profile paths. Non-empty → only listed profile ids are mounted; other paths (and their path-specific OAuth PRM) 404. Stdio ignores this variable (`stdio --profile` still required).

**Format**

- Comma-separated profile ids from the table above (`semantic-layer`, `content-reader`, …)
- Whitespace around commas is ignored
- No empty segments (double commas are rejected)
- Unknown ids fail at process startup

```bash
export LIGHTDASH_TOOLS_MCP_PROFILES="content-reader,content-developer"
```

Architecture: [ADR-0024](../../docs/adr/0024-mcp-http-profile-mount-allowlist-via-env.md).

### Prompt context policy

Controls how much playbook markdown is embedded into `prompts/get` (progressive disclosure; [ADR-0025](../../docs/adr/0025-mcp-progressive-disclosure-prompt-context-policies.md)).

| Value               | Behavior                                            |
| :------------------ | :-------------------------------------------------- |
| `compact` (default) | Task + critical invariants + resource manifest only |
| `compatible`        | Also embeds required topic playbooks                |
| `embedded`          | Legacy: embeds core + required topics (rollback)    |

```bash
export LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT=compatible
# or
lightdash-mcp stdio --profile content-reader --prompt-context embedded
lightdash-mcp http --prompt-context compact
```

Invalid values fail at startup. Do not infer policy from MCP client names.

### Project allowlist

Optional deployment ceiling shared with the CLI. Unset or empty → unrestricted beyond RBAC, HTTP pin, and tool `projectUuid`. Non-empty → hard allowlist for all profiles.

**Format**

- Comma-separated Lightdash project UUIDs (RFC 4122)
- Whitespace around commas is ignored
- No empty segments (double commas are rejected)
- Invalid UUIDs fail at process startup
- Input is case-insensitive; values are normalized to lowercase

```bash
# Single project
export LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

# Multiple (spaces optional)
export LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa, bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
```

**Semantics**

- Ceiling only — not a default project; tools still need `projectUuid` or an HTTP `X-Lightdash-Project` pin
- When restricted, HTTP pin and every tool `projectUuid` must be in the set
- `list_projects` returns only allowlisted projects; cross-project promote requires upstream targets in the set

Architecture: [ADR-0008](../../docs/adr/0008-mcp-request-scope-and-hardening.md).

Obsolete vars (`AUTH_MODE`, `EXPERIMENTAL_*`, `DANGEROUSLY_*`, `INSECURE_DEV`, `MCP_STORE`, `MCP_REDIS_URL`, free-form `MCP_PATH`) are **rejected**. See [ADR-0019](../../docs/adr/0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md).

## Profiles at a glance

### `semantic-layer`

Projects, explores, metrics, and `compile_query` (no warehouse run). Playbook: `lightdash://playbooks/semantic-layer`.

### `organization-audit`

Read-only inventory, access, content health, usage, and schedulers. No mutations or warehouse queries. Server name: `lightdash-mcp-org-audit`.

### `content-reader`

Project-scoped discovery, metadata, bounded `run_chart` / `run_dashboard_tile`, and `export_chart_image` (PNG). SQL charts off by default. Project: `X-Lightdash-Project` or tool `projectUuid`. Server name: `lightdash-mcp-content`.

### `content-developer`

Author charts (as-code) and dashboards behind preview → `confirm_preview` → apply with HMAC `previewToken`. No warehouse execution or hard delete. Server name: `lightdash-mcp-cdev`.

### `content-governance`

Soft-delete charts/dashboards and elicitation-gated dashboard promote. Permanent purge stays off MCP. Server name: `lightdash-mcp-gov`.

### `ai-agent-ops`

Thin AI-agent inventory, readiness, thread reads, and product evaluation suite/run APIs. No agent CRUD or thread generate on MCP. Server name: `lightdash-mcp-aops`. Loop engineering: [docs/profiles/ai-agent-ops/loop.md](../../docs/profiles/ai-agent-ops/loop.md).

### `ai-agent-chat`

Use existing Lightdash AI Agents as the authenticated Lightdash user. Supports accessible-agent discovery (preferences + AI Router `route_agent`), URL/UUID grounding in playbooks, and the user's own conversation flow (new: `create_agent_thread` with `prompt` → `generate_agent_response`; follow-up: `create_agent_thread_message` → `generate_agent_response`). The profile does not expose AI-agent administration, evaluations, SQL mode, or Lightdash content mutation. The selected Lightdash AI Agent may still use tools configured for that agent. Server name: `lightdash-mcp-aichat`. Inventory: [docs/profiles/ai-agent-chat/inventory.md](../../docs/profiles/ai-agent-chat/inventory.md). Hosted viewer deployments should set `LIGHTDASH_TOOLS_MCP_PROFILES=ai-agent-chat` plus a project UUID ceiling.

### `data-analyst`

Unsaved Explore-style metric queries (`run_metric_query`) with explore discovery and optional `compile_query`. Bounded rows; no chart save. Server name: `lightdash-mcp-analyst`.

## Safety

- **Off MCP:** irrecoverable admin deletes, permanent content purge, broad org mutations — use `@lightdash-tools/client` or the CLI ([ADR-0004](../../docs/adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).
- **Writes:** `content-developer` (preview gate). Soft-delete / promote: `content-governance` (form elicitation). `ai-agent-chat` creates threads/messages and triggers open-world managed-agent generation (nested agent tools stay Lightdash-governed).
- **Redaction:** emails masked unless `includeEmail=true`; scheduler destinations redacted unless `revealDestinations=true`; warehouse/dbt connection secrets never on MCP ([ADR-0011](../../docs/adr/0011-mcp-tool-response-sensitivity-classes.md)).
- **Project scope:** optional HTTP pin `X-Lightdash-Project`, else tool `projectUuid`; optional ceiling [`LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`](#project-allowlist).

Profile tool allowlists are the capability surface — not CLI safety-mode.

## Upstream API failures

When a tool handler throws (for example a Lightdash HTTP/API failure), MCP returns a **tool execution error** (`isError: true`) with structured `{ error: { code, message } }` — not a JSON-RPC protocol error — so clients/models can self-correct ([MCP tools error handling](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling)).

| Code                    | Typical cause                                  |
| :---------------------- | :--------------------------------------------- |
| `RATE_LIMITED`          | HTTP 429                                       |
| `UPSTREAM_TRANSIENT`    | Network errors, 408, 5xx                       |
| `UPSTREAM_NOT_FOUND`    | HTTP 404                                       |
| `UPSTREAM_FORBIDDEN`    | HTTP 403                                       |
| `UPSTREAM_UNSUPPORTED`  | HTTP 501                                       |
| `UPSTREAM_VALIDATION`   | HTTP 400 / 422 (including new required fields) |
| `UPSTREAM_CLIENT_ERROR` | Other 4xx                                      |
| `UPSTREAM_CONTRACT`     | Success HTTP but unexpected response shape     |
| `IMAGE_TOO_LARGE`       | Chart PNG over size limit                      |
| `UPSTREAM_UNKNOWN`      | Non-API throws                                 |

Intentional API upgrades still go through the pinned OpenAPI sync (`config/lightdash-openapi-ref.txt`). This layer only makes runtime drift fail safely and legibly.

## Further reading

- Architecture / contributing — [CONTRIBUTING.md](./CONTRIBUTING.md)
- OAuth operator guide — [docs/operators/mcp-oauth.md](../../docs/operators/mcp-oauth.md)
- Cloud Run — [docs/operators/cloud-run.md](../../docs/operators/cloud-run.md)
- Cursor hosted OAuth — [docs/operators/cursor-claude.md](../../docs/operators/cursor-claude.md)
- Architecture decisions — [docs/adr/](../../docs/adr/)
- MCP transports — [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

## License

Apache-2.0
