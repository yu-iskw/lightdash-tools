# Proposal: MCP WRITE_DESTRUCTIVE preset and delete_member for dangerous operations

## Why

Dangerous operations (e.g. delete user) need to be clearly marked so MCP clients can prompt for user confirmation and agents can ask humans before invoking them. The MCP spec provides `destructiveHint` for this; we currently only have READ_ONLY_DEFAULT and WRITE_IDEMPOTENT. Adding a destructive preset and a delete_member tool with documentation ensures human-in-the-loop for irreversible actions.

## What Changes

- Export **WRITE_DESTRUCTIVE** from [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) with `destructiveHint: true`.
- Add **delete_member** MCP tool that calls `client.v1.users.deleteMember(userUuid)` with `annotations: WRITE_DESTRUCTIVE` and clear title/description.
- Document in MCP README and develop-mcp-server-ts skill: clients should prompt when `destructiveHint === true`; agents should ask the user before calling destructive tools.

## Capabilities

- **mcp-tools-destructive-preset-and-delete-member**: shared.ts SHALL export WRITE_DESTRUCTIVE; delete_member SHALL be registered with that preset and explicit title/description; docs SHALL state that clients should prompt and agents should ask the user for confirmation before destructive tools.

## Impact

- **Code**: [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts), [packages/mcp/src/tools/users.ts](../../../../packages/mcp/src/tools/users.ts), [packages/mcp/README.md](../../../../packages/mcp/README.md), [.claude/skills/develop-mcp-server-ts/SKILL.md](../../../../.claude/skills/develop-mcp-server-ts/SKILL.md).
- **Behavior**: New tool delete_member; tools/list will include it with destructiveHint true; no change to existing tools.

## References

- ADR-0025: MCP WRITE_DESTRUCTIVE preset and delete_member for dangerous operations
- GitHub Issue #55
- ADR-0018, ADR-0024
