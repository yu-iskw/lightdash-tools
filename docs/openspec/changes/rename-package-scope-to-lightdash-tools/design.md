# Design: Rename package scope to @lightdash-tools

## Context

- Current scope is `@lightdash-ai`; root and workspace packages use this scope. The validator script (`scripts/validate-package-names.mjs`) and AGENTS.md enforce it. Many files reference the scope in package names, workspace refs, imports, and docs.
- Goal: single-pass rename to `@lightdash-tools` for branding and tooling clarity.

## File Categories

1. **Package names**: Root `package.json` and each `packages/*/package.json` (name and dependencies with `workspace:*`). Update to `@lightdash-tools` and `@lightdash-tools/<pkg>`.
2. **Validator**: `scripts/validate-package-names.mjs` — set `EXPECTED_ROOT_NAME` and `SCOPE` to `@lightdash-tools`.
3. **Source**: All TypeScript/JS imports of `@lightdash-ai/*` in `packages/client`, `packages/cli`, `packages/common`, `packages/mcp`, `vitest.config.ts`, `scripts/check-common-no-client.mjs`.
4. **Docs**: AGENTS.md, CLAUDE.md, `docs/adr/*.md`, `docs/openspec/changes/**/*.md`, `packages/client/README.md`, `packages/common/README.md`, `packages/cli/README.md`, `.claude/skills/manage-adr/references/mermaid-diagrams.md`, and any other references in .cursor or .claude.
5. **Lockfile**: Regenerate by running `pnpm install` after package renames (do not edit by hand).

## Optional: CLI binary name

- **Choice**: Optionally rename the CLI binary from `lightdash-ai` to `lightdash-tools` in `packages/cli/package.json` (`bin` field) and update any docs that show CLI invocation (e.g. "run `lightdash-ai ...`" → "run `lightdash-tools ...`").
- **Rationale**: Aligns CLI command with scope; can be done in the same change or deferred.

## Execution order

1. Update validator script and all package.json files.
2. Update all source imports and config files that reference `@lightdash-ai`.
3. Run `pnpm install` to refresh lockfile.
4. Update all documentation.
5. Optionally update CLI bin and CLI invocation docs.
6. Run `pnpm validate:names`, `pnpm build`, `pnpm test`, `pnpm lint`.
