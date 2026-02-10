# Spec: Rename package scope to @lightdash-tools

## ADDED Requirements

### Requirement: Package names use @lightdash-tools scope

The root package and all workspace packages SHALL use the scope `@lightdash-tools`. The validator script SHALL expect this scope and SHALL fail if any package name uses `@lightdash-ai`.

#### Scenario: Root package name

- **GIVEN** the repository root `package.json`
- **WHEN** the name field is read
- **THEN** it SHALL be `@lightdash-tools`

#### Scenario: Workspace package names

- **GIVEN** any workspace package under `packages/*` with a `package.json`
- **WHEN** the name field is read
- **THEN** it SHALL be `@lightdash-tools/<dirname>` (e.g. `@lightdash-tools/common`, `@lightdash-tools/client`)

#### Scenario: Validator script

- **GIVEN** `scripts/validate-package-names.mjs`
- **WHEN** the script runs
- **THEN** it SHALL expect `EXPECTED_ROOT_NAME` and `SCOPE` to be `@lightdash-tools` and SHALL pass when all package names conform

### Requirement: No remaining @lightdash-ai in source or docs

The codebase SHALL NOT contain the string `@lightdash-ai` in any tracked source file, config file, or documentation file (except where documenting the rename itself, e.g. changelog or ADR that says "renamed from @lightdash-ai").

#### Scenario: Source and config

- **GIVEN** any file under `packages/*/src`, `vitest.config.ts`, or `scripts/*.mjs`
- **WHEN** searched for `@lightdash-ai`
- **THEN** there SHALL be no matches (imports and references SHALL use `@lightdash-tools`)

#### Scenario: Documentation

- **GIVEN** AGENTS.md, CLAUDE.md, docs/adr, docs/openspec, package READMEs, and .claude references
- **WHEN** searched for `@lightdash-ai` in current package naming or usage examples
- **THEN** those references SHALL be updated to `@lightdash-tools` (historical references in ADR-0012 or changelog are allowed)

### Requirement: Verification commands pass

After the rename, the standard verification commands SHALL pass without modification to the commands themselves (only to the codebase content).

#### Scenario: validate:names

- **WHEN** `pnpm validate:names` is run from the repository root
- **THEN** it SHALL exit with code 0

#### Scenario: build

- **WHEN** `pnpm build` is run from the repository root
- **THEN** it SHALL complete successfully (all packages build)

#### Scenario: test

- **WHEN** `pnpm test` is run from the repository root
- **THEN** all tests SHALL pass

#### Scenario: lint

- **WHEN** `pnpm lint` is run from the repository root
- **THEN** lint SHALL pass (no violations)
