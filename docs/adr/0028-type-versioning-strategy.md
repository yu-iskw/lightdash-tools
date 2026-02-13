# 28. Type Versioning Strategy

Date: 2026-02-13

## Status

Accepted

## Context

As Lightdash tools evolve, we need a way to manage different versions of API types. Currently, all types are located in `packages/common/src/types/`, which makes it difficult to distinguish between legacy and current versions.

## Decision

We will reorganize the existing types into versioned directories:

- `packages/common/src/types/v1/` for current (v1) types.
- `packages/common/src/types/v2/` for future (v2) types.

This provides a clear path for introducing new API versions without breaking existing functionality or causing confusion.

## Consequences

- **Organization**: Types are clearly grouped by API version.
- **Refactoring**: Existing imports across the monorepo will need to be updated to point to the new locations.
- **Maintenance**: Future API changes can be isolated in a new version directory (e.g., `v3`).
- **Complexity**: Slightly more complex directory structure, but better for long-term scalability.
