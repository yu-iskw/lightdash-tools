# Spec: V2 HTTP clients for org and project role management

## ADDED Requirements

### Requirement: V2 organization roles client

The client package SHALL provide a v2 API client that implements methods for organization roles: list (GET), create (POST), get by UUID (GET), update (PATCH), delete (DELETE), add scopes (POST), remove scope (DELETE), and duplicate role (POST). All requests SHALL use the existing v2 HTTP client (base path `/api/v2`).

#### Scenario: Org roles module path

- **WHEN** a source file implements the v2 organization roles client
- **THEN** that file SHALL live under `packages/client/src/api/v2/`

#### Scenario: Org role assignments on same client

- **WHEN** the v2 API exposes org role assignments (list, assign user)
- **THEN** the client SHALL provide methods for listing org role assignments and assigning an org role to a user, in the same or a dedicated v2 module under `api/v2/`

### Requirement: V2 project role assignments client

The client package SHALL provide a v2 API client that implements methods for project role assignments: list (GET), upsert user assignment (POST), delete user assignment (DELETE), upsert group assignment (POST), delete group assignment (DELETE), update group assignment (PATCH). All requests SHALL use the existing v2 HTTP client (base path `/api/v2`).

#### Scenario: Project role assignments module path

- **WHEN** a source file implements the v2 project role assignments client
- **THEN** that file SHALL live under `packages/client/src/api/v2/`

### Requirement: V2 API clients wiring

The new v2 clients SHALL be exposed on `LightdashClient` via the existing `client.v2` namespace (e.g. `client.v2.organizationRoles`, `client.v2.projectRoleAssignments`). The client SHALL use the shared `BaseApiClient` and the v2 axios instance (base URL `/api/v2`).

#### Scenario: V2 namespace exposure

- **WHEN** a consumer accesses `client.v2`
- **THEN** they SHALL see at least `query`, `organizationRoles`, and `projectRoleAssignments` (or the chosen property names for the new clients)

### Requirement: Types from common package

The new v2 client methods SHALL use request and response types from `@lightdash-tools/common` (generated OpenAPI components or `LightdashApi` domain types) where applicable, and SHALL NOT define duplicate type shapes for API contracts.

#### Scenario: Role request types from common

- **WHEN** a v2 client method accepts a request body for create role, update role, or add scopes
- **THEN** the parameter type SHALL be imported from `@lightdash-tools/common` (e.g. CreateRole, UpdateRole, AddScopesToRole) and SHALL NOT be redefined in the client package
