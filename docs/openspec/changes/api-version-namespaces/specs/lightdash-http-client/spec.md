# Spec: Lightdash HTTP client (Modified)

## MODIFIED Requirements

### Requirement: Client configuration

The client SHALL accept configuration with a base URL and an API key. The base URL SHALL be the Lightdash instance root (e.g. `https://app.lightdash.cloud`). The API key SHALL be a Personal Access Token used for authentication. The client SHALL create separate HTTP client instances for each API version, each with its own baseURL (`/api/v1` or `/api/v2`).

#### Scenario: Client created with valid config

- **WHEN** the client is created with `baseUrl` and `apiKey`
- **THEN** subsequent API requests use that base URL and send the API key in the Authorization header

#### Scenario: Request URL construction for v1

- **WHEN** the client issues a request through `client.v1.*` to an endpoint path (e.g. `/projects/{uuid}`)
- **THEN** the request URL SHALL be `{baseUrl}/api/v1{path}`

#### Scenario: Request URL construction for v2

- **WHEN** the client issues a request through `client.v2.*` to an endpoint path (e.g. `/projects/{uuid}/query/metric-query`)
- **THEN** the request URL SHALL be `{baseUrl}/api/v2{path}`

### Requirement: Versioned API client structure

The client SHALL expose versioned namespaces (`client.v1.*` and `client.v2.*`) containing API clients for each version. Existing API clients (projects, organizations, charts, dashboards, spaces, query) SHALL be accessible through `client.v1.*`. New v2-specific clients SHALL be accessible through `client.v2.*`. Deprecated top-level aliases (e.g., `client.projects`) SHALL delegate to `client.v1.*` for backward compatibility.

#### Scenario: V1 API clients accessible

- **WHEN** a `LightdashClient` instance is created
- **THEN** `client.v1.projects`, `client.v1.organizations`, `client.v1.charts`, `client.v1.dashboards`, `client.v1.spaces`, and `client.v1.query` SHALL be accessible

#### Scenario: V2 API clients accessible

- **WHEN** a `LightdashClient` instance is created
- **THEN** `client.v2.query` SHALL be accessible (with other v2 clients added as needed)

#### Scenario: Deprecated aliases delegate to v1

- **WHEN** existing code accesses `client.projects`, `client.organizations`, etc.
- **THEN** these SHALL delegate to `client.v1.projects`, `client.v1.organizations`, etc., and SHALL function correctly
