# 3. API Version Namespaces

Date: 2026-02-10

## Status

Accepted

## Context

The Lightdash HTTP client currently hardcodes `/api/v1` in the baseURL, preventing access to v2 endpoints. The OpenAPI specification includes both v1 and v2 paths (e.g., `/api/v1/projects/*` and `/api/v2/projects/{projectUuid}/query/*`), but the client only supports v1.

We need to support both API versions while maintaining clear separation and type safety. A problem-solving analysis evaluated 5 approaches:

1. Separate HttpClient Instances per Version (selected)
2. Versioned Namespaces with Shared HttpClient
3. Version Parameter in Method Calls
4. Separate Client Classes
5. Lazy Version-Aware Base Path

## Decision

We will implement **Approach 1: Separate HttpClient Instances per Version**.

### Implementation Details

- Create separate HTTP client instances for v1 and v2, each with its own axios instance and baseURL (`/api/v1` and `/api/v2`)
- Expose `client.v1.*` and `client.v2.*` namespaces on `LightdashClient`
- Each namespace contains version-specific API clients (e.g., `client.v1.projects`, `client.v2.query`)
- Maintain backward compatibility by exposing deprecated aliases (`client.projects` → `client.v1.projects`)

### Architecture

```
LightdashClient
├── v1: V1ApiClients
│   ├── projects: ProjectsClient (uses HttpClientV1)
│   ├── organizations: OrganizationsClient (uses HttpClientV1)
│   ├── charts: ChartsClient (uses HttpClientV1)
│   ├── dashboards: DashboardsClient (uses HttpClientV1)
│   ├── spaces: SpacesClient (uses HttpClientV1)
│   └── query: QueryClient (uses HttpClientV1)
└── v2: V2ApiClients
    └── query: QueryClientV2 (uses HttpClientV2)
```

## Consequences

### Positive

- **Clear separation**: Each version has its own HTTP client and namespace, reducing confusion
- **Type safety**: Version-specific types can be applied per namespace
- **Future-proof**: Easy to add v3+ later by creating additional namespaces
- **Backward compatible**: Existing code continues to work via deprecated aliases

### Negative

- **Breaking change path**: Future removal of deprecated aliases will require migration
- **Some duplication**: Shared logic (auth, rate limiting) is duplicated across instances (mitigated by shared base implementation)

### Migration Strategy

1. Old API (`client.projects.getProject()`) continues to work (deprecated)
2. Users migrate to `client.v1.projects.getProject()` for explicit version
3. Users use `client.v2.*` for v2-specific endpoints
4. Deprecated aliases will be removed in a future major version

## References

- Problem-solving analysis: See agent transcript
- GitHub Issue: #3
- OpenSpec: `docs/openspec/changes/api-version-namespaces/`
