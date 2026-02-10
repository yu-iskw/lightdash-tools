# Proposal: API Version Namespaces

## Why

The Lightdash HTTP client currently only supports v1 endpoints due to a hardcoded `/api/v1` baseURL. The Lightdash API provides both v1 and v2 endpoints (e.g., v2 query endpoints), but the client cannot access them. We need to support both API versions with clear namespace separation and type safety.

## What Changes

- Refactor HTTP client creation to support separate instances for v1 and v2
- Expose `client.v1.*` and `client.v2.*` namespaces on `LightdashClient`
- Migrate existing API clients to use v1 HTTP client instance
- Create initial v2 API clients (starting with query endpoints)
- Maintain backward compatibility via deprecated aliases (`client.projects` → `client.v1.projects`)

**BREAKING**: Future major version will remove deprecated aliases, requiring migration to `client.v1.*`.

## Capabilities

### New Capabilities

- `api-version-namespaces`: Support for multiple API versions (v1/v2) with separate HTTP client instances and clear namespace separation. Enables access to v2 endpoints while maintaining type safety and backward compatibility.

### Modified Capabilities

- `lightdash-http-client`: The HTTP client structure is modified to support versioned namespaces. Existing v1 endpoints continue to work through `client.v1.*` namespace. The client API surface is extended with version-specific namespaces.

## Impact

- **Code**: `packages/client/src/client.ts` refactored to expose v1/v2 namespaces
- **HTTP Layer**: `packages/client/src/http/axios-client.ts` updated to create versioned instances
- **API Clients**: All existing clients migrated to v1 namespace; new v2 clients created
- **Types**: Version-specific type safety maintained through namespace separation
- **Consumers**: Existing code continues to work via deprecated aliases; migration guide provided
- **Dependencies**: No new runtime dependencies; uses existing HTTP client infrastructure
