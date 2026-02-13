# Proposal: Hierarchical Safety Modes for MCP and CLI

## Why

AI agents and autonomous tools interacting with Lightdash via MCP or CLI can perform dangerous operations (e.g., deleting users, removing projects). Accidental execution can lead to data loss. We need a hierarchical safety model to restrict operations based on environment or user preference, providing a unified enforcement mechanism across both interfaces.

## What Changes

- **Unified Safety Model**: Define hierarchical safety modes (`read-only`, `write-idempotent`, `write-destructive`) in `@lightdash-tools/common`.
- **Global Configuration**: Support `LIGHTDASH_AI_MODE` environment variable and `--mode` CLI flag.
- **MCP Enforcement**: Update `registerToolSafe` to wrap handlers in safety checks and update tool descriptions to indicate if they are disabled.
- **CLI Enforcement**: Add a global action wrapper to check safety mode before executing commands.
- **Annotation Audit**: Audit all MCP tools and CLI commands to ensure they have correct `readOnlyHint` and `destructiveHint` annotations.

## Capabilities

### New Capabilities

- `hierarchical-safety`: Shared validation logic for hierarchical safety modes.

### Modified Capabilities

- `mcp-server`: Update tool registration to enforce hierarchical safety.
- `lightdash-cli`: Update command execution to enforce hierarchical safety via global flag and wrapper.

## Impact

- `@lightdash-tools/common`: New safety logic.
- `@lightdash-tools/mcp`: Updated `registerToolSafe` and all tool modules.
- `@lightdash-tools/cli`: New global flag and action wrapper.
- AI Agents: Improved safety and clear error messages when attempting restricted operations.
