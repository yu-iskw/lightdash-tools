# Agent Instructions

## Project Overview

This repository is a production-ready TypeScript monorepo template.
It uses pnpm workspaces, Node.js (see `.node-version`), Trunk, Vitest, and GitHub Actions.
Use this file as the shared quick reference for Cursor, Claude Code, Codex, and Gemini CLI.

## Self-Documentation Protocol

**Every AI agent working in this repository MUST update `AGENTS.md` and/or `CLAUDE.md` at the end of any task where something non-obvious was learned.** This creates shared memory that improves every future session.

### When to update

Update whenever you discover any of the following during a task:

- A tool, command, or API behaved differently than you expected
- A workaround was required that is not obvious from the code
- A pattern or convention was corrected or clarified
- A PR/code review caught a bug caused by a wrong assumption
- An environment constraint changed the normal workflow

### What to update

| Learning type                                        | File to update | Section              |
| :--------------------------------------------------- | :------------- | :------------------- |
| Environment/tool/pattern issues affecting all agents | `AGENTS.md`    | **Common Gotchas**   |
| Claude Code-specific observations                    | `CLAUDE.md`    | **Recent Learnings** |
| Broadly applicable to all agents and tools           | Both files     | Both sections        |

### Format rules

- `AGENTS.md` → Common Gotchas: concise bullet (`- **Topic:** explanation in 1–3 sentences.`). Keep the section ≤30 lines — replace an obsolete bullet rather than append forever. Profile/ADR depth belongs in `docs/adr` and `docs/profiles`, not here.
- `CLAUDE.md` → Recent Learnings: dated entry (`- [YYYY-MM-DD]: explanation in 1–3 sentences.`)
- Commit doc updates together with the fix, or in a separate `docs:` commit.

## Setup Commands

```bash
pnpm install       # Install all dependencies
pnpm build         # Build all packages
pnpm test          # Run Vitest with v8 coverage and threshold checks
pnpm test:fast     # Vitest without coverage (local iteration only)
pnpm lint          # Trunk (@trunkio/launcher) + lint:local (eslint, knip, package.json, prettier)
pnpm lint:eslint   # ESLint only
pnpm knip          # Unused exports, files, and dependencies
pnpm trunk:install # Fetch Trunk-managed linters (run once after pnpm install)
pnpm verify        # Alias for verify:pr (default before commit)
pnpm verify:quick  # Fast loop: build → test → lint:local
pnpm verify:pr     # Pre-PR gate: validations → build → test → lint:local
pnpm verify:ci     # Full CI parity: verify:pr + lint:trunk (OSV, Trivy, markdown, YAML)
pnpm format        # Auto-format code via Trunk
pnpm clean         # Clean build artifacts
```

## Quality Gates

Unless the user explicitly narrows scope, run the relevant gates from the repository root before claiming completion:

1. `pnpm test` for Vitest with coverage (thresholds in [`coverage-thresholds.mjs`](coverage-thresholds.mjs)).
2. `pnpm lint:eslint` and `pnpm knip` for TypeScript hygiene.
3. `pnpm build` when the change spans package exports, shared types, or publish-shaped behavior.
4. `pnpm verify:pr` (or `pnpm verify`) before commit. Use `pnpm verify:ci` to match CI including Trunk OSV/Trivy. See [local-ci-parity.md](.claude/skills/common-references/local-ci-parity.md).
5. `pnpm lint` when touching Markdown, YAML, `.trunk/`, lockfiles, or GitHub workflow files.

Root [`eslint.config.mjs`](eslint.config.mjs) layers import-x, SonarJS, security, unicorn, eslint-comments, and Vitest rules on top of `@typescript-eslint` (dbt-tools-ts pattern). It enforces `@typescript-eslint/no-deprecated` on CLI and MCP (ADR-0009). [`knip.json`](knip.json) maps workspace entrypoints (CLI/MCP bins, tests, scripts) so agents can detect unused exports and dependencies without manual inventory.

## Code Style

- Use TypeScript for all code.
- Follow project ESLint/Prettier configuration (managed via Trunk).
- Use functional programming patterns where appropriate.
- Use `PascalCase` for classes/interfaces and `camelCase` for functions/variables.
- Use `kebab-case` for file names (for example: `user-service.ts`).

