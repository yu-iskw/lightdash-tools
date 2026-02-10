# Tasks: V2 HTTP clients for org and project role management

## 1. Organization roles client

- [x] 1.1 Add `packages/client/src/api/v2/organization-roles.ts` with a class (e.g. `OrganizationRolesClient`) extending `BaseApiClient`, implementing:
  - `getRoles(orgUuid, query?)` – GET `/orgs/{orgUuid}/roles`
  - `createRole(orgUuid, body)` – POST `/orgs/{orgUuid}/roles`
  - `getRole(orgUuid, roleUuid)` – GET `/orgs/{orgUuid}/roles/{roleUuid}`
  - `updateRole(orgUuid, roleUuid, body)` – PATCH
  - `deleteRole(orgUuid, roleUuid)` – DELETE
  - `addScopesToRole(orgUuid, roleUuid, body)` – POST scopes
  - `removeScopeFromRole(orgUuid, roleUuid, scopeName)` – DELETE scope
  - `duplicateRole(orgUuid, roleId, body?)` – POST duplicate
  - `listRoleAssignments(orgUuid)` – GET `/orgs/{orgUuid}/roles/assignments`
  - `assignRoleToUser(orgUuid, userId, body?)` – POST `/orgs/{orgUuid}/roles/assignments/user/{userId}`
- [x] 1.2 Use request/response types from `@lightdash-tools/common` (components schemas or LightdashApi) where applicable.

## 2. Project role assignments client

- [x] 2.1 Add `packages/client/src/api/v2/project-role-assignments.ts` with a class (e.g. `ProjectRoleAssignmentsClient`) extending `BaseApiClient`, implementing:
  - `listAssignments(projectId)` – GET `/projects/{projectId}/roles/assignments`
  - `upsertUserAssignment(projectId, userId, body)` – POST user
  - `deleteUserAssignment(projectId, userId)` – DELETE user
  - `upsertGroupAssignment(projectId, groupId, body)` – POST group
  - `deleteGroupAssignment(projectId, groupId)` – DELETE group
  - `updateGroupAssignment(projectId, groupId, body)` – PATCH group
- [x] 2.2 Use request/response types from `@lightdash-tools/common` where applicable.

## 3. Wire into client and exports

- [x] 3.1 In `packages/client/src/client.ts`, import the new client classes from `./api/v2/organization-roles` and `./api/v2/project-role-assignments`.
- [x] 3.2 Add `organizationRoles` and `projectRoleAssignments` to `V2ApiClients`, instantiating them with the v2 `HttpClient` in the constructor.
- [x] 3.3 Export the new client classes from `packages/client/src/index.ts` (or the appropriate public entry) if they are part of the public API.

## 4. Tests

- [x] 4.1 Add `packages/client/src/api/v2/organization-roles.test.ts` with unit tests for the organization roles client (following patterns in `api/v2/query.test.ts` and v1 tests).
- [x] 4.2 Add `packages/client/src/api/v2/project-role-assignments.test.ts` with unit tests for the project role assignments client.

## 5. Verification

- [x] 5.1 Run `pnpm build` from repo root and fix any type or build errors.
- [x] 5.2 Run `pnpm test` and fix any failing tests.
- [x] 5.3 Run project lint/format checks if applicable.
