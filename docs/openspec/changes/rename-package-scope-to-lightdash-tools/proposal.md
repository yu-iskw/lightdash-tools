# Proposal: Rename package scope to @lightdash-tools

## Why

We want the npm package scope to reflect "Lightdash tooling" (CLI, client, MCP, common) and avoid overloading "lightdash-ai" for both product identity and npm scope. The monorepo contains tools for interacting with Lightdash, not the AI product itself.

## What Changes

- Rename package namespace from `@lightdash-ai` to `@lightdash-tools` in one pass:
  - Root and workspace `package.json` names and workspace dependency references
  - Package name validator script (`scripts/validate-package-names.mjs`)
  - All source imports in packages (client, cli, common, mcp) and config (vitest, scripts)
  - All documentation (AGENTS.md, CLAUDE.md, ADRs, OpenSpec, READMEs, .claude references)
- Regenerate `pnpm-lock.yaml` via `pnpm install`.
- Optional: rename CLI binary from `lightdash-ai` to `lightdash-tools` in `packages/cli/package.json` and docs that show CLI invocation.

**BREAKING**: Any existing consumers of published packages must switch to `@lightdash-tools/*`.

## Capabilities

### Modified Capabilities

- **Package naming**: Project scope SHALL be `@lightdash-tools`; root package name SHALL be `@lightdash-tools`; workspace packages SHALL be named `@lightdash-tools/<dirname>` (e.g. `packages/common` → `@lightdash-tools/common`). The validator script and agent docs SHALL enforce this scope.

## Impact

- **Code**: All `package.json` files, `scripts/validate-package-names.mjs`, source imports, `vitest.config.ts`, `scripts/check-common-no-client.mjs`, and lockfile.
- **Documentation**: AGENTS.md, CLAUDE.md, docs/adr/_.md, docs/openspec/changes/\*\*/_.md, package READMEs, .claude references.
- **Consumers**: Breaking change; document in changelog.

## References

- ADR-0012: Rename package scope to @lightdash-tools
- GitHub Issue: #20
- Plan: Rename scope and project tracking
