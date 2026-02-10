# Proposal: Common package type namespaces by API version

## Why

Types in `@lightdash-ai/common` are organized by domain but not by API version. The OpenAPI spec and runtime client expose both v1 and v2 endpoints, yet consumers cannot tell from the type system which types belong to which API version. This increases the risk of using a v2 request type on a v1 endpoint or vice versa, and complicates discovery and refactoring. We need type-level distinction so that models are clearly associated with v1 or v2.

## What Changes

- Add `LightdashApi.V1` and `LightdashApi.V2` as top-level namespaces in the common package. Each re-exports only the domain types that belong to that API version (curated mapping).
- Optionally implement the split using existing empty `types/v1/` and `types/v2/` folders (e.g. `v1/index.ts`, `v2/index.ts` re-exporting from domain files).
- Preserve **backward compatibility**: keep existing `LightdashApi.Projects`, `LightdashApi.Queries`, and all flat exports so client and other consumers can migrate incrementally.

**NON-BREAKING**: All existing imports from `@lightdash-ai/common` continue to work.

## Capabilities

### New Capabilities

- `common-types-version-namespaces`: The common package SHALL expose `LightdashApi.V1` and `LightdashApi.V2` namespaces, each re-exporting only the domain types that belong to that API version, and SHALL retain existing unversioned namespace and flat exports for backward compatibility.

### Modified Capabilities

- (none)

## Impact

- **Code**: `packages/common/src/types/lightdash-api.ts` (and optionally `types/v1/index.ts`, `types/v2/index.ts`). No changes to generated OpenAPI types or domain file definitions.
- **Consumers**: New optional imports (`LightdashApi.V1.*`, `LightdashApi.V2.*`). Existing imports unchanged.
- **Documentation**: ADR-0008; type mapping (v1-only, v2-only, shared) documented in ADR or code.
