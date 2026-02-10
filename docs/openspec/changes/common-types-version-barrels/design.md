# Design: Common package types/v1 and types/v2 barrel modules

## Context

- `LightdashApi.V1` and `LightdashApi.V2` are defined inline in `lightdash-api.ts` because using `types/v1/index.ts` and `types/v2/index.ts` with `export import` of type-only namespaces caused TypeScript circular-definition errors.
- Domain files (projects.ts, queries.ts, etc.) live at the top level of `types/` and are imported by `lightdash-api.ts`.
- Goal: add v1 and v2 barrel files for layout clarity without changing how `LightdashApi` is built.

## Goals / Non-Goals

**Goals:**

- Add `types/v1/index.ts` and `types/v2/index.ts` that re-export the same surface as `LightdashApi.V1` and `LightdashApi.V2`.
- Keep domain files at top level; no moves.
- Avoid circular or type-only import issues (do not have lightdash-api.ts import from barrels).

**Non-Goals:**

- Moving domain files into v1/ or v2/.
- Changing `LightdashApi.V1`/`V2` to be built from the barrels (they stay inline).
- Adding package.json subpath exports (optional follow-up).

## Decisions

### Decision 1: Barrels re-export via explicit type aliases from domain files

Each barrel imports from `../projects`, `../queries`, etc., and re-exports using explicit type aliases or small namespace blocks (e.g. `export namespace Projects { export type Project = Projects.Project; export type OrganizationProject = Projects.OrganizationProject; }`). This avoids re-exporting a whole namespace from a type-only import that could participate in a cycle if lightdash-api.ts ever imported from the barrels.

### Decision 2: lightdash-api.ts does not import from barrels

`lightdash-api.ts` continues to define `LightdashApi.V1` and `LightdashApi.V2` inline and imports only from domain files and generated openapi-types. It must not import from `./v1` or `./v2` for building V1/V2.

### Decision 3: Optional package exports

Subpath exports (e.g. `@lightdash-ai/common/types/v1`) can be added later in package.json if desired; not required for this change.

## Risks / Trade-offs

- Barrels duplicate the list of types/namespaces that mirror LightdashApi.V1/V2; any new type added to the inline V1/V2 should be added to the barrels for consistency. Document in ADR-0008 or barrel file comments.
