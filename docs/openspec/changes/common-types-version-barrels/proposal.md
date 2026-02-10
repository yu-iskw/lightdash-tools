# Proposal: Common package types/v1 and types/v2 barrel modules

## Why

File layout should reflect API version (v1/v2). Currently `LightdashApi.V1` and `LightdashApi.V2` exist but are defined inline in `lightdash-api.ts`; there are no `types/v1/` or `types/v2/` modules. Adding barrel modules under those paths makes the version boundary visible in the file tree and enables optional subpath imports.

## What Changes

- Add `packages/common/src/types/v1/index.ts` and `packages/common/src/types/v2/index.ts` that re-export the same type surface as `LightdashApi.V1` and `LightdashApi.V2`.
- Domain files (projects.ts, queries.ts, etc.) remain at the top level of `types/`; no moves.
- No change to how `LightdashApi.V1`/`V2` are built in `lightdash-api.ts` (they stay inline to avoid TypeScript export-import/circular issues).

**NON-BREAKING:** All existing imports unchanged.

## Capabilities

### New Capabilities

- `common-types-version-barrels`: The common package SHALL provide `types/v1/index.ts` and `types/v2/index.ts` that re-export the type surface for v1 and v2 respectively; SHALL NOT move existing domain files; SHALL retain existing `LightdashApi` and flat exports unchanged.

### Modified Capabilities

- (none)

## Impact

- **Code:** New files `packages/common/src/types/v1/index.ts`, `packages/common/src/types/v2/index.ts`. Optionally package.json exports for subpaths.
- **Consumers:** No change unless they opt into subpath imports later.
- **ADR:** ADR-0008 updated with file layout follow-up (issue #17).
