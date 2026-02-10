# Spec: Client API folder layout by version

## ADDED Requirements

### Requirement: V1 API client modules under api/v1

The client package SHALL place all v1 API client modules (e.g. projects, organizations, charts, dashboards, spaces, query, users, groups, ai-agents, project-access) and their unit test files under `packages/client/src/api/v1/`.

#### Scenario: V1 module path

- **WHEN** a source file implements a v1 API client (e.g. ProjectsClient, QueryClient used by client.v1)
- **THEN** that file SHALL live under `packages/client/src/api/v1/`

#### Scenario: V1 test path

- **WHEN** a test file tests a v1 API client module
- **THEN** that test file SHALL live under `packages/client/src/api/v1/`

### Requirement: V2 API client modules under api/v2

The client package SHALL place all v2 API client modules (e.g. QueryClientV2) and their unit test files under `packages/client/src/api/v2/`.

#### Scenario: V2 module path

- **WHEN** a source file implements a v2 API client (e.g. QueryClientV2 used by client.v2)
- **THEN** that file SHALL live under `packages/client/src/api/v2/`

### Requirement: Shared base in api root

The client package SHALL keep shared base code (e.g. BaseApiClient in base-client.ts) in `packages/client/src/api/` so that both v1 and v2 client modules may import it without cross-version coupling.

#### Scenario: Base client location

- **WHEN** a module is shared by both v1 and v2 API clients (e.g. BaseApiClient)
- **THEN** that module SHALL reside in `packages/client/src/api/` and SHALL NOT live under `api/v1/` or `api/v2/`

#### Scenario: V1 and v2 import base

- **WHEN** v1 or v2 client modules require the shared base
- **THEN** they SHALL import from `../base-client` (or the appropriate path within `api/`)
