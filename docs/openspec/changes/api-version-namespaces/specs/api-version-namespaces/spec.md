# Spec: API Version Namespaces

## ADDED Requirements

### Requirement: Versioned HTTP client instances

The client SHALL create separate HTTP client instances for each API version (v1, v2). Each instance SHALL have its own axios instance with a version-specific baseURL (`/api/v1` or `/api/v2`). Both instances SHALL share the same configuration (authentication, rate limiting, retry logic, error handling).

#### Scenario: V1 HTTP client created

- **WHEN** the client is initialized
- **THEN** a v1 HTTP client instance SHALL be created with baseURL `{baseUrl}/api/v1`

#### Scenario: V2 HTTP client created

- **WHEN** the client is initialized
- **THEN** a v2 HTTP client instance SHALL be created with baseURL `{baseUrl}/api/v2`

#### Scenario: Shared configuration

- **WHEN** both v1 and v2 HTTP clients are created
- **THEN** both SHALL use the same authentication token, rate limit settings, retry configuration, and error handling logic

### Requirement: Versioned namespaces

The client SHALL expose `v1` and `v2` properties on `LightdashClient`. Each namespace SHALL contain version-specific API clients (e.g., `client.v1.projects`, `client.v2.query`). API clients within a namespace SHALL use the corresponding HTTP client instance.

#### Scenario: V1 namespace accessible

- **WHEN** a `LightdashClient` instance is created
- **THEN** the `v1` property SHALL be accessible and contain v1 API clients (projects, organizations, charts, dashboards, spaces, query)

#### Scenario: V2 namespace accessible

- **WHEN** a `LightdashClient` instance is created
- **THEN** the `v2` property SHALL be accessible and contain v2 API clients (initially query, expandable to other areas)

#### Scenario: Version-specific HTTP clients

- **WHEN** an API client method is called through `client.v1.*`
- **THEN** the request SHALL use the v1 HTTP client instance (baseURL `/api/v1`)

#### Scenario: V2 endpoint access

- **WHEN** an API client method is called through `client.v2.*`
- **THEN** the request SHALL use the v2 HTTP client instance (baseURL `/api/v2`)

### Requirement: Backward compatibility

The client SHALL maintain backward compatibility by exposing deprecated aliases for existing API clients. These aliases SHALL delegate to the corresponding v1 namespace methods. Deprecated aliases SHALL be documented as deprecated and SHALL be removed in a future major version.

#### Scenario: Deprecated alias works

- **WHEN** existing code calls `client.projects.getProject(uuid)`
- **THEN** the call SHALL succeed and delegate to `client.v1.projects.getProject(uuid)`

#### Scenario: Deprecation guidance

- **WHEN** a user accesses a deprecated alias (e.g., `client.projects`)
- **THEN** the API SHALL function correctly, but documentation SHALL indicate migration to `client.v1.projects`

### Requirement: Type safety per version

The client SHALL maintain type safety such that `client.v1.*` methods use v1-specific types from the OpenAPI spec, and `client.v2.*` methods use v2-specific types. Type extraction SHALL work correctly for both versions.

#### Scenario: V1 type safety

- **WHEN** calling `client.v1.projects.getProject(uuid)`
- **THEN** the return type SHALL be the v1 Project type from the OpenAPI spec

#### Scenario: V2 type safety

- **WHEN** calling `client.v2.query.runMetricQuery(projectUuid, body)`
- **THEN** the return type SHALL be the v2 query response type from the OpenAPI spec

### Requirement: V2 query endpoints

The client SHALL provide v2 query endpoints through `client.v2.query`. These SHALL include endpoints such as `/api/v2/projects/{projectUuid}/query/metric-query`, `/api/v2/projects/{projectUuid}/query/sql`, and other v2 query operations.

#### Scenario: V2 metric query

- **WHEN** the caller invokes `client.v2.query.runMetricQuery(projectUuid, body)`
- **THEN** the client SHALL send POST to `/api/v2/projects/{projectUuid}/query/metric-query` with the request body

#### Scenario: V2 SQL query

- **WHEN** the caller invokes `client.v2.query.runSqlQuery(projectUuid, body)`
- **THEN** the client SHALL send POST to `/api/v2/projects/{projectUuid}/query/sql` with the request body
