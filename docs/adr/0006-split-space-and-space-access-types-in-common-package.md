# 6. Split space and space-access types in common package

Date: 2026-02-10

## Status

Accepted

## Context

The `spaces.ts` domain file currently mixes two concerns: (1) core space entity and CRUD payloads (SpaceSummary, Space, CreateSpace, UpdateSpace), and (2) space-level access/sharing (AddSpaceUserAccess, AddSpaceGroupAccess, SpaceMemberRole). The codebase already separates project-level access into `project-access.ts` (project access for users and groups) while core project types live in `projects.ts`. To align naming and maintainability, we want the same pattern for spaces: a dedicated file and namespace for space access types.

## Decision

We will split space-related types into two domain files and namespaces:

1. **Spaces (core)** – `packages/common/src/types/spaces.ts`: `SpaceSummary`, `Space`, `CreateSpace`, `UpdateSpace` only (entity and CRUD payloads).
2. **Space access** – new `packages/common/src/types/space-access.ts`: namespace `SpaceAccess` with `AddSpaceUserAccess`, `AddSpaceGroupAccess`, `SpaceMemberRole`.

In `packages/common/src/types/lightdash-api.ts` we will:

- Import and re-export the `SpaceAccess` namespace.
- Add `LightdashApi.SpaceAccess` with the three access types.
- Keep `LightdashApi.Spaces` with only the four core types.
- Preserve existing flat exports (`AddSpaceUserAccess`, `AddSpaceGroupAccess`, `SpaceMemberRole`) by sourcing them from `SpaceAccess` so that existing imports (e.g. from the client) remain valid with no breaking changes.

## Consequences

- **Consistency:** Space types are organized the same way as Projects vs ProjectAccess, making the codebase easier to navigate and extend.
- **No breaking changes:** Flat exports are preserved; consumers can continue to import from `@lightdash-tools/common` as before.
- **One new file:** `space-access.ts` is added; `spaces.ts` is reduced to core types only.
- **Traceability:** This refactor is tracked via GitHub issue and optional OpenSpec change.

## References

- GitHub Issue: #12
- Plan: Space and Space-Access Types (with ADR, Spec, GitHub)
