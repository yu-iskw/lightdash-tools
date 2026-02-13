# Tasks: Hierarchical Safety Modes for MCP and CLI

## 1. Shared Safety Logic

- [x] 1.1 Create `packages/common/src/safety.ts` with `SafetyMode` enum and `ToolAnnotations` type.
- [x] 1.2 Implement `isAllowed(mode, annotations)` logic in `packages/common/src/safety.ts`.
- [x] 1.3 Export safety presets (`READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE`) from `common`.
- [x] 1.4 Export `getSafetyModeFromEnv()` with default to `read-only`.

## 2. MCP Server Enforcement

- [x] 2.1 Update `packages/mcp/src/tools/shared.ts` to import safety types and logic from `@lightdash-tools/common`.
- [x] 2.2 Implement safety handler wrapper in `registerToolSafe` to check mode before execution.
- [x] 2.3 Update `registerToolSafe` to append disabled warning to tool descriptions if applicable.
- [x] 2.4 Verify MCP safety enforcement with unit tests in `packages/mcp/src/tools/shared.test.ts` (create if needed).

## 3. CLI Enforcement

- [x] 3.1 Create `packages/cli/src/utils/safety.ts` with `wrapAction(annotations, handler)` helper.
- [x] 3.2 Update `packages/cli/src/index.ts` to add global `--mode` flag.
- [x] 3.3 Update `packages/cli/src/utils/client.ts` or `index.ts` to resolve the final safety mode (env vs flag).
- [x] 3.4 Verify CLI safety enforcement with unit tests in `packages/cli/src/utils/safety.test.ts`.

## 4. Audit and Annotations

- [x] 4.1 Update all MCP tool modules with correct safety presets:
  - `charts.ts`, `content.ts`, `dashboards.ts`, `explores.ts`, `groups.ts`, `metrics.ts`, `projects.ts`, `query.ts`, `schedulers.ts`, `spaces.ts`, `tags.ts`, `users.ts`.
- [x] 4.2 Update all CLI command modules to use `wrapAction` with correct safety presets:
  - `ai-agents.ts`, `charts.ts`, `content.ts`, `dashboards.ts`, `explores.ts`, `groups.ts`, `metrics.ts`, `organization-roles.ts`, `organization.ts`, `project-access.ts`, `project-role-assignments.ts`, `projects.ts`, `query.ts`, `schedulers.ts`, `spaces.ts`, `tags.ts`, `users.ts`.

## 5. Verification and Documentation

- [x] 5.1 Run full build and tests: `pnpm build && pnpm test`.
- [x] 5.2 Add changelog fragment using `manage-changelog`.
- [x] 5.3 Update READMEs if necessary to document the new safety modes.
