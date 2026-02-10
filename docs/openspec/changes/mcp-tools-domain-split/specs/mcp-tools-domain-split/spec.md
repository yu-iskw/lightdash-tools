# Spec: MCP tools organized by domain

## ADDED Requirements

### Requirement: Tools directory and shared helper

MCP tool registration SHALL be organized under `packages/mcp/src/tools/`. A shared helper SHALL provide error mapping and a common result type so domain modules do not duplicate try/catch logic.

#### Scenario: Shared module location

- **WHEN** the MCP package implements tool registration
- **THEN** there SHALL be a file `packages/mcp/src/tools/shared.ts` that exports a type for MCP text content and a function (e.g. `wrapTool`) that wraps tool handlers with try/catch and maps errors to safe MCP text via `toMcpErrorMessage`

#### Scenario: Barrel preserves public API

- **WHEN** the entrypoint imports tool registration
- **THEN** it SHALL import from `'./tools'` and SHALL receive a single `registerTools(server, client)` function that registers all tools; no change to the entrypoint call site

### Requirement: One module per domain

Each tool domain (projects, charts, dashboards, spaces, users, groups) SHALL have its own module under `packages/mcp/src/tools/`, each exporting a single `register*Tools(server, client)` function.

#### Scenario: Domain modules exist

- **WHEN** the tools directory is implemented
- **THEN** there SHALL be at least the following modules: projects.ts, charts.ts, dashboards.ts, spaces.ts, users.ts, groups.ts, and each SHALL export a function that registers that domain's tools on the given server using the given client

#### Scenario: Barrel aggregates domains

- **WHEN** `registerTools(server, client)` is called
- **THEN** it SHALL call each domain's register function so that all tools are registered in a defined order; tool names, descriptions, and behavior SHALL be unchanged from the pre-refactor single-file implementation
