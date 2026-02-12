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

We will implement **Approach 2: Shared Models in `@lightdash-tools/common`**.

### Implementation Details

- Extract core domain models to `packages/common/src/types/lightdash-api.ts`.
- Organize models by domain namespace (Projects, Organizations, Queries, Charts, Dashboards, Spaces).
- Client package depends on `@lightdash-tools/common` for domain types.
- Other packages can import types from `@lightdash-tools/common` without client dependency.
- Models are type aliases to generated OpenAPI types, ensuring alignment with the spec.
- **Type Generation**: Moved to the common package (`packages/common/src/types/generated/openapi-types.ts`). This eliminates the circular dependency where common depended on client.
- **File Organization**: Models are split into domain-specific files (`projects.ts`, `organizations.ts`, etc.) under `packages/common/src/types/` for maintainability, assembled in `lightdash-api.ts`.
- **Enforcement**: CI check `scripts/check-common-no-client.mjs` (invoked via `validate:deps`) ensures `@lightdash-tools/common` never depends on `@lightdash-tools/client`.

### Architecture

```
@lightdash-tools/common
└── types/
    ├── generated/
    │   └── openapi-types.ts      # Generated from OpenAPI spec
    ├── lightdash-api.ts          # Main entry, assembles namespaces
    ├── projects.ts               # Projects domain
    ├── organizations.ts          # Organizations domain
    ├── queries.ts                # Queries domain
    ├── charts.ts                 # Charts domain
    ├── dashboards.ts             # Dashboards domain
    └── spaces.ts                 # Spaces domain
```

## Consequences

### Positive

- **Reusability**: Other packages can use types without client dependency.
- **Organization**: Models organized by domain for better discoverability.
- **Type Safety**: Models remain aligned with OpenAPI spec (type aliases).
- **Separation of Concerns**: Common types separated from client implementation.
- **Monorepo Best Practices**: Shared code lives in common package.
- **Clean Build**: Circular dependency fixed by moving codegen to common.

### Negative

- **Initial Migration**: One-time effort to move types and update imports.

## Future Considerations

### Additional Model Organization

As more models are needed, consider:

- Adding validation schemas (Zod, etc.) if runtime validation is needed.
- Creating request/response builders or helpers.
- Adding model versioning if API versions diverge significantly.

## References

- Problem-solving analysis: See agent transcript
- GitHub Issue: #4
- GitHub Issue (enforcement): #9
- OpenSpec: `docs/openspec/changes/shared-api-models/`
