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

1. **Bump the OpenAPI pin**

   Write a **40-char commit SHA** (preferred for releases) or a branch name into
   [`config/lightdash-openapi-ref.txt`](../../../config/lightdash-openapi-ref.txt).

   For a GitHub release, resolve the tag to its commit SHA, for example:

   ```bash
   gh api repos/lightdash/lightdash/releases/latest --jq .tag_name
   # then resolve the tag object to the commit SHA and write it to the pin file
   ```

   [`scripts/openapi-types-url.mjs`](../../../scripts/openapi-types-url.mjs) builds the
   swagger URL from that pin (SHA → commit URL; otherwise `refs/heads/<name>`).
   Do **not** assume tip-of-`main` unless the pin is explicitly `main`.

2. **Regenerate types**

   ```
   pnpm --filter @lightdash-tools/common generate:types
   ```

   This fetches swagger.json for the pinned ref and overwrites
   `packages/common/src/types/generated/openapi-types.ts`.

3. **Build the monorepo**

   ```
   pnpm build
   ```

   If the build fails, analyze the TypeScript errors. They likely indicate that
   the Lightdash API changed in a breaking way (renamed/removed types or paths).
   Fix usages in `packages/client/src/` or `packages/mcp/src/` as needed —
   do NOT revert the generated file.

4. **Run tests**

   ```
   pnpm test
   ```

   If tests fail, diagnose whether the failure is due to changed API shapes or
   a test that needs updating to match new behaviour.

5. **Report the diff**
   Show a summary of what changed in `openapi-types.ts` (new endpoints, removed
   endpoints, changed schemas). Do NOT commit — let the user review the diff first.

## Termination Criteria

- All steps pass with no errors → report the diff summary and stop.
- Build or tests keep failing after a reasonable fix attempt → stop and ask the user
  for guidance; do not loop indefinitely.

## Resources

- [pnpm Commands](../common-references/pnpm-commands.md): Common pnpm workspace commands.
- [Troubleshooting](../common-references/troubleshooting.md): Common TypeScript error patterns.
- Pin file: `config/lightdash-openapi-ref.txt`
- URL builder: `scripts/openapi-types-url.mjs`
- Generated file: `packages/common/src/types/generated/openapi-types.ts`
