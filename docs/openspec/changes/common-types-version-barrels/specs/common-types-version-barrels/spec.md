# Spec: Common package types/v1 and types/v2 barrel modules

## ADDED Requirements

### Requirement: types/v1 barrel module

The common package SHALL provide `packages/common/src/types/v1/index.ts` that re-exports the type surface for Lightdash API v1 (same as `LightdashApi.V1`), re-exporting from existing domain modules at the top level of `types/`.

#### Scenario: V1 barrel exists

- **WHEN** a consumer or the build resolves `packages/common/src/types/v1/index.ts`
- **THEN** that module SHALL export domain namespaces or types (Projects, Organizations, Queries, Charts, Dashboards, Spaces, SpaceAccess, ProjectAccess, Users, Groups, AiAgents) that match the types used by v1 API paths

#### Scenario: Domain files not moved

- **WHEN** the barrel is implemented
- **THEN** existing domain files (projects.ts, queries.ts, etc.) SHALL remain in `packages/common/src/types/` and SHALL NOT be moved under v1/ or v2/

### Requirement: types/v2 barrel module

The common package SHALL provide `packages/common/src/types/v2/index.ts` that re-exports the type surface for Lightdash API v2 (same as `LightdashApi.V2`), re-exporting from existing domain modules at the top level of `types/`.

#### Scenario: V2 barrel exists

- **WHEN** a consumer or the build resolves `packages/common/src/types/v2/index.ts`
- **THEN** that module SHALL export domain namespaces or types that match the types used by v2 API paths

### Requirement: LightdashApi and flat exports unchanged

The common package SHALL retain existing `LightdashApi` (including `LightdashApi.V1` and `LightdashApi.V2` as defined in lightdash-api.ts) and all flat exports; the barrel modules SHALL NOT replace or alter how `LightdashApi.V1`/`V2` are constructed.

#### Scenario: lightdash-api.ts unchanged for V1/V2 construction

- **WHEN** the barrels are added
- **THEN** `lightdash-api.ts` SHALL NOT import from `./v1` or `./v2` to build `LightdashApi.V1` or `LightdashApi.V2` (they remain inline) to avoid TypeScript circular/export-import issues
