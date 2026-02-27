# 32. Unify `--projects` flag as security guardrail

Date: 2026-02-27

## Status

Proposed

## Context

ADR-0031 introduced a project allowlist using `--allowed-projects` in the MCP server and `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` environment variable in both MCP and CLI. This provided a first layer of scope restriction for AI agents.

However, several inconsistencies and usability issues remain:

1. **Naming Inconsistency**: The MCP server uses `--allowed-projects`, but CLI commands and MCP tools often use `--projects` or `projectUuid` for filtering. Having two different flag names for the same concept (restricting/filtering by project) is confusing.
2. **CLI Guardrail Gap**: The CLI lacks a global `--projects` flag that acts as a security guardrail. Command-specific `--projects` flags are currently treated as filters, not as security boundaries enforced by `wrapAction`.
3. **AI Agent UX**: AI agents (like Cursor or Claude) are often instructed to "operate on project X". It is more natural to provide this via a standard `--projects` flag that applies globally to the session.

## Decision

We will unify the project guardrail under the `--projects` flag across the MCP server and the CLI.

### 1. Unified MCP Flag

The `lightdash-mcp` binary will support `--projects <uuids...>` (comma-separated).

- This will be the preferred way to set the project allowlist.

### 2. Global CLI Guardrail

The `lightdash-ai` root command will support a global `--projects <uuids...>` option.

- When provided, this flag populates the `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` list in memory for the duration of the process.
- The `wrapAction` wrapper in `packages/cli/src/utils/safety.ts` will be updated to enforce this allowlist against any project UUIDs extracted from command arguments (positional or flags).

### 3. Unified Enforcement Logic

Both MCP and CLI will use the same underlying logic to:

1. Extract project UUIDs from arguments (singular `projectUuid` or plural `projectUuids`).
2. Compare them against the allowlist.
3. Block execution if any target project is not allowed.

This ensures that if an operator runs `lightdash-ai --projects uuid1 charts list --projects uuid2`, the command will be rejected because `uuid2` is not in the global allowlist `[uuid1]`.

## Consequences

- **Consistency**: Operators and AI agents use the same flag (`--projects`) to restrict scope across all tools.
- **Safety**: The CLI now has a robust way to enforce project-level multi-tenancy boundaries at the global level.
- **Backward Compatibility**: Existing environment variables (`LIGHTDASH_TOOLS_ALLOWED_PROJECTS`) continue to work as a fallback.
- **Clarified Intent**: The global flag defines the _permissible_ scope, while command-specific flags define the _desired_ scope within that permissible set.
