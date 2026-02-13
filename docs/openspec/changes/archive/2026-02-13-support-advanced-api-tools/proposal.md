# Proposal: Advanced API Support

## Why

Lightdash users and automation tools (including AI agents using MCP) need comprehensive access to Lightdash's advanced features like validation, lineage, and member management. Currently, these are only accessible via the UI or raw API calls. Providing structured support across our tools ensures better reliability, discoverability, and developer experience.

## What Changes

We are adding support for 8 operational domains across the TypeScript Client, CLI, and MCP server:

- **Validation**: Trigger and list validation errors.
- **Metrics**: Discover and manage metrics.
- **Dimensions**: Discover and manage dimensions.
- **Schedulers**: Manage scheduled jobs.
- **Search**: Perform cross-asset searches.
- **Lineage**: Retrieve asset dependency graphs.
- **Members**: Manage org/project membership.
- **Tags**: Manage asset tags.

These will be implemented in a phased approach, starting with the Client, then CLI, then MCP.

## Capabilities

### New Capabilities

- `validation`: Support for project content validation.
- `metrics`: Support for listing and retrieving metrics.
- `dimensions`: Support for listing and retrieving dimensions.
- `schedulers`: Support for managing schedulers and deliveries.
- `search`: Support for searching across the Lightdash project.
- `lineage`: Support for retrieving upstream/downstream lineage.
- `members`: Support for managing organization and project members.
- `tags`: Support for managing asset tags.

### Modified Capabilities

<!-- No existing capabilities are being modified. -->

## Impact

- `@lightdash-tools/client`: New API classes/methods for each domain.
- `@lightdash-tools/cli`: New command groups for each domain.
- `@lightdash-tools/mcp`: New tools registered for each operation.
- Documentation: Updated to include these new tools and commands.
