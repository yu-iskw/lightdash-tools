# Spec: Charts-as-code API (client, CLI, MCP)

## ADDED Requirements

### Requirement: Get charts as code endpoint

The HTTP client SHALL expose a method that performs `GET /api/v1/projects/{projectUuid}/charts/code` and returns the response body (ApiChartAsCodeListResponse). The method SHALL accept `projectUuid` as a string parameter and optional query parameters `ids`, `offset`, and `languageMap`.

#### Scenario: Get charts as code path and method

- **WHEN** the client calls the get charts as code method with a given projectUuid and optional options
- **THEN** the HTTP layer SHALL perform a GET request to `/projects/{projectUuid}/charts/code` (relative to the v1 base path)
- **AND** query parameters SHALL be included when provided (ids, offset, languageMap)
- **AND** the method SHALL return a value typed as the API response (ApiChartAsCodeListResponse)

### Requirement: Upsert chart as code endpoint

The HTTP client SHALL expose a method that performs `POST /api/v1/projects/{projectUuid}/charts/{slug}/code` and returns the response body (ApiChartAsCodeUpsertResponse). The method SHALL accept `projectUuid`, `slug`, and a request body conforming to the OpenAPI upsert chart as code schema.

#### Scenario: Upsert chart as code path and method

- **WHEN** the client calls the upsert chart as code method with projectUuid, slug, and body
- **THEN** the HTTP layer SHALL perform a POST request to `/projects/{projectUuid}/charts/{slug}/code` (relative to the v1 base path)
- **AND** the request body SHALL be sent as application/json
- **AND** the method SHALL return a value typed as the API response (ApiChartAsCodeUpsertResponse)

### Requirement: CLI charts code commands

The CLI SHALL register under the existing `projects charts` command a subcommand group `code` with:

- `list <projectUuid>`: invokes the client getChartsAsCode method and prints the result as JSON. Optional flags for `--ids`, `--offset`, `--language-map` when supported.
- `upsert <projectUuid> <slug>`: reads the chart payload from `--file <path>` or stdin, invokes the client upsertChartAsCode method, and prints the result as JSON.

#### Scenario: CLI charts code list

- **WHEN** the user runs `projects charts code list <projectUuid>`
- **THEN** the CLI SHALL call `client.v1.charts.getChartsAsCode(projectUuid)` (with optional options) and output the result as JSON

#### Scenario: CLI charts code upsert

- **WHEN** the user runs `projects charts code upsert <projectUuid> <slug>` with body from file or stdin
- **THEN** the CLI SHALL call `client.v1.charts.upsertChartAsCode(projectUuid, slug, parsedBody)` and output the result as JSON

### Requirement: MCP charts-as-code tools

The MCP server SHALL register two tools:

- **list_charts_as_code**: input `projectUuid` (string), optional `ids` (array of strings). Calls `client.v1.charts.getChartsAsCode(projectUuid, { ids })` and returns the result as JSON text in MCP content.
- **upsert_chart_as_code**: inputs `projectUuid` (string), `slug` (string), `chart` (object). Calls `client.v1.charts.upsertChartAsCode(projectUuid, slug, chart)` and returns the result as JSON text in MCP content.

#### Scenario: MCP list_charts_as_code

- **WHEN** a client invokes the list_charts_as_code tool with a valid projectUuid (and optionally ids)
- **THEN** the tool SHALL call the HTTP client getChartsAsCode method and return the response as text content (JSON)

#### Scenario: MCP upsert_chart_as_code

- **WHEN** a client invokes the upsert_chart_as_code tool with valid projectUuid, slug, and chart payload
- **THEN** the tool SHALL call the HTTP client upsertChartAsCode method and return the response as text content (JSON)

### Requirement: Types

Request and response types SHALL be derived from the OpenAPI specification (ApiChartAsCodeListResponse, ApiChartAsCodeUpsertResponse, ChartAsCode, and the upsert request body). The client package MAY use types from `@lightdash-tools/common` (generated or re-exported) and SHALL NOT define duplicate shapes.
