# 27. advanced-api-tools-client-cli-mcp

Date: 2026-02-13

## Status

Accepted

## Context

Lightdash provides various advanced APIs for metadata and operational tasks, including validation, metrics, dimensions, schedulers, search, lineage, members, and tags. Currently, these are not fully supported across our Lightdash tools (TypeScript Client, CLI, and MCP server). Providing unified support for these operations is essential for parity and to enable advanced automation and discovery through the MCP server.

## Decision

We will implement support for the following 8 operations across the TypeScript Client, CLI, and MCP server:

1.  **Validation**: APIs to trigger and retrieve project validation results.
2.  **Metrics**: APIs to list and manage metrics.
3.  **Dimensions**: APIs to list and manage dimensions.
4.  **Schedulers**: APIs to manage scheduled jobs and deliveries.
5.  **Search**: Unified search across project assets.
6.  **Lineage**: APIs to retrieve upstream and downstream dependencies.
7.  **Members**: Organization and project member management.
8.  **Tags**: Asset tagging and categorization.

The implementation will follow our established pattern:

- Add API methods to the `@lightdash-tools/client` package.
- Expose these operations via the `@lightdash-tools/cli` package.
- Register corresponding tools in the `@lightdash-tools/mcp` server.

## Consequences

- **Parity**: All three interfaces will have consistent access to advanced Lightdash features.
- **Discovery**: The MCP server will be able to provide LLMs with better context through search, lineage, and metadata discovery.
- **Maintenance**: Adding 8 new domains increases the API surface area that needs to be maintained as Lightdash evolves.
- **Complexity**: Some APIs (like lineage and search) might require complex response modeling in the client.
