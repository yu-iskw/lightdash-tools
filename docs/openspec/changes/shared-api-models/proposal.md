# Proposal: Shared API Models in Common Package

## Why

Lightdash API types are currently generated in `packages/client` and accessed via deep paths like `components['schemas']['Project']`. This prevents other packages (`cli`, `mcp`) from using types without depending on the client package, creates verbose access patterns, and lacks domain organization. We need shared, well-organized type definitions that can be reused across packages.

## What Changes

- Extract core domain models from generated OpenAPI types to `packages/common/src/types/lightdash-api.ts`
- Organize models by domain namespace (Projects, Organizations, Queries, Charts, Dashboards, Spaces)
- Client package depends on `@lightdash-ai/common` for domain types
- Other packages can import types from `@lightdash-ai/common` independently
- Replace verbose `components['schemas']['Type']` access with cleaner `LightdashApi.Domain.Type` patterns

**BREAKING**: Client package imports will change from `components['schemas']` to imports from `@lightdash-ai/common`. This is an internal refactoring that doesn't affect the public API.

## Capabilities

### New Capabilities

- `shared-api-models`: Shared Lightdash API request/response models organized by domain in `@lightdash-ai/common`. Enables cross-package type reuse without requiring client dependency. Models are organized into domain namespaces (Projects, Organizations, Queries, etc.) for better discoverability.

### Modified Capabilities

- `lightdash-http-client`: The client package now uses shared models from `@lightdash-ai/common` instead of accessing types directly from generated OpenAPI types. This is an implementation detail change that improves code organization but doesn't change the client's public API.

## Impact

- **Code**: `packages/common/src/types/lightdash-api.ts` created with extracted models
- **Dependencies**: Client package adds `@lightdash-ai/common` dependency
- **Imports**: Client API classes updated to import from common instead of generated types
- **Reusability**: Other packages (`cli`, `mcp`) can now import types without client dependency
- **Type Safety**: Models remain aligned with OpenAPI spec (type aliases)
- **Developer Experience**: Cleaner import patterns and better type discoverability