## Testing

- Use Vitest for unit and integration tests.
- Write tests in `tests/` or alongside source files as `*.test.ts`.
- Run `pnpm test` before committing (includes coverage; reports under `coverage/`).
- Use `pnpm test:fast` only for tight local loops — CI and `pnpm verify` use `pnpm test`.
- Global coverage floors live in [`coverage-thresholds.mjs`](coverage-thresholds.mjs); raise them as coverage improves.

## Git And PR Workflow

- Create feature branches from `main`.
- Run `pnpm verify:quick` (or `pnpm verify` before larger changes) before commit.
- Commit format: `type(scope): description` (for example: `feat(ui): add new button component`).
- Commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Use `manage-changelog` when `changie` is available.
- **Decision Documentation**:
  - Use **ADRs** for "Why" (Architecture/Strategy).
- Store ADRs in `docs/adr` and use `manage-adr` when `adr-tools` is available.

## Agent Context (Lightdash CLI / MCP)

When using the Lightdash CLI or MCP tools, read [docs/operators/agent-context.md](docs/operators/agent-context.md) for agent-specific invariants (dry-run, allowlist, field masks, schema introspection).

## Architecture

- Monorepo packages live in `packages/*`.
- CI workflows live in `.github/workflows/`.
- Claude-specific config lives in `.claude/`.
- Cursor-specific config lives in `.cursor/`.

## Decision Documentation Hierarchy

We maintain a clear hierarchy for documenting decisions:

1. **Architecture Decision Records (ADR)** (`docs/adr`): Focus on the **Why**. Document high-level architectural choices, strategic direction, and non-obvious trade-offs.
2. **Code** (`packages/*`): Focus on the **What**. The implementation itself.

**Rule of Thumb**: If it's about architecture or strategy, use an ADR. If it's about implementation details or specific features, document in design docs, README, or code. Refer to `.claude/skills/manage-adr/references/adr-granularity.md` for more details.

## Package Naming

- Project scope is `@lightdash-tools`; root package name is `@lightdash-tools`.
- Workspace packages must be named `@lightdash-tools/<dirname>` (for example, `packages/common` → `@lightdash-tools/common`).
- Run `pnpm validate:names` before submitting PRs that touch package names or add packages.

## Subagents

| Agent                    | Purpose                                                      |
| :----------------------- | :----------------------------------------------------------- |
| `project-manager`        | Unified project management: changelog, ADR.                  |
| `verifier`               | Run build, lint, and test verification cycles.               |
| `code-reviewer`          | Review code quality and security concerns.                   |
| `parallel-executor`      | Orchestrate parallel task execution.                         |
| `parallel-tasks-planner` | Decompose work into isolated parallel tasks.                 |
| `task-worker`            | Execute a single isolated subtask with clear file ownership. |

## Key Skills

| Skill                     | Purpose                                                       |
| :------------------------ | :------------------------------------------------------------ |
| `manage-adr`              | Manage ADRs in `docs/adr` (`adr-tools` required).             |
| `manage-changelog`        | Manage changelog workflows with Changie (`changie` required). |
| `build-and-fix`           | Build the repo and resolve build/type errors quickly.         |
| `lint-and-fix`            | Run linting/formatting checks and fix violations.             |
| `fix-issue`               | Handle a GitHub issue end-to-end.                             |
| `setup-dev-env`           | Prepare local Node.js, pnpm, and Trunk tooling.               |
| `test-and-fix`            | Run tests and fix regressions or failing cases.               |
| `manage-package-versions` | Consistently manage package versions across the monorepo.     |
| `problem-solving`         | Run structured issue analysis and reporting.                  |

Additional specialized skills are documented in `CLAUDE.md`.

## Common Gotchas

