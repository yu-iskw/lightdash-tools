# Tasks: MCP tool full annotation defaults

## Phase 0 (already done)

- [x] Create parent GitHub issue (#46) and sub-issues (#47, #48, #49); add to project; link sub-issues.
- [x] Create ADR-0020 and fill Context, Decision, Consequences, References.
- [x] Create OpenSpec change (proposal, spec, design, tasks).

---

## Phase 1: Implementation

### 1.1 Extend default annotations

- [ ] In [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts): Add `destructiveHint: false` and `idempotentHint: true` to `DEFAULT_ANNOTATIONS`.

### 1.2 Verify

- [ ] Run `pnpm build` and `pnpm test` from repo root.

---

## After implementation: Changelog

- [ ] Add changelog fragment (e.g. `changie new --kind feat --body "MCP tools: set full annotation defaults (destructiveHint false, idempotentHint true)"`).
