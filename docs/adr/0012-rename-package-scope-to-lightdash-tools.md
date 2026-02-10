# 12. Rename package scope to @lightdash-tools

Date: 2026-02-10

## Status

Accepted

## Context

The current npm package scope is `@lightdash-ai`. We want a scope that reflects "Lightdash tooling" (CLI, client, MCP, common) and avoid overloading "lightdash-ai" for both product identity and npm scope. The monorepo contains packages that are tools for interacting with Lightdash, not the AI product itself.

## Decision

Rename the package namespace from `@lightdash-ai` to `@lightdash-tools` in one pass across:

- Root and workspace `package.json` names and workspace dependency references
- The package name validator script (`scripts/validate-package-names.mjs`)
- All source imports in packages (client, cli, common, mcp) and config (vitest, scripts)
- All documentation (AGENTS.md, CLAUDE.md, ADRs, OpenSpec, READMEs, .claude references)

Optionally rename the CLI binary from `lightdash-ai` to `lightdash-tools` in `packages/cli/package.json` and any docs that show CLI invocation.

## Consequences

- **Easier**: Single, consistent scope that clearly signals "Lightdash tooling"; no confusion between product name and package scope.
- **Breaking**: Any existing consumers of published packages must switch to `@lightdash-tools/*` and update imports; document in changelog and release notes.
- **One-way**: No dual-scope support in-repo; the codebase uses only `@lightdash-tools`.
