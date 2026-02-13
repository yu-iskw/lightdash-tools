# Specification: Space Access Management

## Overview

Space access management allows administrators to control access to specific spaces for users and groups.

## CLI Commands

### `projects space-access user grant`

Grants a user access to a space.

**Arguments:**

- `projectUuid`: UUID of the project.
- `spaceUuid`: UUID of the space.
- `userUuid`: UUID of the user.
- `role`: Role to grant (e.g., `viewer`, `editor`, `admin`).

### `projects space-access user revoke`

Revokes a user's access from a space.

**Arguments:**

- `projectUuid`: UUID of the project.
- `spaceUuid`: UUID of the space.
- `userUuid`: UUID of the user.

### `projects space-access group grant`

Grants a group access to a space.

**Arguments:**

- `projectUuid`: UUID of the project.
- `spaceUuid`: UUID of the space.
- `groupUuid`: UUID of the group.
- `role`: Role to grant.

### `projects space-access group revoke`

Revokes a group's access from a space.

**Arguments:**

- `projectUuid`: UUID of the project.
- `spaceUuid`: UUID of the space.
- `groupUuid`: UUID of the group.

## MCP Tools

### `grant_user_space_access`

- **Parameters:** `projectUuid`, `spaceUuid`, `userUuid`, `role`.
- **Returns:** Confirmation message.

### `revoke_user_space_access`

- **Parameters:** `projectUuid`, `spaceUuid`, `userUuid`.
- **Returns:** Confirmation message.

### `grant_group_space_access`

- **Parameters:** `projectUuid`, `spaceUuid`, `groupUuid`, `role`.
- **Returns:** Confirmation message.

### `revoke_group_space_access`

- **Parameters:** `projectUuid`, `spaceUuid`, `groupUuid`.
- **Returns:** Confirmation message.
