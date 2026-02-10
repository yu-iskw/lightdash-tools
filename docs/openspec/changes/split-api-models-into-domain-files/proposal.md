# Proposal: Split API Models into Domain Files

## Why

The `lightdash-api.ts` file is currently 179 lines and will grow larger as more models are added. This makes it harder to maintain, navigate, and understand. The file also has duplication (namespaces defined twice - standalone and in `LightdashApi`). We need to split models into domain-specific files for better maintainability while preserving backward compatibility.

## What Changes

- Split `packages/common/src/types/lightdash-api.ts` into domain-specific files (`projects.ts`, `organizations.ts`, `queries.ts`, `charts.ts`, `dashboards.ts`, `spaces.ts`)
- Each domain file exports its namespace
- Main `lightdash-api.ts` imports domains and assembles `LightdashApi` namespace
- Main file provides flat exports for backward compatibility
- Remove duplicate namespace definitions

**No breaking changes**: All existing imports continue to work. This is an internal refactoring.

## Capabilities

### New Capabilities

- `domain-file-organization`: Models organized into separate domain files for better maintainability. Each domain file is self-contained and exports its namespace. Main file assembles namespace and provides flat exports.

### Modified Capabilities

- `shared-api-models`: The file structure is modified to split models into domain files. The public API remains unchanged - all imports continue to work. This is an implementation detail change that improves code organization.

## Impact

- **Code**: Domain files created in `packages/common/src/types/`
- **Main File**: `lightdash-api.ts` refactored to import and assemble domains
- **Imports**: No changes required - all existing imports continue to work
- **Maintainability**: Improved through better file organization
- **Scalability**: Easier to add new domains without bloating a single file
