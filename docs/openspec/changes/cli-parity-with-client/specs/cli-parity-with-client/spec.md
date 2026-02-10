# Spec: CLI parity with HTTP client (phased by domain)

## ADDED Requirements

### Requirement: Typed clients only for groups and users

The CLI SHALL use the typed clients `client.v1.groups` and `client.v1.users` for all groups and users operations. The CLI SHALL NOT call `client.getHttpClientV1()` (or equivalent raw HTTP) for groups or users endpoints.

#### Scenario: groups list uses GroupsClient

- **GIVEN** the user runs `lightdash-ai groups list`
- **WHEN** the command executes
- **THEN** the implementation SHALL call `client.v1.groups.listGroups(params)` with optional params derived from CLI options
- **AND** SHALL NOT use `client.getHttpClientV1().get(...)` for groups

#### Scenario: users list uses UsersClient

- **GIVEN** the user runs `lightdash-ai users list`
- **WHEN** the command executes
- **THEN** the implementation SHALL call `client.v1.users.listMembers(params)` with optional params derived from CLI options
- **AND** SHALL NOT use `client.getHttpClientV1().get(...)` for users

### Requirement: List command options (Phase 1)

Where the client supports query parameters for list methods, the CLI SHALL expose the most useful options as command-line flags.

#### Scenario: groups list options

- **GIVEN** `GroupsClient.listGroups` accepts `ListGroupsParams` (e.g. page, pageSize, includeMembers, searchQuery)
- **WHEN** the user runs `lightdash-ai groups list`
- **THEN** the CLI SHALL accept optional options (e.g. `--page-size`, `--page`, `--search`) and pass them to `listGroups(params)`

#### Scenario: users list options

- **GIVEN** `UsersClient.listMembers` accepts `ListMembersParams` (e.g. page, pageSize, searchQuery, projectUuid)
- **WHEN** the user runs `lightdash-ai users list`
- **THEN** the CLI SHALL accept optional options (e.g. `--page-size`, `--page`, `--search`) and pass them to `listMembers(params)`

### Requirement: Optional get subcommands (Phase 1)

The CLI SHALL provide `groups get <uuid>` and `users get <uuid>` that call `client.v1.groups.getGroup(uuid)` and `client.v1.users.getMemberByUuid(uuid)`. The CLI MAY provide `users get --email <email>` that calls `client.v1.users.getMemberByEmail(email)` in a follow-up.

#### Scenario: groups get subcommand

- **GIVEN** the user runs `lightdash-ai groups get <groupUuid>`
- **WHEN** the command executes
- **THEN** the implementation SHALL call `client.v1.groups.getGroup(groupUuid, params?)` and output the result as JSON

#### Scenario: users get by UUID

- **GIVEN** the user runs `lightdash-ai users get <userUuid>`
- **WHEN** the command executes
- **THEN** the implementation SHALL call `client.v1.users.getMemberByUuid(userUuid)` and output the result as JSON

### Requirement: Design doc update

The OpenSpec design document for the initial CLI (`docs/openspec/changes/lightdash-cli/design.md`) SHALL be updated to remove the decision "Use HTTP client directly for Groups/Users" and SHALL state that the CLI uses typed clients for groups and users.

#### Scenario: Design doc reflects typed clients

- **GIVEN** the change cli-parity-with-client is implemented
- **WHEN** a reader opens `docs/openspec/changes/lightdash-cli/design.md`
- **THEN** the document SHALL NOT contain "Use HTTP client directly for Groups/Users" as the chosen approach for groups/users
- **AND** the document SHALL state that the CLI uses `client.v1.groups` and `client.v1.users` (or reference ADR-0010 / cli-parity-with-client)

### Requirement: Phase 2 organization roles (v2)

The CLI SHALL provide `organization roles` subcommands that call `client.v2.organizationRoles` using the current organization UUID from `client.v1.organizations.getCurrentOrganization()`.

#### Scenario: organization roles list

- **GIVEN** the user runs `lightdash-ai organization roles list`
- **WHEN** the command executes
- **THEN** the implementation SHALL resolve org UUID via `getCurrentOrganization().organizationUuid` and call `client.v2.organizationRoles.getRoles(orgUuid, params?)` and output JSON

#### Scenario: organization roles assign

- **GIVEN** the user runs `lightdash-ai organization roles assign <userUuid> --role-id <roleId>`
- **WHEN** the command executes
- **THEN** the implementation SHALL call `client.v2.organizationRoles.assignRoleToUser(orgUuid, userUuid, { roleId })` and output JSON

### Requirement: Phase 2 project roles, access, spaces

The CLI SHALL provide `projects roles`, `projects access`, and `projects spaces` subcommands that call `client.v2.projectRoleAssignments`, `client.v1.projectAccess`, and `client.v1.spaces` with the given project UUID.

#### Scenario: projects roles list

- **GIVEN** the user runs `lightdash-ai projects roles list <projectUuid>`
- **THEN** the implementation SHALL call `client.v2.projectRoleAssignments.listAssignments(projectUuid)` and output JSON

#### Scenario: projects spaces list

- **GIVEN** the user runs `lightdash-ai projects spaces list <projectUuid>`
- **THEN** the implementation SHALL call `client.v1.spaces.listSpacesInProject(projectUuid)` and output JSON

### Requirement: Phase 3 charts, dashboards, ai-agents

The CLI SHALL provide `projects charts list`, `projects dashboards list`, and top-level `ai-agents` with `list`, `threads`, `settings` that call the corresponding v1 client methods.

#### Scenario: projects charts list

- **GIVEN** the user runs `lightdash-ai projects charts list <projectUuid>`
- **THEN** the implementation SHALL call `client.v1.charts.listCharts(projectUuid)` and output JSON

#### Scenario: ai-agents list

- **GIVEN** the user runs `lightdash-ai ai-agents list`
- **THEN** the implementation SHALL call `client.v1.aiAgents.listAdminAgents()` and output JSON

## References

- ADR-0010: CLI parity with client package (phased by domain)
- packages/client: UsersClient, GroupsClient, ListMembersParams, ListGroupsParams; OrganizationRolesClient, ProjectRoleAssignmentsClient, ProjectAccessClient, SpacesClient, ChartsClient, DashboardsClient, AiAgentsClient
