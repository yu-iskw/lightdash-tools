# 21. MCP profile packaging; catalog tool-membership SSOT

Date: 2026-08-04

## Status

Accepted

Amends [6. MCP personas, shared registry, fixed paths](0006-mcp-personas-shared-registry-fixed-paths.md)

Amends [13. Operation catalog as sole agent-surface SSOT](0013-operation-catalog-as-sole-agent-surface-ssot.md)

## Context

MCP packaging used two parallel membership lists: catalog `CapabilityProfile` tags on operations and hand-maintained persona `toolIds` arrays, kept in sync by parity tests. Catalog ids also drifted from mount ids (`semantic-discovery` vs `semantic-layer`, `org-audit-readonly` vs `organization-audit`), and granular CLI taxonomy tags (`core-lifecycle`, `discovery-readonly`, `conversations`, `evaluations`) diluted the meaning of `profiles`.

The MCP specification does not define “persona” or “profile” ([architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture): Host / Client / Server; Tools, Prompts, Resources). Our packaging is a product choice: one fixed URL path, one `serverInfo.name`, one tool subset. Double-managing that subset is pure drift risk.

### Alternatives considered

| Alternative                                  | Why rejected                                         |
| -------------------------------------------- | ---------------------------------------------------- |
| Keep persona allowlists + catalog tags       | Continues dual maintenance                           |
| Drop catalog `profiles`; keep only `toolIds` | Undermines catalog SSOT (ADR-0013)                   |
| Split `mcpProfiles` vs CLI `tags`            | Extra taxonomy without a consumer beyond schema echo |

## Decision

1. **Rename** the product term **persona → profile** in code, env, envelopes, and docs. HTTP paths and stdio subcommand strings stay mount ids (`/semantic-layer/v1/mcp`, `lightdash-mcp content-reader`).
2. **One profile id space** aligned to mounts: `semantic-layer`, `organization-audit`, `content-reader`, `content-developer`, `content-governance`, `ai-agent-ops`, `data-analyst`. Drop aliases `semantic-discovery` and `org-audit-readonly`.
3. **Drop granular taxonomy tags** (`core-lifecycle`, `discovery-readonly`, `conversations`, `evaluations`). `profiles` means MCP mount membership only.
4. **Membership rule:** `profiles` lists mounts that expose the op when `mcp.taskSupport.exposed === true`; otherwise `profiles` may be empty (CLI-only / reserved).
5. **Catalog is tool-membership SSOT.** `registerCapabilities` derives tools via `listMcpToolNamesByProfile(profile.id)`. Delete hand-maintained `*_TOOL_IDS`. Profile folders own path, optional `serverName`, prompts, and playbooks only.
6. **Env:** `LIGHTDASH_TOOLS_MCP_STDIO_PROFILE` (reject obsolete `…_STDIO_PERSONA` fail-closed). Envelope field `context.persona` → `context.profile`.

## Consequences

- Adding a tool to a mount is a single catalog `profiles` edit; no second allowlist.
- Schema introspection no longer exposes CLI taxonomy buckets via `profiles`.
- Breaking for clients that read `context.persona` or set `LIGHTDASH_TOOLS_MCP_STDIO_PERSONA`.
- Older ADRs that say “persona” remain historically accurate; this ADR is the binding vocabulary going forward.
