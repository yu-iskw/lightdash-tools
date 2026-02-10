# Design: V2 HTTP clients for org and project role management

## Context

- The client package has a v2 HTTP client (base path `/api/v2`) and currently exposes only `QueryClientV2` via `client.v2.query` (`packages/client/src/client.ts`). All v2 client modules live under `packages/client/src/api/v2/` and extend `BaseApiClient` (`packages/client/src/api/base-client.ts`).
- The OpenAPI spec defines v2 paths: `/api/v2/orgs/{orgUuid}/roles`, `/api/v2/orgs/{orgUuid}/roles/{roleUuid}`, scopes and duplicate; `/api/v2/orgs/{orgUuid}/roles/assignments` and `.../assignments/user/{userId}`; `/api/v2/projects/{projectId}/roles/assignments` and user/group sub-paths. Path parameter names in the API are `orgUuid`, `roleUuid`, `projectId`, `userId`, `groupId`.
- Types for Role, CreateRole, UpdateRole, AddScopesToRole, and role assignment request/response live in `packages/common/src/types/generated/openapi-types.ts` under `components['schemas']`. The common package re-exports domain types via `LightdashApi`; role-related types may be used via `components['schemas']` or added to a domain re-export if needed.

## Goals / Non-Goals

**Goals:**

- Add typed v2 client methods for all v2 org role and project role assignment endpoints.
- Keep module boundaries clear: one module for org roles (including org role assignments), one for project role assignments.
- Use existing v2 HTTP client and BaseApiClient; no new axios instance or base URL.

**Non-Goals:**

- Adding v2 clients for organization, projects, users, groups, or space-level access (v1 only in public spec).
- Changing v1 client behavior or moving v1 code.

## Decisions

### Decision 1: Module split

**Choice:** Two new modules under `api/v2/`:

1. **organization-roles.ts** – `OrganizationRolesClientV2` (or `OrganizationRolesClient`): methods for org roles (list, create, get, update, delete, addScopes, removeScope, duplicate) and org role assignments (listAssignments, assignRoleToUser).
2. **project-role-assignments.ts** – `ProjectRoleAssignmentsClientV2` (or `ProjectRoleAssignmentsClient`): methods for list, upsertUserAssignment, deleteUserAssignment, upsertGroupAssignment, deleteGroupAssignment, updateGroupAssignment.

**Rationale:** Aligns with API surface (org vs project); keeps files focused and testable.

### Decision 2: Parameter names

**Choice:** Use the same parameter names as the OpenAPI path and body: `orgUuid`, `roleUuid`, `roleId` (for duplicate), `projectId` (v2 paths use `projectId`), `userId`, `groupId`, `scopeName`. Method signatures will use these names so callers pass the correct identifiers.

**Rationale:** Reduces confusion when reading API docs; projectId is used in v2 role paths even if the codebase elsewhere uses projectUuid.

### Decision 3: Types

**Choice:** Import types from `@lightdash-tools/common`. Use `components['schemas']['CreateRole']`, `UpdateRole`, `AddScopesToRole`, `Role`, `RoleWithScopes`, and assignment request/response types from the generated openapi-types. If the common package does not re-export these under a domain namespace, the client may import from the generated types via the common package’s export of `components` or from a dedicated common export added in this or a follow-up change.

**Rationale:** Single source of truth for API contracts; no duplicate type definitions in the client.

### Decision 4: V2ApiClients and client.ts

**Choice:** Add `organizationRoles: OrganizationRolesClient` and `projectRoleAssignments: ProjectRoleAssignmentsClient` to the `V2ApiClients` class in `client.ts`, constructing them with the same `http` (v2 HttpClient) passed to the constructor. Export the new client classes from `api/v2/organization-roles` and `api/v2/project-role-assignments` and import them in `client.ts`.

**Rationale:** Matches existing pattern for `V2ApiClients.query`; no change to constructor or config.

## Risks / Trade-offs

- **projectId vs projectUuid:** Callers used to `projectUuid` elsewhere must pass the same value as `projectId` for project role assignment methods; we document this in JSDoc.
- **Types not in common:** If a role or assignment type is not exported from `@lightdash-tools/common`, we add a minimal re-export in the common package or use the generated path; preference is to keep client free of openapi-types path details if possible.

## Migration Plan

- No migration. New APIs only; existing `client.v1.*` and `client.v2.query` unchanged.
