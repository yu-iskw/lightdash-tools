# 6. MCP personas, shared registry, fixed paths

Date: 2026-07-31

## Status

Accepted

Amended by [20. MCP data-analyst persona ad-hoc metric-query boundary](0020-mcp-data-analyst-persona-ad-hoc-metric-query-boundary.md)

## Context

A broad all-in-one MCP catalog mixed admin tools with discovery/compile UX. A separate semantic-layer package duplicated transport and used unprefixed names. Clients isolate servers by URL path ([MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)); free-form path/persona env knobs invite drift.

Second and third personas are required without expanding semantic-layer capability: `organization-audit` for org-wide governance reads ([ADR-0010](0010-mcp-organization-audit-persona-read-only-boundary.md)) and `content-reader` for project-scoped saved-content reads and bounded query execution ([ADR-0012](0012-mcp-content-reader-persona-saved-content-execution-boundary.md)).

## Decision

1. Keep one package: `@lightdash-tools/mcp` (binary `lightdash-mcp`). No per-persona npm packages.
2. Shared tools live in `packages/mcp/src/tools/` (`ToolId` registry + registration by ids). Personas under `packages/mcp/src/personas/<id>/` own `toolIds`, prompts, resources/playbooks, and a **fixed** HTTP `path`. Playbooks are **workflow-scoped**: each persona registers an index URI `lightdash://playbooks/<persona-id>`, a shared `…/core` resource (hard bans, tools, gates), and one or more topic URIs `…/<topic>`. Prompts embed **core + exactly one topic** (not a single monolith).
3. Ship personas with code-defined allowlists and fixed paths:
   - `semantic-layer` → `/semantic-layer/v1/mcp` (default)
   - `organization-audit` → `/organization-audit/v1/mcp`
   - `content-reader` → `/content-reader/v1/mcp`
4. Wire names use the `lightdash_` prefix. Personas may set an optional shorter MCP `serverName` when `lightdash-mcp-${id}` would break ~60-character client limits.
5. HTTP mounts every shipped persona path from code; unknown paths 404. No `LIGHTDASH_TOOLS_MCP_PATH` / free-form persona env.
6. Stdio selects a persona via **explicit subcommand** validated against `PersonaId`:
   - `lightdash-mcp` / `lightdash-mcp stdio` / `lightdash-mcp semantic-layer` → `semantic-layer`
   - `lightdash-mcp organization-audit` → `organization-audit`
   - `lightdash-mcp content-reader` → `content-reader`
7. Broad admin **mutation** operations remain on `@lightdash-tools/client` / CLI ([ADR-0004](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)). Read-only organization audit tools may ship on the `organization-audit` persona only.

## Consequences

- Adding a persona is a new folder + allowlist + fixed path (+ optional stdio subcommand), not a package fork.
- Cursor/Compose use stable URLs per persona.
- Capability surface is the persona `toolIds` list in code, not a process tool filter ([ADR-0008](0008-mcp-request-scope-and-hardening.md)).
- Default stdio remains `semantic-layer` for backward compatibility.
