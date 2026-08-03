# Contributing to `@lightdash-tools/mcp`

Developer guide for this package. For monorepo setup, PR workflow, and quality gates see the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [AGENTS.md](../../AGENTS.md).

End-user install and configuration live in [README.md](./README.md).

## Package layout

| Edit…                                                   | Path                                                                                                                    |
| :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| Shared tools / registry                                 | `src/tools/` (`registry.ts`, domain modules)                                                                            |
| Persona (tools allowlist, prompts, playbook, HTTP path) | `src/personas/<id>/`                                                                                                    |
| Destructive confirmation (form elicitation / MRTR)      | `src/destructive/`                                                                                                      |
| HTTP transport (sessionless)                            | `src/transports/`                                                                                                       |
| HTTP auth / OAuth broker (in-memory pending)            | `src/auth/`                                                                                                             |
| Runtime client + guardrail env                          | `src/config/runtime.ts`                                                                                                 |
| HTTP env / loader                                       | `src/config/env.ts`, `src/config/load-mcp-config.ts`                                                                    |
| OAuth broker (in-memory pending)                        | `src/auth/oauth-broker/` ([ADR-0019](../../docs/adr/0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)) |
| Audit logging helpers                                   | `src/audit/`                                                                                                            |
| Entrypoints                                             | `src/bin.ts`, `src/index.ts` (stdio), `src/http.ts`                                                                     |

Prompts and resources are **persona-owned** (e.g. `src/personas/semantic-layer/v1/`). There is no package-level `src/prompts/` or `src/resources/`.

## Architecture overview

One package ships multiple **personas**. Shared tools live under `src/tools/`; each persona selects an explicit `toolIds` allowlist, prompts, playbooks, and a fixed HTTP path ([ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md)). Registration goes through `registerToolsByIds` → `registerToolSafe` → `@lightdash-tools/client`.

```mermaid
flowchart TB
  subgraph clients [MCPClients]
    IDE[Cursor_Claude_IDE]
  end

  subgraph entry [Entrypoints]
    Bin[bin.ts_stdio]
    Http[http.ts_StreamableHTTP]
  end

  subgraph authLayer [Auth]
    PAT[EnvContextProvider]
    OAuthMW[OAuth_middleware]
    OAuthBroker["/oauth/*_in_memory"]
  end

  subgraph mcpCore [MCPCore]
    Persona[PersonaDefinition_toolIds]
    Cap[capabilities.ts]
    Registry[registerToolsByIds]
    Safe[registerToolSafe]
  end

  subgraph upstream [Upstream]
    ClientPkg["@lightdash-tools/client"]
    LD[Lightdash_API]
  end

  IDE --> Bin
  IDE --> Http
  Bin --> PAT
  Http --> OAuthMW
  Http --> OAuthBroker
  OAuthMW --> Persona
  PAT --> Persona
  Persona --> Cap --> Registry --> Safe
  Safe --> ClientPkg --> LD
```

SDK: `@modelcontextprotocol/server` + `@modelcontextprotocol/node` v2. Protocol: [MCP 2026-07-28 transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) (stdio + Streamable HTTP; POST-only MCP endpoints; no protocol sessions).

## Request lifecycle

`registerToolSafe` layers (outer → inner), documented in `src/tools/shared.ts` ([ADR-0008](../../docs/adr/0008-mcp-request-scope-and-hardening.md)):

```mermaid
sequenceDiagram
  participant Client
  participant Audit as AuditWrapper
  participant Scope as ProjectScope
  participant Valid as InputValidation
  participant Handler
  participant API as LightdashAPI

  Client->>Audit: tools/call
  Audit->>Scope: pin_and_allowlist
  alt blocked
    Scope-->>Audit: _lightdashBlocked
    Audit-->>Client: blocked
  else ok
    Scope->>Valid: validateResourceIds
    Valid->>Handler: execute
    Handler->>API: HTTP
    API-->>Handler: response
    Handler-->>Audit: ToolResult
    Audit-->>Client: content
  end
```

Capability surface is the persona `toolIds` list — not CLI `SAFETY_MODE` / dry-run.

## Sequence diagrams

### Stateless HTTP request

