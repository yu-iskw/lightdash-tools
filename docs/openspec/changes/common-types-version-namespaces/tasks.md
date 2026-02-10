# Tasks: Common package type namespaces by API version

## 1. Version re-export modules

- [x] 1.1 Create `packages/common/src/types/v1/index.ts` that re-exports from domain modules: Projects, Organizations, Queries (v1: MetricQuery, RunQueryResults), Charts, Dashboards, Spaces, SpaceAccess, Users, Groups, AiAgents, ProjectAccess
- [x] 1.2 Create `packages/common/src/types/v2/index.ts` that re-exports from domain modules: Queries (v2: ExecuteAsync\* request/response types), and shared domains used by v2 (e.g. Projects, Spaces for chart/dashboard context)

**Note:** Implemented by defining V1 and V2 inline in `lightdash-api.ts` (TypeScript does not allow `export import` of type-only namespaces; v1/v2 index files were removed to avoid circular definition errors).

## 2. LightdashApi.V1 and LightdashApi.V2

- [x] 2.1 In `lightdash-api.ts`, add `LightdashApi.V1` and `LightdashApi.V2` namespaces (or export import from v1 and v2 index modules) so that `LightdashApi.V1` and `LightdashApi.V2` are available from the package
- [x] 2.2 Ensure existing `LightdashApi.Projects`, `LightdashApi.Queries`, and all flat exports remain unchanged

## 3. Verification

- [x] 3.1 Run `pnpm build` and `pnpm test` from repo root; ensure `pnpm validate:deps` passes
- [x] 3.2 Confirm existing client imports from `@lightdash-tools/common` (flat and namespace) still resolve
