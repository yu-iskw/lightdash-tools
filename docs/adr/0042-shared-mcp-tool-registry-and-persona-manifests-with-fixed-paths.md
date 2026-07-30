# 42. Shared MCP tool registry and persona manifests with fixed paths

Date: 2026-07-30

## Status

Accepted

## Context

`@lightdash-tools/mcp` previously registered a broad admin tool surface (charts, dashboards, users, AI agents, …). A separate `@lightdash-tools/semantic-layer-mcp` package duplicated transport/auth for a compile/discovery-only UX with unprefixed tool names and a configurable `/mcp` path.

We need one maintainable MCP package where:

- Shared **tools** live in a registry (implement once).
- **Personas** only select tools and attach prompts/resources/playbooks.
- Clients isolate servers by URL path ([MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [Cursor MCP](https://cursor.com/docs/context/mcp)).
- Tool wire names keep the `ldt__` prefix ([ADR-0033](0033-shorten-mcp-tool-naming-prefix-to-ldt__.md)).
- Transport stays compatibility-first SDK v2 ([ADR-0041](0041-compatibility-first-mcp-typescript-sdk-v2-migration.md)).

Free-form `LIGHTDASH_TOOLS_MCP_PATH` / persona env knobs would fight path-is-identity and invite misconfiguration.

## Decision

1. Keep package name `@lightdash-tools/mcp` (no rename, no per-persona npm packages).
2. Structure source as `tools/` (shared `ToolId` registry + `registerToolsByIds`) and `personas/<id>/` (allowlist, prompts, resources, fixed `path`).
3. Ship only the `semantic-layer` persona now: nine tools, path `/semantic-layer/v1/mcp`, wire names `ldt__*`.
4. HTTP mounts every shipped persona path from code (`listPersonaPaths` / `getPersonaByPath`); unknown paths 404. Stdio always uses the sole shipped persona (no PATH/PERSONA env).
5. **Remove** `@lightdash-tools/semantic-layer-mcp`; do not keep a forwarder package. Use `@lightdash-tools/mcp` only.
6. Broad admin operations remain on `@lightdash-tools/client` / CLI, not on the MCP binary.

## Consequences

**Positive**

- Adding a future persona is a new folder + allowlist + fixed path, not a package fork.
- Cursor/Compose point at a stable URL; no path env drift.
- Single Docker image and binary for the shipped MCP surface.

**Negative / trade-offs**

- Broad “full” MCP catalog is intentionally out of product until a future persona re-adds tools to the shared registry.
- Former `@lightdash-tools/semantic-layer-mcp` / `/mcp` clients must use `@lightdash-tools/mcp` and `/semantic-layer/v1/mcp` (binary `lightdash-mcp`, tools `ldt__*`). The shim package was removed (never published to npm).
- `LIGHTDASH_TOOLS_MCP_PATH` is ignored (deprecated).

## References

- [ADR-0033](0033-shorten-mcp-tool-naming-prefix-to-ldt__.md)
- [ADR-0041](0041-compatibility-first-mcp-typescript-sdk-v2-migration.md)
- Package layout: `packages/mcp/src/tools/registry.ts`, `packages/mcp/src/personas/`
