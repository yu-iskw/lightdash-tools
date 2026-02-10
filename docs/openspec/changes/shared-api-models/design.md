# Design: Shared API Models in Common Package

## Context

Lightdash API types are currently generated in `packages/client/src/types/generated/openapi-types.ts` using `openapi-typescript`. Types are accessed via deep paths like `components['schemas']['Project']`, which is verbose and makes it difficult for other packages to use types without depending on the client package.

Current architecture:

- Types generated in client package
- Types accessed via `components['schemas']['Type']` throughout client code
- No shared type definitions
- Other packages cannot use types without client dependency

## Goals / Non-Goals

**Goals:**

- Extract domain models to shared package for cross-package reuse
- Organize models by domain for better discoverability
- Enable other packages to use types without client dependency
- Maintain type safety and alignment with OpenAPI spec
- Improve developer experience with cleaner import patterns

**Non-Goals:**

- Moving type generation to common package (can be considered later)
- Creating runtime validation schemas (out of scope)
- Changing the public API of the client package
- Redefining types (models are type aliases only)

## Decisions

### Decision 1: Extract Models to Common Package

**Choice:** Extract domain models to `packages/common/src/types/lightdash-api.ts`.

**Rationale:**

- True reusability: Other packages can use types without client dependency
- Clear separation: Common types live in shared package
- Monorepo best practices: Shared code belongs in common
- Scalability: Easy to add more shared utilities/types later

**Alternatives Considered:**

- Extract in client only: Still requires client dependency for other packages
- Hybrid approach: More complex, unclear boundaries

**Implementation:**

- Create `packages/common/src/types/lightdash-api.ts`
- Import from client's generated types (temporary dependency)
- Export models organized by domain

### Decision 2: Organize by Domain Namespaces

**Choice:** Organize models into domain namespaces (Projects, Organizations, Queries, etc.).

**Rationale:**

- Better discoverability: Developers can find types by domain
- Logical grouping: Related types are together
- Scalability: Easy to add new domains

**Alternatives Considered:**

- Flat export: Less organized, harder to discover
- Single namespace: Less granular organization

**Implementation:**

```typescript
export namespace LightdashApi {
  export namespace Projects {
    export type Project = components['schemas']['Project'];
  }
  export namespace Organizations {
    export type Organization = components['schemas']['Organization'];
  }
}
```

### Decision 3: Type Aliases (Not Redefinitions)

**Choice:** Models are type aliases to generated OpenAPI types, not redefinitions.

**Rationale:**

- Type safety: Models remain aligned with OpenAPI spec automatically
- Single source of truth: Generated types remain the source
- No maintenance burden: Changes to OpenAPI spec automatically reflected

**Alternatives Considered:**

- Redefine types: Would require manual maintenance and risk drift
- Generate separate types: Duplication and maintenance overhead

**Implementation:**

```typescript
import type { components } from '@lightdash-ai/client/types/generated/openapi-types';
export type Project = components['schemas']['Project'];
```

### Decision 4: Client Depends on Common

**Choice:** Client package depends on `@lightdash-ai/common` for domain types.

**Rationale:**

- Consistency: Client uses same types as other packages
- Single source: Types defined once in common
- No duplication: Client doesn't redefine types

**Alternatives Considered:**

- Client keeps direct access: Other packages still need client dependency
- Bidirectional dependency: Circular dependency risk

**Implementation:**

- Add `@lightdash-ai/common` to client's dependencies
- Update client imports to use common types

## Risks / Trade-offs

### Risk: Type Generation Dependency

**Issue:** Common package initially depends on client's generated types.

**Mitigation:**

- Document this as temporary
- Future option: Move type generation to common or generate types that common can import
- Type-only dependency (no runtime code) prevents circular dependency issues

### Risk: Breaking Changes in Client Imports

**Issue:** Client code needs to update imports.

**Mitigation:**

- Internal refactoring only (doesn't affect public API)
- Type aliases ensure compatibility
- Can be done incrementally

### Risk: Type Alignment

**Issue:** Models might drift from OpenAPI spec if not maintained correctly.

**Mitigation:**

- Models are type aliases, so alignment is automatic
- TypeScript will catch any mismatches
- Generated types remain single source of truth

### Trade-off: Initial Setup Complexity

**Impact:** Requires workspace dependency setup and import updates.

**Benefit:** Long-term maintainability and reusability improvements.

## Migration Plan

### Phase 1: Extract Models

1. Create `packages/common/src/types/lightdash-api.ts`
2. Extract commonly used types organized by domain
3. Export from `packages/common/src/index.ts`

### Phase 2: Update Client

1. Add `@lightdash-ai/common` dependency to client
2. Update client API classes to import from common
3. Replace `components['schemas']['Type']` with imported types

### Phase 3: Verification

1. Run tests to ensure type compatibility
2. Build all packages to verify dependencies
3. Update documentation

## Open Questions

- Should type generation move to common package in the future? **Answer:** Document as future consideration, not required for initial implementation.
- Should we provide both flat exports and namespace exports? **Answer:** Yes, provide both for flexibility.
