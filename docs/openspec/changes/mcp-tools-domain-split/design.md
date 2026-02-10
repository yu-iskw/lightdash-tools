# Design: MCP tools by domain

## Context

- Current: [packages/mcp/src/tools/index.ts](../../../../packages/mcp/src/tools/index.ts) (barrel) and domain modules under `tools/` contain all 10 tools and a shared `wrapTool` helper.
- Client package uses one file per domain under `api/v1/` (projects.ts, charts.ts, etc.). We mirror that under `packages/mcp/src/tools/`.

## Goals

- One file per domain; shared helper in one place; barrel so the public API stays `registerTools(server, client)`.
- No behavior change: same tool names, Zod schemas, client calls, and error mapping.

## Decisions

### Decision 1: File layout

- **tools/shared.ts**: Export `TextContent` and `wrapTool(client, fn)`. `wrapTool` invokes the handler and on catch returns `{ content: [{ type: 'text', text: toMcpErrorMessage(err) }] }`. Import `toMcpErrorMessage` from `../errors`.
- **tools/projects.ts**: `registerProjectTools(server, client)` — list_projects, get_project.
- **tools/charts.ts**: `registerChartTools(server, client)` — list_charts.
- **tools/dashboards.ts**: `registerDashboardTools(server, client)` — list_dashboards.
- **tools/spaces.ts**: `registerSpaceTools(server, client)` — list_spaces, get_space.
- **tools/users.ts**: `registerUserTools(server, client)` — list_organization_members, get_member. Use explicit param type for list (e.g. `{ page?: number; pageSize?: number; searchQuery?: string }`) and `params ?? {}` when calling `listMembers`.
- **tools/groups.ts**: `registerGroupTools(server, client)` — list_groups, get_group. Same param typing as users for the list tool.
- **tools/index.ts**: Import all `register*Tools`; export `registerTools(server, client)` that calls them in the order above.

### Decision 2: Entrypoint and removal

- [packages/mcp/src/index.ts](../../../../packages/mcp/src/index.ts) keeps `import { registerTools } from './tools'`; resolution is `tools/index.ts`. The former single file `packages/mcp/src/tools.ts` has been removed.

## Migration

- Add new files under `tools/`; then delete `tools.ts`; run build and tests to confirm no regressions.
