# Tasks: MCP WRITE_DESTRUCTIVE preset and delete_member

## Phase 0 (already done)

- [x] Create parent GitHub issue (#55); add to project.
- [x] Create ADR-0025 and fill Context, Decision, Consequences, References.
- [x] Create OpenSpec change (proposal, spec, design, tasks).

---

## Phase 1: Implementation

### 1.1 WRITE_DESTRUCTIVE preset in shared.ts

- [x] In [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts): Export WRITE_DESTRUCTIVE with readOnlyHint false, destructiveHint true, idempotentHint false, openWorldHint false; add JSDoc.

### 1.2 delete_member tool in users.ts

- [x] In [packages/mcp/src/tools/users.ts](../../../../packages/mcp/src/tools/users.ts): Register delete_member with WRITE_DESTRUCTIVE, title, description, inputSchema (userUuid), handler calling client.v1.users.deleteMember.

### 1.3 Documentation

- [x] [packages/mcp/README.md](../../../../packages/mcp/README.md): Add "Destructive tools" section; list delete_member in Tools.
- [x] [.claude/skills/develop-mcp-server-ts/SKILL.md](../../../../.claude/skills/develop-mcp-server-ts/SKILL.md): Add destructiveHint and confirmation guidance.

### 1.4 Verify

- [x] Run `pnpm build` and `pnpm test` from repo root.

---

## After implementation: Changelog

- [x] Add changelog fragment (e.g. `changie new --kind feat --body "MCP: WRITE_DESTRUCTIVE preset and delete_member tool; docs for destructive tool confirmation"`).
