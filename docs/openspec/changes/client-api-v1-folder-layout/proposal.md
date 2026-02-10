# Proposal: Client package API folder layout by version

## Why

ADR-0003 introduced runtime version namespaces (`client.v1.*`, `client.v2.*`), but the source code in `packages/client/src/api/` did not mirror this: v1 modules lived at the top level of `api/` while only v2 had a dedicated folder. We need a folder layout that clearly distinguishes API versions and aligns with the runtime namespaces.

## What Changes

- Create `api/v1/` and move all v1 API client modules (and their tests) into it
- Keep `api/base-client.ts` at `api/` (shared by v1 and v2)
- Update imports in `client.ts` and `index.ts` to `./api/v1/<module>` for v1 clients
- Leave `api/v2/` as-is

**NON-BREAKING**: Public API (exports, `LightdashClient` surface) is unchanged.

## Capabilities

### New Capabilities

- `client-api-folder-layout`: The client package SHALL organize API client source by version: v1 modules under `api/v1/`, v2 under `api/v2/`, shared base in `api/`.

## Impact

- **Code**: Many files move from `api/*.ts` to `api/v1/*.ts`; import paths in `client.ts` and `index.ts` updated
- **Consumers**: No change to package exports or `LightdashClient` API
