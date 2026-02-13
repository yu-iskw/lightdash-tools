# group-management-parity Design

## Overview

This change implements full group management capabilities in both the Lightdash CLI and MCP server, ensuring parity with the `GroupsClient` in `@lightdash-tools/client`.

## CLI Design

Existing command: `packages/cli/src/commands/groups.ts`

### New Subcommands

#### `groups create`

- **Description**: Create a new group.
- **Options**:
  - `--name <string>` (required): Name of the group.
- **Implementation**: Call `client.v1.groups.createGroup({ name })`.
- **Safety**: `WRITE_IDEMPOTENT`.

#### `groups update <groupUuid>`

- **Description**: Update an existing group.
- **Options**:
  - `--name <string>` (required): New name for the group.
- **Implementation**: Call `client.v1.groups.updateGroup(groupUuid, { name })`.
- **Safety**: `WRITE_IDEMPOTENT`.

#### `groups delete <groupUuid>`

- **Description**: Delete a group.
- **Implementation**: Call `client.v1.groups.deleteGroup(groupUuid)`.
- **Safety**: `WRITE_DESTRUCTIVE`.

#### `groups members` (Subcommand group)

- **Subcommands**:
  - `list <groupUuid>`: Call `client.v1.groups.getGroupMembers(groupUuid)`. Safety: `READ_ONLY_DEFAULT`.
  - `add <groupUuid> <userUuid>`: Call `client.v1.groups.addUserToGroup(groupUuid, userUuid)`. Safety: `WRITE_IDEMPOTENT`.
  - `remove <groupUuid> <userUuid>`: Call `client.v1.groups.removeUserFromGroup(groupUuid, userUuid)`. Safety: `WRITE_DESTRUCTIVE`.

## MCP Design

Existing tools: `packages/mcp/src/tools/groups.ts`

### New Tools

#### `create_group`

- **Input**: `{ name: string }`
- **Implementation**: `client.v1.groups.createGroup({ name })`.
- **Annotations**: `WRITE_IDEMPOTENT`.

#### `update_group`

- **Input**: `{ groupUuid: string, name: string }`
- **Implementation**: `client.v1.groups.updateGroup(groupUuid, { name })`.
- **Annotations**: `WRITE_IDEMPOTENT`.

#### `delete_group`

- **Input**: `{ groupUuid: string }`
- **Implementation**: `client.v1.groups.deleteGroup(groupUuid)`.
- **Annotations**: `WRITE_DESTRUCTIVE`.

#### `list_group_members`

- **Input**: `{ groupUuid: string }`
- **Implementation**: `client.v1.groups.getGroupMembers(groupUuid)`.
- **Annotations**: `READ_ONLY_DEFAULT`.

#### `add_user_to_group`

- **Input**: `{ groupUuid: string, userUuid: string }`
- **Implementation**: `client.v1.groups.addUserToGroup(groupUuid, userUuid)`.
- **Annotations**: `WRITE_IDEMPOTENT`.

#### `remove_user_from_group`

- **Input**: `{ groupUuid: string, userUuid: string }`
- **Implementation**: `client.v1.groups.removeUserFromGroup(groupUuid, userUuid)`.
- **Annotations**: `WRITE_DESTRUCTIVE`.

## Error Handling

Both CLI and MCP implementations will use existing error handling patterns (wrapAction for CLI, wrapTool for MCP) to catch and report API errors.

## Safety

Write operations in the CLI should use `wrapAction(WRITE_DEFAULT, ...)` and in MCP should use `registerToolSafe` with `WRITE_DEFAULT` annotations. I need to check if `WRITE_DEFAULT` exists in `packages/common/src/index.ts` or similar.
