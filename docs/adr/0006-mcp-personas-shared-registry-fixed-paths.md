# 6. MCP personas, shared registry, fixed paths

Date: 2026-07-31

## Status

Accepted

## Context

A broad all-in-one MCP catalog mixed admin tools with discovery/compile UX. A separate semantic-layer package duplicated transport and used unprefixed names. Clients isolate servers by URL path ([MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)); free-form path/persona env knobs invite drift.

## Decision

1. Keep one package: `@lightdash-tools/mcp` (binary `lightdash-mcp`). No per-persona npm packages.
2. Shared tools live in `packages/mcp/src/tools/` (`ToolId` registry + registration by ids). Personas under `packages/mcp/src/personas/<id>/` own `toolIds`, prompts, resources/playbooks, and a **fixed** HTTP `path`.
3. Ship only the `semantic-layer` persona: nine tools, path `/semantic-layer/v1/mcp`, wire names with the `lightdash_` prefix (combined server+tool names stay under typical ~60-character client limits for current tools).
4. HTTP mounts every shipped persona path from code; unknown paths 404. Stdio always uses the sole shipped persona (no `LIGHTDASH_TOOLS_MCP_PATH` / persona env).
5. Broad admin operations remain on `@lightdash-tools/client` / CLI ([ADR-0004](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).

## Consequences

- Adding a persona is a new folder + allowlist + fixed path, not a package fork.
- Cursor/Compose use a stable URL (`…/semantic-layer/v1/mcp`).
- Former `/mcp` or shim-package clients must migrate to this package and path.
- Capability surface is the persona `toolIds` list in code, not a process tool filter ([ADR-0008](0008-mcp-request-scope-and-hardening.md)).
