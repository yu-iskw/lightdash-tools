---
name: lint-and-fix
description: Run linters and fix violations, formatting errors, or style mismatches using Trunk. Use when code quality checks fail, before submitting PRs, or to repair "broken" linting states.
---

# Lint and Fix Loop

## Purpose

Autonomous loop to identify, fix, and verify lint/format violations. Prefer **`pnpm verify:ci`** before pushing (full CI parity). See [../common-references/local-ci-parity.md](../common-references/local-ci-parity.md).

## Prerequisites

1. `pnpm install` (includes `@trunkio/launcher`)
2. `pnpm trunk:install` once per clone (fetches OSV-scanner, Trivy, pinned eslint, etc.)

## Loop Logic

1. **Identify** — run the broadest gate available:
   - **Full CI parity:** `pnpm verify:ci`
   - **No time for Trunk:** `pnpm verify:pr` (still runs build → test → lint:local)
   - **Lint only:** `pnpm lint` (Trunk via launcher + lint:local)
2. **Analyze** — file path, line, linter name. See [../common-references/troubleshooting.md](../common-references/troubleshooting.md).
3. **Fix:**
   - Formatting: `pnpm format` (`pnpm exec trunk fmt`)
   - `sort-package-json`: `pnpm format:package-json`
   - ESLint: `pnpm format:eslint` or minimal source fix
   - Security/OSV: upgrade dependency + `pnpm install`, re-run `pnpm verify:ci`
4. **Verify** — re-run the same identify command until green.

## Termination Criteria

- `pnpm verify:ci` exits 0 (preferred), or
- `pnpm verify:pr` exits 0 when Trunk cannot run (document OSV/Trivy not scanned), or
- Max iterations (default: 5).

## Command reference

| Symptom                       | Command                                               |
| ----------------------------- | ----------------------------------------------------- |
| package.json script order     | `pnpm lint:package-json` / `pnpm format:package-json` |
| Prettier                      | `pnpm lint:prettier` / `pnpm format:prettier`         |
| ESLint                        | `pnpm lint:eslint` (requires `pnpm build` first)      |
| Dead code / deps              | `pnpm knip`                                           |
| OSV / Trivy / YAML / markdown | `pnpm lint:trunk` or `pnpm verify:ci`                 |

## Examples

### package.json formatting (Trunk sort-package-json)

1. `pnpm verify:ci` reports `package.json` fmt from sort-package-json.
2. Run `pnpm format:package-json`.
3. `pnpm verify:ci` passes.

### import-x/no-unresolved for @lightdash-tools/\*

1. `pnpm lint:eslint` passes locally but Trunk fails on PR.
2. Cause: ESLint ran before `pnpm build` (workspace `dist/` missing).
3. Run `pnpm build && pnpm lint:eslint` or use `pnpm verify:pr`.

## Resources

- [Local CI parity](../common-references/local-ci-parity.md)
- [Trunk CLI Reference](../common-references/trunk-commands.md)
- [Trunk Documentation](https://docs.trunk.io/)
