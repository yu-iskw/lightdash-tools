---
name: generate-openapi-types
description: Generate or refresh TypeScript types from the Lightdash OpenAPI spec. Use this skill whenever the user asks to regenerate API types, update types from Lightdash, sync types with the swagger spec, or when types are out of date—even if they phrase it loosely (e.g. "refresh the API types", "pull latest types", "types need updating").
---

# Generate OpenAPI Types

## Purpose

Regenerate TypeScript types from the Lightdash OpenAPI spec so `packages/common` and its dependents stay in sync with the API. The generated file is the single source of truth for API shapes used across the repo.

## When to run

- The user asks to generate, update, or refresh API types.
- After upstream Lightdash spec changes (e.g. new or changed endpoints or schemas).
- As part of a task that requires up-to-date types (e.g. implementing a new client method).

## Workflow

1. **Run the type-generation script**
   - From repo root: `pnpm --filter @lightdash-tools/common generate:types`
   - Or from `packages/common`: `pnpm generate:types`

2. **Confirm output**
   - Output is written to: `packages/common/src/types/generated/openapi-types.ts`.

3. **Verify (optional but recommended)**
   - Run `pnpm build` (or at least build the common package) to ensure no type breakage.
   - If the build fails, surface the errors and consider using the build-and-fix skill or reporting to the user.

## Context

- `openapi-typescript` is already a devDependency in `packages/common/package.json`; no extra setup is needed in this repo.
- The spec URL used by the script is: `https://raw.githubusercontent.com/lightdash/lightdash/refs/heads/main/packages/backend/src/generated/swagger.json`.

## Success criteria

- `packages/common/src/types/generated/openapi-types.ts` has been updated.
- Build passes, or any failures are clearly reported.
