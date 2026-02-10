# Tasks: MCP tool prefix and annotations

## Phase 0 (already done)

- [x] Create parent GitHub issue (#41) and sub-issues (#42, #43, #44); add to project; link sub-issues.
- [x] Create ADR-0018 and fill Context, Decision, Consequences, References.
- [x] Create OpenSpec change (proposal, spec, design, tasks).

---

## Phase 1: Implementation

### 1.1 Extend shared module

- [ ] In [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts):
  - Export `TOOL_PREFIX = 'lightdash_tools__'`.
  - Extend `ToolOptions` with optional `title?: string` and `annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }`.
  - Define default annotations (e.g. `readOnlyHint: true`, `openWorldHint: false`); merge with per-tool `options.annotations`.
  - Change `registerToolSafe(server, shortName, options, handler)` to build `name = TOOL_PREFIX + shortName` and pass `{ description, inputSchema, title, annotations }` to the SDK.

### 1.2 Update domain modules

- [ ] [packages/mcp/src/tools/projects.ts](../../../../packages/mcp/src/tools/projects.ts): Pass short names and add `title` for list_projects, get_project.
- [ ] [packages/mcp/src/tools/charts.ts](../../../../packages/mcp/src/tools/charts.ts): Pass short name and add `title` for list_charts.
- [ ] [packages/mcp/src/tools/dashboards.ts](../../../../packages/mcp/src/tools/dashboards.ts): Pass short name and add `title` for list_dashboards.
- [ ] [packages/mcp/src/tools/spaces.ts](../../../../packages/mcp/src/tools/spaces.ts): Pass short names and add `title` for list_spaces, get_space.
- [ ] [packages/mcp/src/tools/users.ts](../../../../packages/mcp/src/tools/users.ts): Pass short names and add `title` for list_organization_members, get_member.
- [ ] [packages/mcp/src/tools/groups.ts](../../../../packages/mcp/src/tools/groups.ts): Pass short names and add `title` for list_groups, get_group.

### 1.3 Tests and build

- [ ] Update any test or snapshot that asserts tool names to use prefixed names (e.g. `lightdash_tools__list_charts`).
- [ ] Run `pnpm build` and `pnpm test` from repo root; fix any failures.

---

## After implementation: Changelog

- [ ] Add changelog fragment (e.g. `changie new --kind feat --body "MCP tools: add lightdash_tools__ prefix and tool annotations (title, readOnlyHint, openWorldHint)"`).
