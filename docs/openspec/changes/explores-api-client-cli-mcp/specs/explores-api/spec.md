# Spec: Explores API (client, CLI, MCP)

## ADDED Requirements

### Requirement: List explores endpoint

The HTTP client SHALL expose a method that performs `GET /api/v1/projects/{projectUuid}/explores` and returns the response body's result array (ApiExploresResults). The method SHALL accept `projectUuid` as a string parameter.

#### Scenario: List explores path and method

- **WHEN** the client calls the list explores method with a given projectUuid
- **THEN** the HTTP layer SHALL perform a GET request to `/projects/{projectUuid}/explores` (relative to the v1 base path)
- **AND** the method SHALL return a value typed as the API list response (array of summary explore)

### Requirement: Get explore endpoint

The HTTP client SHALL expose a method that performs `GET /api/v1/projects/{projectUuid}/explores/{exploreId}` and returns the response body's result (ApiExploreResults). The method SHALL accept `projectUuid` and `exploreId` as string parameters.

#### Scenario: Get explore path and method

- **WHEN** the client calls the get explore method with projectUuid and exploreId
- **THEN** the HTTP layer SHALL perform a GET request to `/projects/{projectUuid}/explores/{exploreId}` (relative to the v1 base path)
- **AND** the method SHALL return a value typed as the API get response (single explore)

### Requirement: CLI explores commands

The CLI SHALL register under the existing `projects` command a subcommand group `explores` with:

- `list <projectUuid>`: invokes the client list explores method and prints the result as JSON.
- `get <projectUuid> <exploreId>`: invokes the client get explore method and prints the result as JSON.

#### Scenario: CLI list explores

- **WHEN** the user runs `projects explores list <projectUuid>`
- **THEN** the CLI SHALL call `client.v1.explores.listExplores(projectUuid)` and output the result as JSON (e.g. JSON.stringify with indentation)

#### Scenario: CLI get explore

- **WHEN** the user runs `projects explores get <projectUuid> <exploreId>`
- **THEN** the CLI SHALL call `client.v1.explores.getExplore(projectUuid, exploreId)` and output the result as JSON

### Requirement: MCP explores tools

The MCP server SHALL register two tools:

- **list_explores**: input `projectUuid` (string). Calls `client.v1.explores.listExplores(projectUuid)` and returns the result as JSON text in MCP content.
- **get_explore**: inputs `projectUuid` (string), `exploreId` (string). Calls `client.v1.explores.getExplore(projectUuid, exploreId)` and returns the result as JSON text in MCP content.

#### Scenario: MCP list_explores

- **WHEN** a client invokes the list_explores tool with a valid projectUuid
- **THEN** the tool SHALL call the HTTP client list explores method and return the response as text content (JSON)

#### Scenario: MCP get_explore

- **WHEN** a client invokes the get_explore tool with valid projectUuid and exploreId
- **THEN** the tool SHALL call the HTTP client get explore method and return the response as text content (JSON)

### Requirement: Types

Request and response types SHALL be derived from the OpenAPI specification (ApiExploresResults, ApiExploreResults or equivalent). The client package MAY use types from `@lightdash-tools/common` (generated or re-exported) and SHALL NOT define duplicate shapes.
