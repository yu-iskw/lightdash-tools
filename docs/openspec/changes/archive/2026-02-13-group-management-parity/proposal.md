# Proposal: Group Management Parity

## Why

Currently, the Lightdash CLI and MCP tools only support listing and fetching individual groups. Users cannot create, update, or delete groups, nor can they manage group memberships (adding/removing users) through these interfaces. This requires users to switch to the Lightdash UI or use the API directly for these common administrative tasks.

Adding these capabilities will provide full parity with the `GroupsClient` in `@lightdash-tools/client` and enable complete group management workflows from the terminal or via AI agents.

## What Changes

- **CLI Enhancements**:
  - Add `lightdash-tools groups create` command.
  - Add `lightdash-tools groups update <groupUuid>` command.
  - Add `lightdash-tools groups delete <groupUuid>` command.
  - Add `lightdash-tools groups members` subcommand group:
    - `lightdash-tools groups members list <groupUuid>`
    - `lightdash-tools groups members add <groupUuid> <userUuid>`
    - `lightdash-tools groups members remove <groupUuid> <userUuid>`
- **MCP Tool Enhancements**:
  - Add `create_group` tool.
  - Add `update_group` tool.
  - Add `delete_group` tool.
  - Add `list_group_members` tool.
  - Add `add_user_to_group` tool.
  - Add `remove_user_from_group` tool.

## Capabilities

### New Capabilities

- `group-management`: Full CRUD and membership management for Lightdash groups in CLI and MCP.

### Modified Capabilities

- (None)

## Impact

- `@lightdash-tools/cli`: New commands in `packages/cli/src/commands/groups.ts`.
- `@lightdash-tools/mcp`: New tools in `packages/mcp/src/tools/groups.ts`.
- Both will depend on the existing `GroupsClient` in `@lightdash-tools/client`.
