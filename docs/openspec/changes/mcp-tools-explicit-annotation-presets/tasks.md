# Tasks: MCP tool explicit annotation presets at call site

## Phase 0 (already done)

- [x] Create parent GitHub issue and sub-issues; add to project; link sub-issues (delegate to github-project-manager).
- [x] Create ADR-0024 and fill Context, Decision, Consequences, References.
- [x] Create OpenSpec change (proposal, spec, design, tasks).

---

## Phase 1: Implementation

### 1.1 Shared presets in shared.ts

- [x] In [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts): Export `READ_ONLY_DEFAULT` and `WRITE_IDEMPOTENT`; ensure `mergeAnnotations` works with presets; add JSDoc that every tool should pass `annotations` explicitly.

### 1.2 Add annotations to every tool file

- [x] [packages/mcp/src/tools/charts.ts](../../../../packages/mcp/src/tools/charts.ts): list_charts, list_charts_as_code → READ_ONLY_DEFAULT; upsert_chart_as_code → WRITE_IDEMPOTENT.
- [x] [packages/mcp/src/tools/explores.ts](../../../../packages/mcp/src/tools/explores.ts): READ_ONLY_DEFAULT.
- [x] [packages/mcp/src/tools/query.ts](../../../../packages/mcp/src/tools/query.ts): READ_ONLY_DEFAULT.
- [x] [packages/mcp/src/tools/users.ts](../../../../packages/mcp/src/tools/users.ts): READ_ONLY_DEFAULT.
- [x] [packages/mcp/src/tools/groups.ts](../../../../packages/mcp/src/tools/groups.ts): READ_ONLY_DEFAULT.
- [x] [packages/mcp/src/tools/dashboards.ts](../../../../packages/mcp/src/tools/dashboards.ts): READ_ONLY_DEFAULT.
- [x] [packages/mcp/src/tools/spaces.ts](../../../../packages/mcp/src/tools/spaces.ts): READ_ONLY_DEFAULT.
- [x] [packages/mcp/src/tools/projects.ts](../../../../packages/mcp/src/tools/projects.ts): READ_ONLY_DEFAULT.

### 1.3 Verify

- [x] Run `pnpm build` and `pnpm test` from repo root.

---

## After implementation: Changelog

- [x] Add changelog fragment (e.g. `changie new --kind feat --body "MCP tools: explicit annotation presets at call site for visibility (READ_ONLY_DEFAULT, WRITE_IDEMPOTENT)"`).
