# Local CI Parity

Use this reference so local verification catches the same failures as GitHub Actions **before** pushing.

## CI workflows vs local commands

| GitHub Actions workflow             | What it runs                                                   | Local equivalent                                                 |
| ----------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Unit Tests** (`test.yml`)         | `pnpm build`, `pnpm test` (coverage + thresholds), `pnpm knip` | Included in `pnpm verify:pr`                                     |
| **Build** (`build.yml`)             | `pnpm build`                                                   | Included in `pnpm verify:pr`                                     |
| **Trunk Check** (`trunk_check.yml`) | `pnpm build`, `trunk check`                                    | `pnpm verify:ci` (uses `@trunkio/launcher` from devDependencies) |

## Verification ladder

Run from the repository root, in order of increasing coverage:

| Command             | When to use                  | Includes                                                   |
| ------------------- | ---------------------------- | ---------------------------------------------------------- |
| `pnpm verify:quick` | Tight loop while editing     | `build` → `test` → `lint:local`                            |
| `pnpm verify:pr`    | **Default before commit/PR** | validations → `build` → `test` → `lint:local`              |
| `pnpm verify:ci`    | Match CI exactly             | `verify:pr` + `lint:trunk` (OSV, Trivy, markdown, YAML, …) |

`pnpm verify` is an alias for `pnpm verify:pr`.

## What `lint:local` covers (no Trunk required)

- `lint:package-json` — `sort-package-json --check` (Trunk `sort-package-json` linter)
- `lint:prettier` — Prettier formatting
- `lint:eslint` — ESLint (import-x, SonarJS, security, …)
- `knip` — unused exports, dependencies, entrypoints

## What only Trunk covers

After `pnpm install`, run `pnpm trunk:install` once to fetch Trunk-managed linters (OSV-scanner, prettier, eslint pin, etc.). The CLI comes from `@trunkio/launcher` in devDependencies — no global install required.

Trunk additionally runs:

- **OSV-scanner** — dependency CVEs (e.g. vitest/vite advisories)
- **Trivy** — additional security scans
- **markdownlint**, **yamllint**, **actionlint**, **shellcheck**, **git-diff-check**

Without `@trunkio/launcher` (or before `pnpm trunk:install`), `pnpm lint` prints a warning and runs `lint:local` only. **Security findings will not appear until `pnpm verify:ci`.**

## Monorepo: build before ESLint

Workspace packages (`@lightdash-tools/common`, etc.) expose `main`/`types` under `dist/`. ESLint `import-x/no-unresolved` fails when `dist/` is missing.

**Always run `pnpm build` before `pnpm lint:eslint` or `pnpm lint:local`.** `verify:pr` and `verify:quick` run build first.

## Common false negatives (what went wrong on PR #131)

| Symptom                                       | Cause                                                 | Fix                                                    |
| --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `verify:quick` green, Trunk red               | `verify:quick` skipped `build` and Trunk-only linters | Use `verify:pr` / `verify:ci`                          |
| `lint:eslint` green, Trunk `no-unresolved`    | ESLint ran before `pnpm build`                        | Build first (now in `verify:pr`)                       |
| Prettier green, Trunk `sort-package-json` red | Prettier does not sort `package.json` scripts         | `pnpm lint:package-json` or `pnpm format:package-json` |
| Tests green, Trunk OSV red                    | Vitest/vite CVE only scanned by Trunk                 | `pnpm verify:ci` or upgrade deps + re-lock             |

## Agent termination criteria

- **Trunk available:** `pnpm verify:ci` exits 0
- **Trunk unavailable:** `pnpm verify:pr` exits 0, and warn that OSV/Trivy were not run
