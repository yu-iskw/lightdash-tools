# Tasks: Rename package scope to @lightdash-tools

## 1. Update package names and validator script

- [x] 1.1 In `scripts/validate-package-names.mjs`, set `EXPECTED_ROOT_NAME` and `SCOPE` to `@lightdash-tools`.
- [x] 1.2 In root `package.json`, set `name` to `@lightdash-tools`.
- [x] 1.3 In `packages/client/package.json`, set `name` to `@lightdash-tools/client` and update dependency `@lightdash-ai/common` to `@lightdash-tools/common`.
- [x] 1.4 In `packages/common/package.json`, set `name` to `@lightdash-tools/common`.
- [x] 1.5 In `packages/cli/package.json`, set `name` to `@lightdash-tools/cli` and update dependencies `@lightdash-ai/client` and `@lightdash-ai/common` to `@lightdash-tools/*`.
- [x] 1.6 In `packages/mcp/package.json`, set `name` to `@lightdash-tools/mcp` and update any `@lightdash-ai/*` dependencies to `@lightdash-tools/*`.

## 2. Update source imports and lockfile

- [x] 2.1 Replace all `@lightdash-ai/` imports with `@lightdash-tools/` in `packages/client/src`, `packages/cli/src`, `packages/common/src`, `packages/mcp/src`.
- [x] 2.2 Update `vitest.config.ts` and `scripts/check-common-no-client.mjs` to use `@lightdash-tools` where applicable.
- [x] 2.3 Run `pnpm install` from repo root to regenerate `pnpm-lock.yaml`.

## 3. Update documentation and config

- [x] 3.1 Update AGENTS.md and CLAUDE.md: replace `@lightdash-ai` with `@lightdash-tools` in package naming section and any examples.
- [x] 3.2 Update all files in `docs/adr/` that reference `@lightdash-ai` to `@lightdash-tools`.
- [x] 3.3 Update all files in `docs/openspec/changes/` that reference `@lightdash-ai` to `@lightdash-tools`.
- [x] 3.4 Update `packages/client/README.md`, `packages/common/README.md`, and `packages/cli/README.md`.
- [x] 3.5 Update `.claude/skills/manage-adr/references/mermaid-diagrams.md` and any other .claude references.
- [x] 3.6 Update `.changes/unreleased/*.yaml` if any reference the old scope.

## 4. Optional: CLI binary rename

- [x] 4.1 In `packages/cli/package.json`, change `bin` from `"lightdash-ai"` to `"lightdash-tools"` (if doing the optional rename).
- [x] 4.2 Update docs that show CLI invocation (e.g. `lightdash-ai` → `lightdash-tools` in spec examples and READMEs).

## 5. Verification

- [x] 5.1 Run `pnpm validate:names` and fix any failures.
- [x] 5.2 Run `pnpm build` and fix any errors.
- [x] 5.3 Run `pnpm test` and fix any failures.
- [x] 5.4 Run `pnpm lint` and fix any violations.
- [x] 5.5 Confirm no remaining `@lightdash-ai` in the repo (e.g. `rg '@lightdash-ai'` returns no matches in tracked files).
