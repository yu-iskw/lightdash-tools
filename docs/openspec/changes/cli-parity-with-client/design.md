# Design: CLI parity with HTTP client (Phase 1)

## Context

- The CLI lives in `packages/cli` and uses `@lightdash-tools/client`. It currently has commands: `organization get`, `projects get` / `projects list`, `groups list`, `users list`. Organization and projects use typed clients (`client.v1.organizations`, `client.v1.projects`). Groups and users use raw HTTP via `client.getHttpClientV1().get('/org/groups')` and `get('/org/users')` (see `docs/openspec/changes/lightdash-cli/design.md` Decision 5).
- The client package exposes `UsersClient` and `GroupsClient` with `listMembers(params?)`, `listGroups(params?)`, `getMemberByUuid`, `getMemberByEmail`, `getGroup(uuid, params?)`, etc. Types: `ListMembersParams`, `ListGroupsParams` (page, pageSize, searchQuery, etc.).

## Goals / Non-Goals

**Goals:**

- Refactor groups and users commands to use `client.v1.groups` and `client.v1.users` only (no raw HTTP).
- Expose key list params as CLI options (e.g. `--page-size`, `--page`, `--search`).
- Add optional `groups get <uuid>` and `users get <uuid>` (and optionally `users get --email <email>`).
- Update the initial CLI design doc to remove the "Use HTTP client directly for Groups/Users" decision.

**Non-Goals (Phase 1):**

- Phase 2 or Phase 3 commands (covered in Phase 2/3 sections below).

## Decisions

### Decision 1: Groups command implementation

**Choice:** In `packages/cli/src/commands/groups.ts`:

- `groups list`: Call `client.v1.groups.listGroups(options)` where `options` is built from Commander options (e.g. `--page`, `--page-size`, `--search`). Output JSON as today.
- `groups get <groupUuid>`: New subcommand; call `client.v1.groups.getGroup(groupUuid, options)` and output JSON.
- Remove all use of `client.getHttpClientV1()` in this file.

**Rationale:** Single source of truth (typed client); types and params come from the client.

### Decision 2: Users command implementation

**Choice:** In `packages/cli/src/commands/users.ts`:

- `users list`: Call `client.v1.users.listMembers(options)` where `options` is built from Commander options (e.g. `--page`, `--page-size`, `--search`). Output JSON as today.
- `users get <userUuid>`: New subcommand; call `client.v1.users.getMemberByUuid(userUuid)` and output JSON.
- Optionally support `users get --email <email>` that calls `client.v1.users.getMemberByEmail(email)` (either as a second form or via an option). For simplicity, Phase 1 can implement only get by UUID; get by email can be added in the same change or a follow-up.
- Remove all use of `client.getHttpClientV1()` in this file.

**Rationale:** Same as Decision 1; keeps CLI and client in sync.

### Decision 3: Option names and mapping

**Choice:** Map CLI options to client params as follows:

- **groups list**: `--page` → page, `--page-size` → pageSize, `--search` → searchQuery, `--include-members` → includeMembers (optional number).
- **users list**: `--page` → page, `--page-size` → pageSize, `--search` → searchQuery. Omit projectUuid and googleOidcOnly unless we add flags; can add in a follow-up.

**Rationale:** Familiar flag names; 1:1 mapping to client param names where possible.

### Decision 4: Lightdash-cli design doc update

**Choice:** Edit `docs/openspec/changes/lightdash-cli/design.md`: remove "Decision 5: Use HTTP Client Directly for Groups/Users" (or replace it with "Use typed clients for groups and users") and update the "Risks / Trade-offs" section that refers to Groups/Users implementation. Add a short note that the CLI uses `client.v1.groups` and `client.v1.users` (see ADR-0010 and OpenSpec change cli-parity-with-client).

**Rationale:** Design doc stays accurate; future readers see the current pattern.

## Command tree (Phase 1)

```
lightdash-tools
├── organization get
├── projects get <projectUuid>
├── projects list
├── groups list [--page N] [--page-size N] [--search Q] [--include-members N]
├── groups get <groupUuid>
├── users list [--page N] [--page-size N] [--search Q]
└── users get <userUuid>
```

## Risks / Trade-offs

- **Option creep:** We limit Phase 1 to the most useful list options (page, page-size, search); other params (e.g. projectUuid for users) can be added when needed.
- **Output format:** Remain JSON for consistency; table or other formats can be a later enhancement.

## Migration Plan

- No breaking changes. Existing `groups list` and `users list` remain; behavior is preserved or enhanced (e.g. with new options). New subcommands `groups get` and `users get` are additive.

---

## Phase 2: Organization roles, project roles, project access, spaces

### Context

- Client exposes `client.v2.organizationRoles`, `client.v2.projectRoleAssignments`, `client.v1.projectAccess`, `client.v1.spaces`. Org UUID for v2 org roles is obtained via `client.v1.organizations.getCurrentOrganization()` then `org.organizationUuid`. Project ID for v2 project roles and v1 project-access/spaces is the project UUID from `projects list`.

### Phase 2 command tree

```
lightdash-tools
├── organization get
├── organization roles list [--load] [--role-type-filter]
├── organization roles get <roleUuid>
├── organization roles assignments list
├── organization roles assign <userUuid> --role-id <id>
├── projects get <projectUuid>
├── projects list
├── projects roles list <projectUuid>
├── projects roles assign user <projectUuid> <userUuid> --role-id <id>
├── projects roles unassign user <projectUuid> <userUuid>
├── projects roles assign group <projectUuid> <groupId> --role-id <id>
├── projects roles unassign group <projectUuid> <groupId>
├── projects access list <projectUuid>
├── projects access groups list <projectUuid>
├── projects access get <projectUuid> <userUuid>
├── projects spaces list <projectUuid>
├── projects spaces get <projectUuid> <spaceUuid>
├── groups ...
└── users ...
```

### Phase 2 decisions

- **Organization roles**: New module `organization-roles.ts` registers `organization roles` subcommands on the existing `organization` command (obtained by finding or creating the `organization` command in the program). Org UUID resolved once per invocation via `getCurrentOrganization().organizationUuid`.
- **Project roles, access, spaces**: New modules `project-role-assignments.ts`, `project-access.ts`, `spaces.ts` each register their subcommands under the existing `projects` command (e.g. `projects roles`, `projects access`, `projects spaces`). The `projects` command must be the same Command instance; registration order in `index.ts` will add subcommands to the same parent.
- **Deferred**: Role create/update/delete, add/remove scopes, duplicate; project role updateGroupAssignment; project access grant/revoke; space create/update/delete and share (body-heavy or deprecated).

---

## Phase 3: Charts, dashboards, ai-agents

### Context

- Client exposes `client.v1.charts`, `client.v1.dashboards`, `client.v1.aiAgents`. List/get-style only; run-query omitted (bodies too large; consider `--file` later).

### Phase 3 command tree

```
lightdash-tools
├── ...
├── projects charts list <projectUuid>
├── projects dashboards list <projectUuid>
├── ai-agents list
├── ai-agents threads [--page-size N] [--page N]
├── ai-agents settings
└── ...
```

### Phase 3 decisions

- **Charts and dashboards**: New modules `charts.ts` and `dashboards.ts` register `projects charts` and `projects dashboards` under the existing `projects` command.
- **AI agents**: New top-level command group `ai-agents` in `ai-agents.ts` with subcommands `list`, `threads`, `settings`. Read-only only; defer `updateAiOrganizationSettings`.
- **Query**: Out of scope for Phase 3; document in OpenSpec for future `--file`-based design.
