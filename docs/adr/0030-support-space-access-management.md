# 30. Support Space Access Management

Date: 2026-02-13

## Status

Proposed

## Context

We need to support space access management for users and groups in both the CLI and MCP server. This allows users to programmatically or via AI agents manage who has access to specific spaces within a project.

Existing support in the codebase covers organization-level roles and project-level roles, but space-level access control is missing from the unified CLI and MCP interfaces.

## Decision

We will implement space access management subcommands in the CLI and corresponding tools in the MCP server.

### CLI Design

We will introduce a `space-access` subcommand under `projects`.

```bash
# User access
lightdash projects space-access user grant <projectUuid> <spaceUuid> <userUuid> <role>
lightdash projects space-access user revoke <projectUuid> <spaceUuid> <userUuid>

# Group access
lightdash projects space-access group grant <projectUuid> <spaceUuid> <groupUuid> <role>
lightdash projects space-access group revoke <projectUuid> <spaceUuid> <groupUuid>
```

The CLI will use the `@lightdash-tools/client` package to interact with the Lightdash API.

### MCP Design

We will add the following tools to the MCP server:

1. `grant_user_space_access`: Grants a user access to a space.
2. `revoke_user_space_access`: Revokes a user's access from a space.
3. `grant_group_space_access`: Grants a group access to a space.
4. `revoke_group_space_access`: Revokes a group's access from a space.

These tools will be categorized under the `space-access` domain in the MCP toolset.

### Architecture

The implementation will follow the existing patterns:

1. Update `@lightdash-tools/client` with space access API methods.
2. Implement CLI commands in `packages/cli/src/commands/space-access.ts`.
3. Implement MCP tools in `packages/mcp/src/tools/space-access.ts`.

## Consequences

- Users can manage space access from their terminal.
- AI agents can help manage space permissions via the MCP server.
- Increased parity between the CLI/MCP and the Lightdash UI.
- New dependencies on space access API endpoints.
