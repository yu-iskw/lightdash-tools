# 41. TypeScript 7 dual-install with TypeScript 6 API for tooling

Date: 2026-07-09

## Status

Accepted

## Context

TypeScript 7.0 is the Go-native compiler. It is substantially faster than TypeScript 6, but **does not ship a stable programmatic API** until TypeScript 7.1. Under the dual-install below, native `tsc` comes from the `@typescript/native` alias (`typescript@7`); the `typescript` package name is reserved for the TypeScript 6 API.

This monorepo:

- Builds every package with `"build": "tsc"` (CommonJS emit).
- Runs type-aware ESLint via `@typescript-eslint/*`, which imports the `typescript` package and peers `typescript: '>=4.8.4 <6.1.0'`.

Installing only `typescript@7` would break typescript-eslint (and any other consumer of `import "typescript"`). Microsoft’s recommended migration is a **side-by-side** install using npm aliases and the `@typescript/typescript6` compatibility package.

Package tsconfigs still use `"module": "commonjs"`. Migrating to `nodenext`/ESM would require `package.json` `exports`/`type` changes across the workspace and is a separate decision.

## Decision

1. **Dual-install at the workspace root:**
   - `"@typescript/native": "npm:typescript@^7.0.2"` — provides native `tsc` (TypeScript 7) for package builds.
   - `"typescript": "npm:@typescript/typescript6@^6.0.2"` — provides the TypeScript 6 JS API and `tsc6` for typescript-eslint and other API consumers.

2. **Keep CommonJS emit** (`"module": "commonjs"`) for all packages. Set `"moduleResolution": "bundler"` so builds do not rely on removed `node`/`node10` resolution defaults.

3. **Do not use `ignoreDeprecations`** in tsconfigs; TypeScript 7 hard-errors that flag.

4. **Revisit after TypeScript 7.1** when a stable programmatic API exists: collapse to a single `typescript@7` dependency if typescript-eslint (and peers) support it.

## Consequences

### Positive

- Package builds use TypeScript 7’s native `tsc`.
- typescript-eslint and other API tools keep working on the TypeScript 6 API.
- Clear upgrade path once 7.1 lands.

### Negative

- Two TypeScript-related packages must stay in sync in root `devDependencies`.
- Agents must know that `require('typescript')` is 6.x while `tsc` is 7.x.
- CJS emit remains; ESM/`nodenext` is deferred.
- pnpm may also hoist a nested TypeScript 6 `tsc` under `.pnpm`; package `"build": "tsc"` relies on root `node_modules/.bin/tsc` winning (currently `@typescript/native`). Re-check `pnpm exec tsc --version` after lockfile changes.

## References

- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- Root [`package.json`](../../package.json) dual-install aliases
- Package `tsconfig.json` files under `packages/*`