- Use `pnpm` only (not npm/yarn). Enable Corepack if `pnpm` is missing.
- Corepack: if you invoke commands via `corepack pnpm ...`, run `corepack enable` before repo scripts that shell out to nested `pnpm` (for example `pnpm build`), or those nested calls fail with `pnpm: not found`.
- Trunk: `@trunkio/launcher` + `pnpm trunk:install`; restricted network → `pnpm lint:eslint` / `format:eslint` / `format:prettier`.
- pnpm v11: `overrides` live in `pnpm-workspace.yaml`; keep lockfile committed; `packageManager` is `pnpm@11.5.3`. Use exact pins (or `~`) for security bumps — `>=x.y.z` can pull the next major.
- Build before ESLint (`dist/` resolves); prefer root `pnpm exec vitest run <files>` over per-package `test:fast`.
- Changie: `kindFormat: '### {{.Kind}}'`; fragments use kind keys (`feat`/`fix`), not Keep-a-Changelog labels. After `changie merge`, Trunk/Prettier reformats CHANGELOG.md (`*` → `-`, blank lines).
- `pnpm -r version` needs a clean tree — bump `packages/*/package.json` versions directly if dirty.
- Agent surface: MCP profiles own mounts via `tools: ToolModule[]` imports (ADR-0022); irrecoverable tool ids stay on `IRRECOVERABLE_TOOL_DENYLIST` (ADR-0004).
- MCP: `registerToolSafe()` only; CLI: `wrapAction()`; serving profile via `bindServerProfile` + profile `tools` array.
- MCP progress (SDK v2): emit via `ctx.mcpReq.notify` when `mcpReq._meta.progressToken` is set — there is no top-level `sendNotification` on `ServerContext` (ADR-0023).
- Guardrails return `_lightdashBlocked`; upstream failures are coded `UPSTREAM_*` / `RATE_LIMITED`, not blocked markers.
- Env: `LIGHTDASH_TOOLS_*`; shared allowlist `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`; obsolete allowlist names fail closed. MCP HTTP listen: `LIGHTDASH_TOOLS_MCP_HTTP_PORT`, else platform `PORT` (Cloud Run), else `3100`. Launch via `npx`/`pnpm dlx`/`lightdash-mcp` — not `pnpm exec @lightdash-tools/mcp`.
- Stdio: `lightdash-mcp stdio --profile <id>` only — no default; `http` mounts all profiles unless `LIGHTDASH_TOOLS_MCP_PROFILES` is set (comma-separated ids; unset = all). Prompt context default `compact`; override with `LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT` / `--prompt-context` (`compatible`|`embedded`; ADR-0025).
- Audit: `initAuditLog()` once at startup; unset `LIGHTDASH_TOOLS_AUDIT_LOG` → JSON audit on stderr (Cloud Run).
- Stateless MCP HTTP (ADR-0019): no SessionStore/Redis; obsolete store/redis env fail closed; OAuth broker is in-memory (sticky `/oauth/*`).
- Content-developer: do not edit proposed body after preview (hash mismatch ≠ TTL); see ADR-0014/0019. Table-calc `fieldId`s must come from `get_chart_as_code` — preview/confirm do not prove they exist. Prefer cloned `generationType: periodOverPeriod` metrics over inventing PoP; do not set `verified` / `preserveVerification` unless the user asks.
- content-reader: prefer `list_verified_content` (GET `…/content-verification`) for trusted seeds; `search_content` has no `verifiedOnly` filter.
- OpenAPI lists are wrapped (`results.data.<key>`); bump `config/lightdash-openapi-ref.txt` (40-char commit SHA for releases) before `generate:types` — never hand-edit generated types.
- MCP tests are CJS under `tsc` — no `import.meta`; stdio smoke spawns `dist/bin.js` with an explicit profile arg.
- Knip: keep type-barrel `ignoreIssues`; delete unused intermediate re-exports rather than broaden ignores.
- GPG: agent commit/rebase can hang on pinentry; rebase may ignore `commit.gpgsign=false` — finish with `git commit --no-gpg-sign`.
- Profile depth, inventories, and binding why → [`docs/adr`](docs/adr) + [`docs/profiles`](docs/profiles) (not here).
- **Visualization package:** `@lightdash-tools/visualization` is pure (no `client`/`mcp`); Zod 4 `z.record(enumKey, …)` requires all enum keys — use explicit optional object keys for partial role maps.
