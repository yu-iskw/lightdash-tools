# Spec: MCP server using Lightdash HTTP client

## ADDED Requirements

### Requirement: MCP server package and client dependency

The MCP server SHALL live in `packages/mcp` and SHALL depend on `@lightdash-tools/client`, `@modelcontextprotocol/sdk`, and `zod`. All Lightdash API access SHALL go through `LightdashClient`; the MCP package SHALL NOT make direct HTTP requests to the Lightdash API.

#### Scenario: Client instantiation from env

- **WHEN** the MCP server starts
- **THEN** it SHALL build `PartialLightdashClientConfig` from environment variables (e.g. `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`) and SHALL instantiate `LightdashClient` once (e.g. via `mergeConfig` and constructor)

#### Scenario: No stdout for Stdio

- **WHEN** the server runs with Stdio transport
- **THEN** the server SHALL use only stderr for logging and SHALL NOT write to stdout (stdout is used for JSON-RPC)

### Requirement: MCP primitives (Tools first)

The server SHALL expose MCP **Tools** first. Each tool SHALL have a Zod `inputSchema` and SHALL delegate to a method on `LightdashClient` (v1 or v2). Resources and Prompts MAY be added in a later change.

#### Scenario: Tool error mapping

- **WHEN** a tool handler catches `LightdashApiError`, `RateLimitError`, or `NetworkError`
- **THEN** the handler SHALL return MCP content of type `text` with a safe message (e.g. status code and message) and SHALL NOT expose stack traces or tokens in the response

### Requirement: Phase 1 transport (Stdio)

Phase 1 SHALL use **Stdio** transport only. The server SHALL create an `McpServer`, attach `StdioServerTransport`, and connect. The entrypoint SHALL be runnable via `node dist/index.js` (or equivalent).

#### Scenario: MVP tool set

- **WHEN** the server is running
- **THEN** it SHALL list at least the following tools (or equivalent): list_projects, get_project, list_charts, get_chart, list_dashboards, get_dashboard, list_spaces, get_space, list_organization_members, get_member, list_groups, get_group. Each SHALL call the corresponding `client.v1.*` (or v2) method.

### Requirement: Phase 2 transport (Streamable HTTP) and optional auth

Phase 2 SHALL add **Streamable HTTP** as a second transport. Session handling SHALL create a transport on first MCP `initialize` and SHALL store it by session id; subsequent requests SHALL use `Mcp-Session-Id` to find the transport.

#### Scenario: Optional auth middleware

- **WHEN** auth is enabled (e.g. via env)
- **THEN** the server SHALL run middleware before the MCP handler that validates `Authorization: Bearer` or an API key header and SHALL return 401 when the token is missing or invalid. The server SHALL NOT log tokens or keys.

#### Scenario: Auth configurable

- **WHEN** the server is configured for local or single-tenant use
- **THEN** auth MAY be disabled so that the MCP endpoint can be called without a Bearer token or API key

### Requirement: Config and entrypoint

The server SHALL support choosing transport via environment (e.g. `MCP_TRANSPORT=stdio` or `streamable-http`) or via separate entrypoints. Documentation (e.g. README) SHALL describe required env vars (client: `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`; optional auth: e.g. `MCP_AUTH_ENABLED`, `MCP_API_KEY`).

#### Scenario: Transport selection

- **WHEN** the user runs the server
- **THEN** the server SHALL use either Stdio or Streamable HTTP as the transport, as determined by env or entrypoint, and SHALL document how to select each mode in the README
