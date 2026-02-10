# 16. Introduce incremental ESLint recommended-plus config and no-explicit-any

Date: 2026-02-11

## Status

Accepted

## Context

We want stricter, useful ESLint rules and minimal use of `any` in the TypeScript codebase. The current setup is `eslint.config.mjs` at repo root: ESLint recommended, typescript-eslint recommended, Prettier (no conflict), and file-specific overrides for scripts globals, `packages/common` type namespaces and barrel files. Linting runs via `pnpm lint` (Trunk and ESLint). Adding more rules will surface existing violations; we prefer an incremental "recommended-plus" approach with targeted fixes and overrides only where justified.

## Decision

1. **Add incremental "recommended-plus" rules** (no new plugins initially) in `eslint.config.mjs`:
   - `@typescript-eslint/consistent-type-imports` (prefer type-only imports where applicable).
   - `@typescript-eslint/no-floating-promises` (error).
   - `@typescript-eslint/no-misused-promises` (error).
   - `@typescript-eslint/no-explicit-any` (error) to minimize use of `any`.

2. **Keep existing overrides** for scripts globals, `packages/common` types and barrel files. Add new overrides only where necessary (e.g. generated code or third-party typings).

3. **Optional later**: Add `eslint-plugin-eslint-comments` with `eslint-comments/no-abusive-disable` in a future change.

## Consequences

- New violations will appear; they are fixed in this work or scoped (e.g. warn first, or path-specific overrides). Existing `any` usages in `packages/mcp/src/tools` (and elsewhere) are replaced with proper types from `packages/common` or the MCP SDK, or a documented exception with inline disable.
- Stricter rules improve correctness and consistency; `no-explicit-any` reduces type-unsafe escape hatches.

## References

- GitHub: Issue #36
