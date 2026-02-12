# 25. MCP WRITE_DESTRUCTIVE preset and delete_member for dangerous operations

Date: 2026-02-11

## Status

Accepted

## Context

Dangerous operations (e.g. delete user) need to be clearly marked so MCP clients can prompt for confirmation and agents can ask humans before invoking them. The MCP specification provides `destructiveHint` for this; we currently only have READ_ONLY_DEFAULT and WRITE_IDEMPOTENT presets in [packages/mcp/src/tools/shared.ts](../../packages/mcp/src/tools/shared.ts). The HTTP client already exposes `deleteMember(userUuid)` in [packages/client/src/api/v1/users.ts](../../packages/client/src/api/v1/users.ts).

## Decision

1. **Export WRITE_DESTRUCTIVE** from [packages/mcp/src/tools/shared.ts](../../packages/mcp/src/tools/shared.ts): `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: false`. Use for delete/remove tools; clients should prompt for user confirmation.

2. **Add delete_member MCP tool** that calls `client.v1.users.deleteMember(userUuid)` with `annotations: WRITE_DESTRUCTIVE`, and a clear title (e.g. "Delete member (destructive)") and description stating the operation is destructive and requires human confirmation.

3. **Document** in the MCP package README and the develop-mcp-server-ts skill: clients should prompt when `destructiveHint === true`; agents should ask the user for explicit confirmation before calling destructive tools.

## Consequences

- **Easier:** Destructive tools are visible and consistently annotated; clients and agents have clear guidance for human-in-the-loop.
- **Risk:** delete_member is exposed via MCP; mitigation is annotation plus documentation so clients/agents obtain confirmation before use.

## References

- ADR-0018: MCP tool naming prefix and tool annotations
- ADR-0024: Explicit MCP tool annotation presets at call site for visibility (destructive preset uses this system)
- OpenSpec: `docs/openspec/changes/mcp-tools-destructive-preset-and-delete-member/`
- [MCP Tool annotations](https://modelcontextprotocol.io/legacy/concepts/tools#tool-annotations)
