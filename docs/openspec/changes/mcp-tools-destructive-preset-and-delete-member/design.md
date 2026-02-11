# Design: MCP WRITE_DESTRUCTIVE preset and delete_member

## Context

- [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) exports READ_ONLY_DEFAULT and WRITE_IDEMPOTENT; both have destructiveHint false.
- [packages/client/src/api/v1/users.ts](../../../../packages/client/src/api/v1/users.ts) exposes `deleteMember(userUuid: string): Promise<void>`.
- Goal: mark destructive tools so clients prompt and agents ask the user.

## Preset shape

- **WRITE_DESTRUCTIVE**: `{ readOnlyHint: false, openWorldHint: false, destructiveHint: true, idempotentHint: false }`. JSDoc: use for delete/remove tools; clients should prompt for user confirmation.

## delete_member tool

- **shortName:** delete_member
- **title:** "Delete member (destructive)"
- **description:** "Permanently remove a user from the organization. Destructive; clients and agents should obtain explicit user confirmation before calling."
- **inputSchema:** `{ userUuid: z.string().describe('User UUID') }`
- **annotations:** WRITE_DESTRUCTIVE
- **handler:** call `c.v1.users.deleteMember(userUuid)`; return `{ content: [{ type: 'text', text: 'Member deleted.' }] }` on success; errors handled by wrapTool.

## Doc locations

- **packages/mcp/README.md:** New "Destructive tools" section; add delete_member to Tools list.
- **.claude/skills/develop-mcp-server-ts/SKILL.md:** Add guidance on destructiveHint and client/agent confirmation (and optionally references/typescript-sdk-cheatsheet.md).
