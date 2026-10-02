# 6. MCP profiles, shared registry, fixed paths

Date: 2026-08-04

## Status

Accepted

Amended by profile boundary ADRs (0010, 0012, 0014, 0015, 0017, 0018, 0020, 0029) and [24. MCP HTTP profile mount allowlist via env](0024-mcp-http-profile-mount-allowlist-via-env.md). Mount membership superseded by profile-owned ToolModules ([ADR-0022](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md); former catalog/membership ADRs 0013/0021). Stdio has no default (2026-08-04): bare invoke fails closed; use `lightdash-mcp stdio --profile <id>` or `http`.

## Context

A broad all-in-one MCP catalog mixed admin tools with discovery/compile UX. Clients isolate servers by URL path ([MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)). The MCP specification does not define “persona” or “profile” ([architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture): Host / Client / Server; Tools, Prompts, Resources). Our packaging is a product choice: one fixed URL path, one `serverInfo.name`, one tool subset.

Hand-maintained tool allowlists alongside catalog tags caused drift. Product vocabulary is **profile** (the MCP protocol does not define “persona” or “profile”).

## Decision

1. Keep one package: `@lightdash-tools/mcp` (binary `lightdash-mcp`). No per-profile npm packages.
2. Shared tools live in `packages/mcp/src/tools/` as `ToolModule`s (`{ id, register }`). Profile folders under `packages/mcp/src/profiles/<id>/` own fixed HTTP `path`, optional shorter `serverName`, **`tools: ToolModule[]` imports**, prompts, and playbooks ([ADR-0022](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)).
3. **Mount membership** is the profile’s `tools` array (imported modules). `registerCapabilities` calls `registerTools(server, ctx, profile.tools)`. No operations catalog and no parallel string membership tables.
4. **One profile id space** aligned to mounts: `semantic-layer`, `organization-audit`, `content-reader`, `content-developer`, `content-governance`, `ai-agent-ops`, `data-analyst`. No aliases such as `semantic-discovery` / `org-audit-readonly`.
5. HTTP mounts every shipped profile path from code; unknown paths 404. No free-form `LIGHTDASH_TOOLS_MCP_PATH`.
6. Stdio selects a profile via **`lightdash-mcp stdio --profile <id>`** only. Bare invoke fails closed — there is no default. HTTP is `lightdash-mcp http` (all fixed profile paths). Envelope field is `context.profile`.
7. Wire names use the `lightdash_` prefix. Profiles may set a shorter MCP `serverName` when needed for ~60-character client limits.
8. Broad admin **mutation** stays on `@lightdash-tools/client` / CLI ([ADR-0004](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).

## Consequences

- Adding a tool to a mount: export a `ToolModule` and append it to the profile `tools` array.
- Adding a profile is a new folder + fixed path + `tools` imports, not a package fork. Stdio uses the shared `stdio --profile <id>` flag (no per-profile CLI subcommand).
- Capability surface is profile `tools` ([ADR-0022](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)), not a process tool filter ([ADR-0008](0008-mcp-request-scope-and-hardening.md)).
- Inventories and playbooks live under `docs/profiles/`.
