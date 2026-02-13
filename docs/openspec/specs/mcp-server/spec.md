# Spec: MCP Server

## Purpose

The Model Context Protocol (MCP) server for lightdash-tools, allowing AI agents to interact with Lightdash tools.

## Requirements

### Requirement: Hierarchical safety enforcement in MCP

The `registerToolSafe` function SHALL wrap tool handlers in a safety check that enforces the current hierarchical safety mode.

#### Scenario: Tool call in restricted mode

- **WHEN** a tool is called
- **AND** the tool's annotations are NOT compatible with the current safety mode
- **THEN** the handler SHALL return an MCP error message indicating the tool is disabled in the current mode
- **AND** the handler SHALL NOT execute the underlying tool logic

### Requirement: Safety mode in tool descriptions

The `registerToolSafe` function SHALL append safety mode information to tool descriptions if the tool is disabled in the current mode.

#### Scenario: Description update for disabled tool

- **WHEN** a tool is registered
- **AND** the tool would be disabled in the current safety mode
- **THEN** the tool description SHALL be prefixed or suffixed with a warning (e.g., "[DISABLED in current safety mode]")
