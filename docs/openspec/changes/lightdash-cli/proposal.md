# Proposal: Lightdash CLI

## Why

Users need a command-line interface to interact with the Lightdash API without writing code. The CLI should provide convenient access to common operations like getting organization details, listing projects, managing groups and users. Currently, users must write custom scripts using the HTTP client package, which creates friction for common tasks.

## What Changes

- Create a CLI package (`packages/cli`) using Commander.js
- Support nested subcommands: `organization get`, `projects get/list`, `groups list`, `users list`
- Use `@lightdash-ai/client` for API calls
- Configure authentication via environment variables (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`)
- Provide JSON and formatted text output options
- Add comprehensive help documentation

**NEW**: CLI package provides command-line access to Lightdash API operations.

## Capabilities

### New Capabilities

- `lightdash-cli`: Command-line interface for Lightdash AI. Supports nested subcommands for organization, projects, groups, and users management. Uses `@lightdash-ai/client` for API calls and supports environment variable configuration.

### Modified Capabilities

- None (new package)

## Impact

- **Code**: New `packages/cli` package with command structure
- **Dependencies**: CLI package depends on `@lightdash-ai/client` and `@lightdash-ai/common`
- **User Experience**: Users can interact with Lightdash API via CLI without writing code
- **Developer Experience**: Easy to extend with new commands following established patterns
