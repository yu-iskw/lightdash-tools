# Spec: MCP WRITE_DESTRUCTIVE preset and delete_member

## ADDED Requirements

### Requirement: WRITE_DESTRUCTIVE preset in shared.ts

[packages/mcp/src/tools/shared.ts](../../../../../packages/mcp/src/tools/shared.ts) SHALL export `WRITE_DESTRUCTIVE` as a `ToolAnnotations` object with readOnlyHint false, destructiveHint true, idempotentHint false, openWorldHint false. JSDoc SHALL state that it is for delete/remove tools and that clients should prompt for user confirmation. <!-- markdown-link-check-disable-line -->

### Requirement: delete_member tool

A tool with shortName `delete_member` SHALL be registered in [packages/mcp/src/tools/users.ts](../../../../../packages/mcp/src/tools/users.ts) with annotations WRITE_DESTRUCTIVE, a title indicating destructiveness (e.g. "Delete member (destructive)"), and a description stating the operation is destructive and that clients/agents should obtain explicit user confirmation. inputSchema SHALL include userUuid (string). The handler SHALL call `client.v1.users.deleteMember(userUuid)` and return text content on success. <!-- markdown-link-check-disable-line -->

### Requirement: Documentation for destructive tools

- The MCP package README SHALL include a "Destructive tools" section stating that tools with destructiveHint true perform irreversible or high-impact actions, that MCP clients should show a warning and/or require user confirmation before executing them, and that AI agents should ask the user for explicit confirmation before calling such tools. delete_member SHALL be listed in the Tools section.
- The develop-mcp-server-ts skill SHALL include guidance that for tools that delete or permanently change data, set destructiveHint true; clients should prompt for confirmation and agent instructions should require asking the user before invoking destructive tools.
