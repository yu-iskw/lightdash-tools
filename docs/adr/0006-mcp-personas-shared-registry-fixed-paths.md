# 6. MCP personas, shared registry, fixed paths

Date: 2026-07-31

## Status

Accepted

## Context

A broad all-in-one MCP catalog mixed admin tools with discovery/compile UX. A separate semantic-layer package duplicated transport and used unprefixed names. Clients isolate servers by URL path ([MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)); free-form path/persona env knobs invite drift.

A second persona (`organization-audit`) is required for organization-wide governance reads without expanding semantic-layer capability ([ADR-0010](0010-mcp-organization-audit-persona-read-only-boundary.md)).

## Decision

1. Keep one package: `@lightdash-tools/mcp` (binary `lightdash-mcp`). No per-persona npm packages.
2. Shared tools live in `packages/mcp/src/tools/` (`ToolId` registry + registration by ids). Personas under `packages/mcp/src/personas/<id>/` own `toolIds`, prompts, resources/playbooks, and a **fixed** HTTP `path`.
3. Ship personas with code-defined allowlists and fixed paths:
   - `semantic-layer` → `/semantic-layer/v1/mcp` (default)
   - `organization-audit` → `/organization-audit/v1/mcp`
4. Wire names use the `lightdash_` prefix. Personas may set an optional shorter MCP `serverName` when `lightdash-mcp-${id}` would break ~60-character client limits.
5. HTTP mounts every shipped persona path from code; unknown paths 404. No `LIGHTDASH_TOOLS_MCP_PATH` / free-form persona env.
6. Stdio selects a persona via **explicit subcommand** validated against `PersonaId`:
   - `lightdash-mcp` / `lightdash-mcp stdio` / `lightdash-mcp semantic-layer` → `semantic-layer`
   - `lightdash-mcp organization-audit` → `organization-audit`
7. Broad admin **mutation** operations remain on `@lightdash-tools/client` / CLI ([ADR-0004](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)). Read-only organization audit tools may ship on the `organization-audit` persona only.

## Consequences

- Adding a persona is a new folder + allowlist + fixed path (+ optional stdio subcommand), not a package fork.
- Cursor/Compose use stable URLs per persona.
- Capability surface is the persona `toolIds` list in code, not a process tool filter ([ADR-0008](0008-mcp-request-scope-and-hardening.md)).
- Default stdio remains `semantic-layer` for backward compatibility.
