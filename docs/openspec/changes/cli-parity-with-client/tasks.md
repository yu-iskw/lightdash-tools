# Tasks: CLI parity with HTTP client (Phase 1)

## 1. Refactor groups command

- [x] 1.1 In `packages/cli/src/commands/groups.ts`, replace the implementation of `groups list` to call `client.v1.groups.listGroups(params)` instead of `client.getHttpClientV1().get('/org/groups')`. Build `params` from Commander options: `--page`, `--page-size`, `--search`, and optionally `--include-members`.
- [x] 1.2 Add subcommand `groups get <groupUuid>` that calls `client.v1.groups.getGroup(groupUuid, params?)` and outputs JSON. Register the subcommand in the same file.
- [x] 1.3 Remove any use of `client.getHttpClientV1()` in `groups.ts`. Remove the comment that says "Uses HTTP client directly since GroupsClient doesn't exist yet."

## 2. Refactor users command

- [x] 2.1 In `packages/cli/src/commands/users.ts`, replace the implementation of `users list` to call `client.v1.users.listMembers(params)` instead of `client.getHttpClientV1().get('/org/users')`. Build `params` from Commander options: `--page`, `--page-size`, `--search`.
- [x] 2.2 Add subcommand `users get <userUuid>` that calls `client.v1.users.getMemberByUuid(userUuid)` and outputs JSON. Register the subcommand in the same file.
- [x] 2.3 Remove any use of `client.getHttpClientV1()` in `users.ts`. Remove the comment that says "Uses HTTP client directly since UsersClient doesn't exist yet."

## 3. Update initial CLI design doc

- [x] 3.1 In `docs/openspec/changes/lightdash-cli/design.md`, remove or replace "Decision 5: Use HTTP Client Directly for Groups/Users" with a decision that the CLI uses typed clients (`client.v1.groups`, `client.v1.users`) for groups and users. Update the "Risks / Trade-offs" subsection "Groups/Users Implementation" to state that the CLI now uses typed clients (see ADR-0010 and OpenSpec change cli-parity-with-client).

## 4. Tests and verification

- [x] 4.1 Add or extend tests in `packages/cli` for groups list (with options) and groups get, and for users list (with options) and users get. Ensure existing tests still pass.
- [x] 4.2 Run `pnpm build` from repo root and fix any type or build errors.
- [x] 4.3 Run `pnpm test` and fix any failing tests.
- [x] 4.4 Run project lint/format checks if applicable.

---

## Phase 2: Organization roles, project roles, project access, spaces

- [x] 5.1 Add `packages/cli/src/commands/organization-roles.ts`: register `organization roles list`, `roles get <roleUuid>`, `roles assignments list`, `roles assign <userUuid> --role-id <id>`. Resolve org UUID via `client.v1.organizations.getCurrentOrganization().organizationUuid`. Use `client.v2.organizationRoles`.
- [x] 5.2 Add `packages/cli/src/commands/project-role-assignments.ts`: register under `projects` as `projects roles list <projectUuid>`, `projects roles assign user <projectUuid> <userUuid> --role-id <id>`, `projects roles unassign user <projectUuid> <userUuid>`, `projects roles assign group ...`, `projects roles unassign group ...`. Use `client.v2.projectRoleAssignments`.
- [x] 5.3 Add `packages/cli/src/commands/project-access.ts`: register under `projects` as `projects access list <projectUuid>`, `projects access groups list <projectUuid>`, `projects access get <projectUuid> <userUuid>`. Use `client.v1.projectAccess`.
- [x] 5.4 Add `packages/cli/src/commands/spaces.ts`: register under `projects` as `projects spaces list <projectUuid>`, `projects spaces get <projectUuid> <spaceUuid>`. Use `client.v1.spaces`.
- [x] 5.5 In `packages/cli/src/index.ts`, register the new command modules (organization roles must add to existing organization command; project-\* and spaces add to existing projects command). Ensure `organization` and `projects` are registered before the new modules so subcommands attach to the right parent.
- [x] 5.6 Add tests for Phase 2 command registration. Run `pnpm build`, `pnpm test`, `pnpm lint`.

---

## Phase 3: Charts, dashboards, ai-agents

- [x] 6.1 Add `packages/cli/src/commands/charts.ts`: register `projects charts list <projectUuid>` using `client.v1.charts.listCharts(projectUuid)`.
- [x] 6.2 Add `packages/cli/src/commands/dashboards.ts`: register `projects dashboards list <projectUuid>` using `client.v1.dashboards.listDashboards(projectUuid)`.
- [x] 6.3 Add `packages/cli/src/commands/ai-agents.ts`: top-level `ai-agents` with `list`, `threads [--page-size N] [--page N]`, `settings` using `client.v1.aiAgents`.
- [x] 6.4 In `packages/cli/src/index.ts`, register charts, dashboards, ai-agents.
- [x] 6.5 Add tests for Phase 3 command registration. Run `pnpm build`, `pnpm test`, `pnpm lint`.
