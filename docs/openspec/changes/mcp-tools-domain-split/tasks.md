# Tasks: MCP tools domain split

## Phase 0 (already done)

- [x] Create parent GitHub issue (#32) and sub-issues (#33, #34); add to project; link sub-issues.
- [x] Create ADR-0015 and fill Context, Decision, Consequences, References.
- [x] Create OpenSpec change (proposal, spec, design, tasks).

---

## Phase 1: Implementation

### 1.1 Add shared module

- [ ] Create `packages/mcp/src/tools/shared.ts` with:
  - Export type `TextContent` = `{ content: Array<{ type: 'text'; text: string }> }`.
  - Export `wrapTool(client, fn)` with same try/catch and `toMcpErrorMessage` behavior as current tools.ts; import `toMcpErrorMessage` from `'../errors'`.

### 1.2 Add domain modules

- [ ] Create `packages/mcp/src/tools/projects.ts`: `registerProjectTools(server, client)` — list_projects, get_project.
- [ ] Create `packages/mcp/src/tools/charts.ts`: `registerChartTools(server, client)` — list_charts.
- [ ] Create `packages/mcp/src/tools/dashboards.ts`: `registerDashboardTools(server, client)` — list_dashboards.
- [ ] Create `packages/mcp/src/tools/spaces.ts`: `registerSpaceTools(server, client)` — list_spaces, get_space.
- [ ] Create `packages/mcp/src/tools/users.ts`: `registerUserTools(server, client)` — list_organization_members, get_member (explicit param type for list).
- [ ] Create `packages/mcp/src/tools/groups.ts`: `registerGroupTools(server, client)` — list_groups, get_group (explicit param type for list).

### 1.3 Add barrel and remove old file

- [ ] Create `packages/mcp/src/tools/index.ts`: Import all `register*Tools`; export `registerTools(server, client)` that calls them in order. Ensure entrypoint still imports from `'./tools'`.
- [ ] Delete `packages/mcp/src/tools.ts`.

### 1.4 Verify

- [ ] Run `pnpm build` and `pnpm test` from repo root; fix any type or test failures.

---

## After implementation: Changelog

- [ ] Add changelog fragment (e.g. `changie new --kind refactor --body "Organize MCP tools by domain under packages/mcp/src/tools/"`).
