# 6. MCP profiles, shared registry, fixed paths

Date: 2026-08-04

## Status

Accepted

Amended by profile boundary ADRs (0010, 0012, 0014, 0015, 0017, 0018, 0020), catalog SSOT ([ADR-0013](0013-operation-catalog-as-sole-agent-surface-ssot.md)), and mount membership tables ([ADR-0021](0021-mcp-mount-membership-via-literal-profile-tables.md)). Stdio has no default (2026-08-04): bare invoke fails closed; use `lightdash-mcp stdio --profile <id>` or `http`.

## Context

A broad all-in-one MCP catalog mixed admin tools with discovery/compile UX. Clients isolate servers by URL path ([MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)). The MCP specification does not define “persona” or “profile” ([architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture): Host / Client / Server; Tools, Prompts, Resources). Our packaging is a product choice: one fixed URL path, one `serverInfo.name`, one tool subset.

Hand-maintained tool allowlists alongside catalog tags caused drift. Product vocabulary is **profile** (the MCP protocol does not define “persona” or “profile”).

## Decision

1. Keep one package: `@lightdash-tools/mcp` (binary `lightdash-mcp`). No per-profile npm packages.
2. Shared tools live in `packages/mcp/src/tools/`. Profile folders under `packages/mcp/src/profiles/<id>/` own fixed HTTP `path`, optional shorter `serverName`, prompts, and playbooks only — **not** a second tool allowlist.
3. **Mount membership** is literal profile tables in common ([ADR-0021](0021-mcp-mount-membership-via-literal-profile-tables.md)). Profile entrypoints bind those named exports as `ProfileDefinition.mcpToolNames`; `registerCapabilities` registers from that field. No hand-maintained `*_TOOL_IDS` inside the MCP package and no `profiles` tags on operations.
4. **One profile id space** aligned to mounts: `semantic-layer`, `organization-audit`, `content-reader`, `content-developer`, `content-governance`, `ai-agent-ops`, `data-analyst`. No aliases such as `semantic-discovery` / `org-audit-readonly`. Catalog `profiles` means MCP mount membership only (no granular CLI taxonomy tags).
5. HTTP mounts every shipped profile path from code; unknown paths 404. No free-form `LIGHTDASH_TOOLS_MCP_PATH`.
6. Stdio selects a profile via **`lightdash-mcp stdio --profile <id>`** only. Bare invoke fails closed — there is no default. HTTP is `lightdash-mcp http` (all fixed profile paths). Envelope field is `context.profile`.
7. Wire names use the `lightdash_` prefix. Profiles may set a shorter MCP `serverName` when needed for ~60-character client limits.
8. Broad admin **mutation** stays on `@lightdash-tools/client` / CLI ([ADR-0004](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).

## Consequences

- Adding a tool to a mount is a single catalog `profiles` edit.
- Adding a profile is a new folder + fixed path + catalog tags, not a package fork. Stdio uses the shared `stdio --profile <id>` flag (no per-profile CLI subcommand).
- Capability surface is catalog membership tables ([ADR-0021](0021-mcp-mount-membership-via-literal-profile-tables.md)), not a process tool filter ([ADR-0008](0008-mcp-request-scope-and-hardening.md)).
- Inventories and playbooks live under `docs/profiles/`.
