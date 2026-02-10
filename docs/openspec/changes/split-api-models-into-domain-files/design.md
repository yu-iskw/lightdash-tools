# Design: Split API Models into Domain Files

## Context

The `lightdash-api.ts` file currently contains all domain models in a single file (179 lines). As more models are added, this file will become unwieldy and harder to maintain. The file also has duplication (namespaces defined twice - standalone and in `LightdashApi`).

Current structure:

- Single file with all domains
- Duplicate namespace definitions
- All models in one place

## Goals / Non-Goals

**Goals:**

- Split models into domain-specific files for better maintainability
- Remove duplication (namespaces defined once per domain)
- Maintain backward compatibility (all existing imports continue to work)
- Improve code organization and discoverability
- Enable easier addition of new domains

**Non-Goals:**

- Changing the public API (all imports remain the same)
- Changing type definitions (types remain identical)
- Requiring consumers to update imports

## Decisions

### Decision 1: Split by Domain

**Choice:** Split models into domain-specific files (`projects.ts`, `organizations.ts`, etc.).

**Rationale:**

- Clear boundaries: Each domain has its own file
- Self-contained: Domain files don't depend on each other
- Scalable: Easy to add new domains
- Maintainable: Easier to find and modify domain-specific types

**Alternatives Considered:**

- Split by request/response: Less intuitive, some types are both
- Split by API version: Many types are version-agnostic
- Keep single file: Doesn't solve maintainability issue

**Implementation:**

- Create one file per domain
- Each file exports its namespace
- Files import only from generated types

### Decision 2: Main File Assembles Namespace

**Choice:** Main `lightdash-api.ts` imports domains and assembles `LightdashApi` namespace.

**Rationale:**

- Backward compatibility: Maintains existing namespace structure
- Single entry point: Consumers don't need to know about domain files
- Flexibility: Can reorganize domain files without breaking consumers

**Alternatives Considered:**

- No main file: Would require consumers to import from domain files directly
- Barrel file pattern: Similar approach, but main file is clearer

**Implementation:**

- Main file imports all domain namespaces
- Assembles `LightdashApi` namespace using `export import`
- Provides flat exports for convenience

### Decision 3: Maintain Flat Exports

**Choice:** Continue providing flat exports (`export type Project = Projects.Project`) for backward compatibility.

**Rationale:**

- Backward compatibility: Existing flat imports continue to work
- Convenience: Simpler imports for common use cases
- No breaking changes: Consumers don't need to update code

**Alternatives Considered:**

- Remove flat exports: Would break existing imports
- Only namespace exports: Less convenient for simple use cases

**Implementation:**

- Flat exports reference domain namespaces
- All existing imports continue to work

## Risks / Trade-offs

### Risk: Breaking Existing Imports

**Mitigation:** Main file re-exports everything, maintaining backward compatibility. All existing import patterns continue to work.

### Risk: Type Incompatibility

**Mitigation:** Types are identical (same type aliases), just organized differently. TypeScript will treat them as the same types.

### Risk: Circular Dependencies

**Mitigation:** Domain files don't import from each other, only from generated types. Main file imports domains (one-way dependency).

### Trade-off: More Files

**Impact:** More files to manage, but better organization.

**Benefit:** Easier to maintain, navigate, and understand as codebase grows.

## Migration Plan

### Phase 1: Create Domain Files

1. Create domain-specific files with namespace exports
2. Extract types from main file to domain files

### Phase 2: Refactor Main File

1. Update main file to import domains
2. Assemble `LightdashApi` namespace
3. Provide flat exports

### Phase 3: Verification

1. Build all packages
2. Run tests
3. Verify imports work

## Open Questions

- Should domain files be importable directly? **Answer:** Yes, but main file is recommended for consistency.
- Should we add an index file for domain files? **Answer:** Not needed - main file serves this purpose.
