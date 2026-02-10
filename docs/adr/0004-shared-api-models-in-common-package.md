# 4. Shared API Models in Common Package

Date: 2026-02-10

## Status

Accepted

## Context

Lightdash API types are currently generated in `packages/client/src/types/generated/openapi-types.ts` and accessed via deep paths like `components['schemas']['Project']`. This creates several issues:

1. **Reusability**: Other packages (`cli`, `mcp`) cannot use types without depending on the client package
2. **Verbosity**: Deep access patterns (`components['schemas']['Type']`) are verbose and hard to discover
3. **Organization**: Types are not organized by domain, making it difficult to find relevant types
4. **Coupling**: Packages that only need types are forced to depend on the full client package

A problem-solving analysis evaluated 5 approaches:

1. Extract Models in Client Only (84/100)
2. Shared Models in Common (90/100) - **selected**
3. Hybrid - Core Models in Common, Client-Specific in Client (87/100)
4. Type Aliases with Namespace Organization (84/100)
5. Generated Model Extractor Script (82/100)

## Decision

We will implement **Approach 2: Shared Models in `@lightdash-ai/common`**.

### Implementation Details

- Extract core domain models to `packages/common/src/types/lightdash-api.ts`
- Organize models by domain namespace (Projects, Organizations, Queries, Charts, Dashboards, Spaces)
- Client package depends on `@lightdash-ai/common` for domain types
- Other packages can import types from `@lightdash-ai/common` without client dependency
- Models are type aliases to generated OpenAPI types, ensuring alignment with the spec

### Architecture

```
@lightdash-ai/common
└── types/
    └── lightdash-api.ts
        ├── Projects namespace (Project, OrganizationProject)
        ├── Organizations namespace (Organization)
        ├── Queries namespace
        │   ├── Requests (MetricQuery, SqlQuery, etc.)
        │   └── Responses (QueryResults, etc.)
        ├── Charts namespace
        ├── Dashboards namespace
        └── Spaces namespace
```

## Consequences

### Positive

- **Reusability**: Other packages can use types without client dependency
- **Organization**: Models organized by domain for better discoverability
- **Type Safety**: Models remain aligned with OpenAPI spec (type aliases)
- **Separation of Concerns**: Common types separated from client implementation
- **Monorepo Best Practices**: Shared code lives in common package

### Negative

- **Initial Dependency**: Common temporarily depends on client's generated types (can be moved later)
- **Migration Effort**: Existing code needs to update imports

### Migration Strategy

1. Extract models to common package
2. Update client to import from common
3. Replace `components['schemas']['Type']` with `LightdashApi.Domain.Type`
4. Other packages can start using common types immediately

## Future Considerations

### Type Generation Location

Currently, type generation remains in the client package, and common imports from client's generated types. This creates a dependency where common depends on client (type-only, no runtime code).

**Future Options:**

1. Move type generation to common package - Common becomes the source of truth for types
2. Generate types in a shared location - Both packages import from a shared generated types location
3. Keep current structure - Document that this is acceptable for type-only dependencies

**Recommendation:** Keep current structure for now. The type-only dependency doesn't create runtime issues, and moving generation adds complexity. Revisit if circular dependency issues arise or if type generation needs to be shared more broadly.

### Additional Model Organization

As more models are needed, consider:

- Adding validation schemas (Zod, etc.) if runtime validation is needed
- Creating request/response builders or helpers
- Adding model versioning if API versions diverge significantly

### File Organization (2026-02-10)

As the `lightdash-api.ts` file grows, models are split into domain-specific files for better maintainability.

**Decision:** Split models into separate domain files (`projects.ts`, `organizations.ts`, `queries.ts`, etc.) while maintaining backward compatibility through the main `lightdash-api.ts` file.

**Rationale:**

- Better maintainability: Each domain file is self-contained and easier to navigate
- Scalability: Easy to add new domains without bloating a single file
- Clear boundaries: Domain files have clear ownership and responsibility
- Backward compatibility: Main file assembles namespace and provides flat exports

**File Structure:**

```
packages/common/src/types/
├── lightdash-api.ts (main file - imports domains, assembles namespace, flat exports)
├── projects.ts (Projects namespace)
├── organizations.ts (Organizations namespace)
├── queries.ts (Queries namespace)
├── charts.ts (Charts namespace)
├── dashboards.ts (Dashboards namespace)
└── spaces.ts (Spaces namespace)
```

**Implementation:** Each domain file exports its namespace. The main file imports all domains, assembles the `LightdashApi` namespace, and provides flat exports for backward compatibility. All existing imports continue to work without changes.

## References

- Problem-solving analysis: See agent transcript
- GitHub Issue: #4
- OpenSpec: `docs/openspec/changes/shared-api-models/`
