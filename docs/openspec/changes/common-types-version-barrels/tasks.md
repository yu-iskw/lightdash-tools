# Tasks: Common types version barrels

## 1. V1 barrel

- [x] 1.1 Create `packages/common/src/types/v1/index.ts` re-exporting from domain modules (Projects, Organizations, Queries, Charts, Dashboards, Spaces, SpaceAccess, ProjectAccess, Users, Groups, AiAgents) using explicit type aliases or namespace blocks so the exported surface matches LightdashApi.V1

## 2. V2 barrel

- [x] 2.1 Create `packages/common/src/types/v2/index.ts` re-exporting from domain modules with the same structure as LightdashApi.V2, using explicit type aliases or namespace blocks

## 3. Verification

- [x] 3.1 Run `pnpm build` and `pnpm test` from repo root; run `pnpm validate:deps`; confirm no circular or type errors and existing imports still resolve
