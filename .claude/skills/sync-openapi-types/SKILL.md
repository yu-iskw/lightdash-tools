---
name: sync-openapi-types
description: >
  Regenerate the Lightdash OpenAPI TypeScript types from the upstream swagger.json,
  then build and run tests to verify nothing regressed. Use when Lightdash releases
  new API versions, when type errors reference missing or changed endpoints, or when
  the generated file at packages/common/src/types/generated/openapi-types.ts is stale.
---

# Sync OpenAPI Types

## Purpose

Regenerate `packages/common/src/types/generated/openapi-types.ts` from the upstream
Lightdash swagger.json, then verify the entire monorepo still compiles and tests pass.

> **Important**: `openapi-types.ts` is auto-generated. Never edit it by hand —
> changes will be overwritten the next time this skill runs.

## Workflow

1. **Regenerate types**

   ```
   pnpm --filter @lightdash-tools/common generate:types
   ```

   This fetches the latest swagger.json from the Lightdash main branch and
   overwrites `packages/common/src/types/generated/openapi-types.ts`.

2. **Build the monorepo**

   ```
   pnpm build
   ```

   If the build fails, analyze the TypeScript errors. They likely indicate that
   the Lightdash API changed in a breaking way (renamed/removed types or paths).
   Fix usages in `packages/client/src/` or `packages/mcp/src/` as needed —
   do NOT revert the generated file.

3. **Run tests**

   ```
   pnpm test
   ```

   If tests fail, diagnose whether the failure is due to changed API shapes or
   a test that needs updating to match new behaviour.

4. **Report the diff**
   Show a summary of what changed in `openapi-types.ts` (new endpoints, removed
   endpoints, changed schemas). Do NOT commit — let the user review the diff first.

## Termination Criteria

- All steps pass with no errors → report the diff summary and stop.
- Build or tests keep failing after a reasonable fix attempt → stop and ask the user
  for guidance; do not loop indefinitely.

## Resources

- [pnpm Commands](../common-references/pnpm-commands.md): Common pnpm workspace commands.
- [Troubleshooting](../common-references/troubleshooting.md): Common TypeScript error patterns.
- Upstream swagger source: `https://raw.githubusercontent.com/lightdash/lightdash/refs/heads/main/packages/backend/src/generated/swagger.json`
- Generated file: `packages/common/src/types/generated/openapi-types.ts`
