# Design: Hierarchical Safety Modes for MCP and CLI

## Context

Currently, AI agents can execute any available MCP tool or CLI command. Some of these are destructive. We have `ToolAnnotations` in MCP, but they are not enforced and not used in the CLI. We need a hierarchical safety model enforced across both interfaces.

## Goals / Non-Goals

**Goals:**

- Define a hierarchy: `read-only` < `write-idempotent` < `write-destructive`.
- Provide a unified safety validation logic in `@lightdash-tools/common`.
- Enforce safety in `@lightdash-tools/mcp` via `registerToolSafe` wrapper.
- Enforce safety in `@lightdash-tools/cli` via a global `--mode` flag and action wrapper.
- Update all tool/command definitions with appropriate safety hints.

**Non-Goals:**

- Per-user or per-project safety levels (it's global per process).
- Dynamic mode switching during a single session (except via flag for CLI).

## Decisions

### 1. Shared Safety Logic Location

**Decision**: Move safety types and logic to `packages/common/src/safety.ts`.
**Rationale**: Both MCP and CLI need these definitions. Putting them in `common` avoids duplication and ensures consistency.

### 2. Hierarchy Enforcement Logic

**Decision**:

- `read-only`: `readOnlyHint === true`
- `write-idempotent`: `readOnlyHint === true` OR (`readOnlyHint === false` AND `destructiveHint === false`)
- `write-destructive`: Always allow.
  **Rationale**: This matches the levels of risk. Idempotent writes (like `upsert`) are safer than destructive ones (like `delete`).

### 3. MCP Enforcement

**Decision**: Modify `registerToolSafe` in `packages/mcp/src/tools/shared.ts` to:

1. Wrap the `handler` in a function that checks the current mode.
2. If forbidden, return an error message: `Operation forbidden in current safety mode: ${currentMode}. Required mode: ${requiredMode}.`.
3. Append `[DISABLED in ${mode} mode]` to the tool description if it would be disabled.

### 4. CLI Enforcement

**Decision**:

1. Add a global `--mode` option to the main `Command` in `packages/cli/src/index.ts`.
2. Create a `wrapAction(annotations, handler)` helper in `packages/cli/src/utils/safety.ts`.
3. Every `.action()` in the CLI will be wrapped.
4. If forbidden, `console.error` and `process.exit(1)`.

### 5. Default Mode

**Decision**: Default to `read-only`.
**Rationale**: Backward compatibility. Users must explicitly opt-in to safer modes.

## Risks / Trade-offs

- **[Risk]**: Missing annotations on new commands/tools.
  - **Mitigation**: Update `registerToolSafe` and CLI wrapper to require annotations or default to `read-only` (most restrictive) if unsure, but for now we'll default to `READ_ONLY_DEFAULT` as it's the most common.
- **[Trade-off]**: CLI `process.exit(1)` might be too harsh for some uses.
  - **Mitigation**: Standard for CLI errors.

## Migration Plan

1. Create `packages/common/src/safety.ts`.
2. Move types and presets from `packages/mcp/src/tools/shared.ts` to `common`.
3. Update `packages/mcp/src/tools/shared.ts` to use shared logic and add the enforcement wrapper.
4. Implement CLI global flag and `wrapAction` in `packages/cli`.
5. Audit and update all CLI commands to use `wrapAction` with presets.
6. Verify with integration tests for both MCP and CLI.
