# group-management-parity Tasks

## Phase 1: CLI Implementation

### Task: Implement `groups create` [completed]

- **File**: `packages/cli/src/commands/groups.ts`
- **Steps**:
  - [x] Add `.command('create')` with `--name <name>` option.
  - [x] Implement action using `wrapAction(WRITE_IDEMPOTENT, ...)` and `client.v1.groups.createGroup({ name })`.
  - [x] Log result as JSON.

### Task: Implement `groups update` [completed]

- **File**: `packages/cli/src/commands/groups.ts`
- **Steps**:
  - [x] Add `.command('update <groupUuid>')` with `--name <name>` option.
  - [x] Implement action using `wrapAction(WRITE_IDEMPOTENT, ...)` and `client.v1.groups.updateGroup(groupUuid, { name })`.
  - [x] Log result as JSON.

### Task: Implement `groups delete` [completed]

- **File**: `packages/cli/src/commands/groups.ts`
- **Steps**:
  - [x] Add `.command('delete <groupUuid>')`.
  - [x] Implement action using `wrapAction(WRITE_DESTRUCTIVE, ...)` and `client.v1.groups.deleteGroup(groupUuid)`.
  - [x] Log success message.

### Task: Implement `groups members` subcommands [completed]

- **File**: `packages/cli/src/commands/groups.ts`
- **Steps**:
  - [x] Create `members` command group: `const membersCmd = groupsCmd.command('members').description('Manage group members')`.
  - [x] Implement `membersCmd.command('list <groupUuid>')` using `client.v1.groups.getGroupMembers(groupUuid)`.
  - [x] Implement `membersCmd.command('add <groupUuid> <userUuid>')` using `client.v1.groups.addUserToGroup(groupUuid, userUuid)`.
  - [x] Implement `membersCmd.command('remove <groupUuid> <userUuid>')` using `client.v1.groups.removeUserFromGroup(groupUuid, userUuid)`.

## Phase 2: MCP Implementation

### Task: Register new group tools [completed]

- **File**: `packages/mcp/src/tools/groups.ts`
- **Steps**:
  - [x] Update imports to include `WRITE_IDEMPOTENT` and `WRITE_DESTRUCTIVE` from `./shared.js`.
  - [x] Register `create_group`: Input `{ name: z.string() }`, Annotations `WRITE_IDEMPOTENT`.
  - [x] Register `update_group`: Input `{ groupUuid: z.string(), name: z.string() }`, Annotations `WRITE_IDEMPOTENT`.
  - [x] Register `delete_group`: Input `{ groupUuid: z.string() }`, Annotations `WRITE_DESTRUCTIVE`.
  - [x] Register `list_group_members`: Input `{ groupUuid: z.string() }`, Annotations `READ_ONLY_DEFAULT`.
  - [x] Register `add_user_to_group`: Input `{ groupUuid: z.string(), userUuid: z.string() }`, Annotations `WRITE_IDEMPOTENT`.
  - [x] Register `remove_user_from_group`: Input `{ groupUuid: z.string(), userUuid: z.string() }`, Annotations `WRITE_DESTRUCTIVE`.

## Phase 3: Verification

### Task: Verify CLI commands [completed]

- [x] Run `lightdash-tools groups --help` to check subcommand registration.
- [x] (Optional) Run commands against a test instance if available.

### Task: Verify MCP tools [completed]

- [x] Run `pnpm --filter @lightdash-tools/mcp test` (if tests exist) or inspect the code.