Each POST creates a fresh transport + server ([ADR-0019](../../docs/adr/0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md); [MCP statelessness](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#statelessness)):

```mermaid
sequenceDiagram
  participant Client
  participant HttpServer
  participant Transport as FreshTransportPlusServer
  participant Tools

  Client->>HttpServer: POST_persona_path
  HttpServer->>Transport: create_stateless_transport
  Transport->>Tools: tools/call
  Tools-->>Transport: result
  Transport-->>Client: JSON_or_SSE
```

OAuth broker pending/codes/DCR remain **process-local** — sticky-route `/oauth/*` or a single replica for multi-instance. Persona MCP paths can round-robin. Operator details: [docs/operators/mcp-oauth.md](../../docs/operators/mcp-oauth.md).

### content-developer preview gate

HMAC-signed `previewToken` (subject/project/`contentHash`); no server ledger ([`src/policy/preview-ledger.ts`](./src/policy/preview-ledger.ts)):

```mermaid
sequenceDiagram
  participant Agent as MCPClient
  participant MCP as content_developer
  participant LD as LightdashAPI

  Agent->>MCP: preview_chart_changes
  MCP-->>Agent: previewToken_draft

  Agent->>MCP: confirm_preview
  MCP-->>Agent: previewToken_validated

  Agent->>MCP: create_chart_plus_token_plus_proposed
  MCP->>MCP: verify_token_hash_baseline
  MCP->>LD: upsert_chart
  LD-->>MCP: ok
  MCP-->>Agent: success
```

### content-governance elicitation

Form elicitation via MRTR [`InputRequiredResult`](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) + HMAC `requestState` ([`src/destructive/`](./src/destructive/)):

```mermaid
sequenceDiagram
  participant Agent as MCPClient
  participant MCP as content_governance
  participant User as HumanViaClientUI

  Agent->>MCP: delete_chart
  MCP-->>Agent: inputRequired_form
  Agent->>User: show_confirmation_form
  User-->>Agent: decision_plus_typed_name
  Agent->>MCP: delete_chart_plus_elicitation_plus_requestState
  MCP->>MCP: verify_HMAC_requestState
  MCP-->>Agent: soft_delete_complete
```

## Extension points

| Change                      | Where                                                            |
| :-------------------------- | :--------------------------------------------------------------- |
| New shared tool             | `packages/common/src/operations/` + `src/tools/` + `registry.ts` |
| New persona                 | `src/personas/<id>/v1/` + ADR                                    |
| Auth / OAuth                | `src/auth/`                                                      |
| Preview / destructive gates | `src/policy/`, `src/destructive/`                                |

## Testing

From the monorepo root:

```bash
pnpm exec vitest run packages/mcp/src
# or package script (runs the same via filter):
pnpm --filter @lightdash-tools/mcp test
```

Integration tests hit a real Lightdash API when credentials are set:

```bash
LIGHTDASH_URL=https://app.lightdash.cloud LIGHTDASH_API_KEY=your_api_key pnpm --filter @lightdash-tools/mcp test
```

For OAuth HTTP live checks: `LIGHTDASH_TOOLS_TEST_OAUTH_ACCESS_TOKEN` (+ `LIGHTDASH_URL`).

Before commit: `pnpm verify` (or `pnpm verify:quick`) from the repo root — see [AGENTS.md](../../AGENTS.md).

## Related ADRs

- [ADR-0006](../../docs/adr/0006-mcp-personas-shared-registry-fixed-paths.md) — Personas, shared registry, fixed HTTP paths
- [ADR-0007](../../docs/adr/0007-mcp-http-transport-auth-modes-sdk-v2.md) — HTTP transport + OAuth broker (SDK v2)
- [ADR-0008](../../docs/adr/0008-mcp-request-scope-and-hardening.md) — Project pin, input validation, audit
- [ADR-0012](../../docs/adr/0012-mcp-content-reader-persona-saved-content-execution-boundary.md) — Content-reader boundary
- [ADR-0014](../../docs/adr/0014-mcp-content-developer-persona-mutation-boundary.md) — Content-developer preview gate
- [ADR-0015](../../docs/adr/0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md) — Soft-delete elicitation
- [ADR-0018](../../docs/adr/0018-mcp-ai-agent-ops-persona-thin-api-boundary.md) — AI-agent-ops thin API surface
- [ADR-0019](../../docs/adr/0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md) — Stateless HTTP; HMAC handles; no Redis
