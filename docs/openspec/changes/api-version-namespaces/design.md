# Design: API Version Namespaces

## Context

The Lightdash HTTP client currently hardcodes `/api/v1` in the axios baseURL, preventing access to v2 endpoints. The OpenAPI specification includes both v1 and v2 paths, but the client only supports v1. We need to support both API versions while maintaining clear separation, type safety, and backward compatibility.

Current architecture:

- Single `HttpClient` with hardcoded `/api/v1` baseURL
- All API clients (`ProjectsClient`, `OrganizationsClient`, etc.) use the same HTTP client
- No support for v2 endpoints

## Goals / Non-Goals

**Goals:**

- Support both v1 and v2 API endpoints with clear namespace separation
- Maintain type safety for each version
- Preserve backward compatibility for existing code
- Enable future expansion to v3+ if needed
- Share configuration (auth, rate limiting, retry) across versions

**Non-Goals:**

- Migrating all existing code to v1 namespace (deprecated aliases remain)
- Supporting version selection per-request (version is determined by namespace)
- Automatic version detection or routing

## Decisions

### Decision 1: Separate HTTP Client Instances per Version

**Choice:** Create separate `HttpClient` instances for v1 and v2, each with its own axios instance and baseURL.

**Rationale:**

- Clear separation: Each version has its own HTTP client, reducing confusion
- Type safety: Version-specific types can be applied per namespace
- Future-proof: Easy to add v3+ later by creating additional instances
- Minimal refactoring: Existing HTTP client infrastructure can be reused

**Alternatives Considered:**

- Shared HTTP client with version-aware path resolution: More complex path prefixing logic
- Version parameter in method calls: Harder to type-check, runtime version selection
- Separate client classes: More duplication, harder to maintain

**Implementation:**

- `createAxiosInstanceV1(config)` creates axios instance with baseURL `/api/v1`
- `createAxiosInstanceV2(config)` creates axios instance with baseURL `/api/v2`
- Both instances share the same interceptors, timeout, and headers configuration

### Decision 2: Versioned Namespaces on LightdashClient

**Choice:** Expose `v1` and `v2` properties on `LightdashClient`, each containing version-specific API clients.

**Rationale:**

- Explicit version selection: `client.v1.*` vs `client.v2.*` makes version clear
- Type safety: TypeScript can enforce version-specific types per namespace
- Discoverability: Users can see available versions and endpoints

**Alternatives Considered:**

- Single namespace with version parameter: Less type-safe, more runtime complexity
- Separate client classes: More boilerplate, harder to share configuration

**Implementation:**

```typescript
class LightdashClient {
  readonly v1: V1ApiClients;
  readonly v2: V2ApiClients;
  // Deprecated aliases
  readonly projects: ProjectsClient; // delegates to v1.projects
}
```

### Decision 3: Backward Compatibility via Deprecated Aliases

**Choice:** Maintain deprecated top-level aliases (`client.projects`, etc.) that delegate to `client.v1.*`.

**Rationale:**

- No breaking changes: Existing code continues to work
- Gradual migration: Users can migrate at their own pace
- Clear deprecation path: Documentation guides users to new API

**Alternatives Considered:**

- Breaking change: Force immediate migration (rejected for user experience)
- No aliases: Cleaner API but breaks existing code (rejected)

**Implementation:**

- Top-level properties delegate to `v1.*` equivalents
- JSDoc comments mark them as `@deprecated`
- Migration guide in README

### Decision 4: API Client Structure

**Choice:** Keep existing API client class names (`ProjectsClient`, etc.) but organize them under version namespaces. Create new v2 clients (e.g., `QueryClientV2`) as needed.

**Rationale:**

- Minimal changes: Existing clients don't need renaming
- Namespace provides version context
- Clear naming: `QueryClientV2` indicates it's for v2

**Alternatives Considered:**

- Rename all clients to `V1ProjectsClient`: More verbose, unnecessary
- Single `QueryClient` with version detection: Less type-safe

**Implementation:**

- Existing clients remain in `packages/client/src/api/`
- V2 clients created in `packages/client/src/api/v2/`
- Both use `BaseApiClient` pattern

## Risks / Trade-offs

### Risk: Breaking Existing Code

**Mitigation:** Deprecated aliases maintain backward compatibility. Migration guide provided.

### Risk: Type Confusion Between Versions

**Mitigation:** Strict TypeScript types per namespace. Version-specific type extraction from OpenAPI spec.

### Risk: Duplicate HTTP Client Logic

**Mitigation:** Shared base implementation (`HttpClient` class). Separate instances only differ in baseURL. Shared rate limiting, retry, and error handling.

### Risk: Increased Complexity

**Mitigation:** Clear namespace separation makes version selection explicit. Well-documented API surface.

### Trade-off: Resource Usage

**Impact:** Two HTTP client instances instead of one (minimal overhead: separate axios instances share configuration).

## Migration Plan

### Phase 1: Infrastructure (No Breaking Changes)

1. Refactor HTTP client creation to support v1/v2 instances
2. Create versioned namespaces on `LightdashClient`
3. Migrate existing clients to use v1 HTTP client
4. Add deprecated aliases for backward compatibility

### Phase 2: V2 Support

1. Create initial v2 API clients (query endpoints)
2. Add v2 namespace with v2 clients
3. Test v2 endpoints

### Phase 3: Documentation & Migration

1. Update README with v1/v2 usage examples
2. Add migration guide for deprecated aliases
3. Add changelog entry

### Phase 4: Future Cleanup (Major Version)

1. Remove deprecated aliases
2. Update all examples to use versioned namespaces

## Open Questions

- Should we support version selection at the client level (e.g., `new LightdashClient({ defaultVersion: 'v2' })`)? **Answer:** No, explicit namespaces are clearer.
- How should we handle endpoints that exist in both versions with different signatures? **Answer:** Each version's namespace exposes its own typed methods.
