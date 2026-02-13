# Design: Advanced API Support

## Context

Lightdash exposes a rich set of operational APIs that are currently underutilized in our toolset. This design focuses on integrating these APIs into our TypeScript client, CLI, and MCP server to provide a first-class experience for metadata discovery and operational automation.

## Goals / Non-Goals

**Goals:**

- Implement 8 new API domains in `@lightdash-tools/client`.
- Expose these domains as commands in `@lightdash-tools/cli`.
- Register the primary operations as tools in `@lightdash-tools/mcp`.
- Maintain consistency with existing patterns in the monorepo.

**Non-Goals:**

- Implementing UI changes in Lightdash itself.
- Changing the underlying Lightdash API structure.
- Implementing write support for all domains (phased approach, focus on read/operational triggers first).

## Decisions

### 1. Phased implementation by domain

Each domain (e.g., `validation`, `lineage`) will be implemented as a separate module in the client and a sub-command group in the CLI.

### 2. Client-first development

The client package will be the source of truth for types and API calls. CLI and MCP will consume the client.

### 3. Error handling

Standard error handling patterns from the `client` package will be applied. Validation errors will be returned as structured objects for better CLI formatting.

## Risks / Trade-offs

- **Risk**: API Rate limiting on complex operations like Search or Lineage.
  - **Mitigation**: Implement sensible defaults and allow user-defined timeouts.
- **Risk**: Large response sizes for project-wide listings (e.g., all metrics).
  - **Mitigation**: Use pagination where supported by the Lightdash API.
