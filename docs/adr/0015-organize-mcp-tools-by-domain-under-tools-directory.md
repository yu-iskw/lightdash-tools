# 15. Organize MCP tools by domain under tools directory

Date: 2026-02-11

## Status

Accepted

## Context

The MCP server in `packages/mcp` currently registers all tools in a single file ([packages/mcp/src/tools/index.ts](../../packages/mcp/src/tools/index.ts)), which has grown to 10 tools across six domains (projects, charts, dashboards, spaces, users, groups). A single file makes it harder to own and extend one domain without touching others, and does not align with the client package layout, which uses one module per domain under `api/v1/` (e.g. [packages/client/src/api/v1/projects.ts](../../packages/client/src/api/v1/projects.ts), charts.ts, etc.).

## Decision

Organize MCP tools by domain under a dedicated directory:

1. **Introduce** `packages/mcp/src/tools/` with:
   - **shared.ts**: Export type `TextContent` and function `wrapTool(client, fn)` for try/catch and `toMcpErrorMessage` handling. Import `toMcpErrorMessage` from `../errors`.
   - **One module per domain**: `projects.ts`, `charts.ts`, `dashboards.ts`, `spaces.ts`, `users.ts`, `groups.ts`. Each exports a single `register*Tools(server, client)` and uses `wrapTool` from `./shared`. Tool names, descriptions, Zod schemas, and client calls are unchanged.
   - **index.ts**: Barrel that imports every `register*Tools` and exports a single `registerTools(server, client)` that calls them all in order.

2. **Remove** the former single file `packages/mcp/src/tools.ts`. The entrypoint [packages/mcp/src/index.ts](../../packages/mcp/src/index.ts) continues to import `registerTools` from `'./tools'`, which resolves to `tools/index.ts`. No change to public API or behavior.

## Consequences

- **Easier**: Smaller, focused files; clear ownership per domain; adding or changing tools in one domain does not require editing a large shared file. Aligns with client package structure.
- **No behavior change**: Same tools, same error mapping; entrypoint import path unchanged.

## References

- GitHub: Issue #32 (parent), sub-issues #33 (ADR and OpenSpec), #34 (Implementation)
- OpenSpec: `docs/openspec/changes/mcp-tools-domain-split/`
