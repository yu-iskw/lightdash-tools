# Proposal: MCP tools organized by domain under tools directory

## Why

The single `packages/mcp/src/tools.ts` (now replaced by [packages/mcp/src/tools/](../../../../packages/mcp/src/tools/)) had grown to 10 tools across six domains. Splitting by domain improves maintainability, gives clear ownership per domain, and aligns with the client package layout (`api/v1/` per domain). No behavior or public API change.

## What Changes

- Introduce `packages/mcp/src/tools/` with:
  - **shared.ts**: `TextContent` type and `wrapTool(client, fn)` (error mapping via `toMcpErrorMessage`).
  - **Domain modules**: `projects.ts`, `charts.ts`, `dashboards.ts`, `spaces.ts`, `users.ts`, `groups.ts`, each exporting `register*Tools(server, client)`.
  - **index.ts**: Barrel exporting `registerTools(server, client)` that calls all domain register functions.
- Remove the former single file `packages/mcp/src/tools.ts`. Entrypoint continues to import from `'./tools'`.

## Capabilities

- **mcp-tools-domain-layout**: MCP tools SHALL be organized by domain under `src/tools/`. Each domain SHALL have its own module; shared helper (wrapTool, TextContent) SHALL live in `tools/shared.ts`. The public API SHALL remain `registerTools(server, client)` via the barrel.

## Impact

- **Code**: New directory `packages/mcp/src/tools/` with shared.ts, six domain files, and index.ts; delete src/tools.ts.
- **Behavior**: Unchanged; same tools, same error handling.

## References

- ADR-0015: Organize MCP tools by domain under tools directory
- GitHub Issue: #32 (parent), #33 (ADR/OpenSpec), #34 (Implementation)
