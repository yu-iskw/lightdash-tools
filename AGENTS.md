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

- `AGENTS.md` → Common Gotchas: concise bullet (`- **Topic:** explanation in 1–3 sentences.`)
- `CLAUDE.md` → Recent Learnings: dated entry (`- [YYYY-MM-DD]: explanation in 1–3 sentences.`)
- Commit doc updates together with the fix, or in a separate `docs:` commit.

## Setup Commands

```bash
pnpm install    # Install all dependencies
pnpm build      # Build all packages
pnpm test       # Run all tests via Vitest
pnpm lint       # Run all linters via Trunk
pnpm format     # Auto-format code via Trunk
pnpm clean      # Clean build artifacts
```

## Code Style

- Use TypeScript for all code.
- Follow project ESLint/Prettier configuration (managed via Trunk).
- Use functional programming patterns where appropriate.
- Use `PascalCase` for classes/interfaces and `camelCase` for functions/variables.
- Use `kebab-case` for file names (for example: `user-service.ts`).

## Testing

- Use Vitest for unit and integration tests.
- Write tests in `tests/` or alongside source files as `*.test.ts`.
- Run `pnpm test` before committing.

## Git And PR Workflow

- Create feature branches from `main`.
- Run `pnpm lint && pnpm test` before commit.
- Commit format: `type(scope): description` (for example: `feat(ui): add new button component`).
- Commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Use `manage-changelog` when `changie` is available.
- **Decision Documentation**:
  - Use **ADRs** for "Why" (Architecture/Strategy).
- Store ADRs in `docs/adr` and use `manage-adr` when `adr-tools` is available.

## Agent Context (Lightdash CLI / MCP)

When using the Lightdash CLI or MCP tools, read [docs/agent-context/CONTEXT.md](docs/agent-context/CONTEXT.md) for agent-specific invariants (dry-run, allowlist, field masks, schema introspection).

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

- Use `pnpm` only (do not use `npm` or `yarn`).
- Trunk manages tool versions hermetically; avoid global linter installs.
- Keep `pnpm-lock.yaml` committed for reproducible installs.
- Run `trunk install` if Trunk reports missing tools.
- ADR and Changie are initialized (`docs/adr`, `.changie.yaml`); use the `manage-adr` and `manage-changelog` skills when `adr-tools` and `changie` are available.
- **Trunk unavailable (restricted network):** If `curl https://get.trunk.io` returns 403, use these direct fallbacks instead of Trunk commands:
  - Lint: `pnpm lint:eslint`
  - Format: `pnpm format:eslint` (ESLint auto-fix) and `pnpm format:prettier` (Prettier)
  - These skip Trunk entirely but cover the essential formatting and linting checks.
- **OpenAPI paginated responses are always wrapped:** Lightdash list endpoints return `{ results: { data: { <key>: T[] }, pagination? }, status: 'ok' }`, not a bare array. Always check the `ApiXxxListResponse` schema in `packages/common/src/types/generated/openapi-types.ts` before assuming the shape. Extract the inner array (e.g. `response.results.data.runs`) after fetching.
- **New common types must be threaded through three layers:** When adding a type from the OpenAPI-generated file to `packages/common`, export it from: (1) `types/v1/ai-agents.ts` namespace, (2) both the namespace and the flat exports in `types/v1/lightdash-api.ts`, and (3) the flat export block in `types/lightdash-api.ts`. Missing any layer causes "not exported" build errors in dependent packages.
- **Validate org-wide CLI flags explicitly:** Boolean CLI flags that affect organization-wide settings (e.g. `--ai-agents-visible`) must validate against the exact allowed literals (`'true'`/`'false'`) and `process.exit(1)` on invalid input. Never silently coerce via `value === 'true'` — typos like `True` or `yes` would silently disable features.
- **MCP tools must use `registerToolSafe()`:** Every MCP tool registration must go through `registerToolSafe()` in `packages/mcp/src/tools/shared.ts`, never the raw `server.registerTool()`. This applies the layered guardrails: safety-mode filter → dry-run simulation → project allowlist → audit logging (outermost).
- **CLI actions must use `wrapAction()`:** Every CLI command's `.action()` callback must be wrapped with `wrapAction(annotations, fn)` from `packages/cli/src/utils/safety.ts`. This enforces safety-mode and records audit log entries for every invocation.
- **Input validation applies only to known identifier keys:** `validateResourceId()` is applied to strings under `project`, `projectUuid`, `projectUuids`, `projects`, `slug` in options/nested objects—not to bare positional strings. Free-form positionals (query, name, resource) may contain `?`, `#`, `%`; do not add validation for them. When adding a new identifier option, include its key in the list in `packages/cli/src/utils/safety.ts`. See [ADR-0034](docs/adr/0034-input-validation-validate-only-known-identifier-fields.md).
- **`_lightdashBlocked` marker convention:** Guardrail layers (safety-mode block, dry-run, project-allowlist denial) return `{ ..., _lightdashBlocked: true }`. The audit wrapper reads this flag to set `status = 'blocked'`, then strips it before returning to the MCP client. Do not return this marker from real tool handlers.
- **Tool args may use singular or plural project UUID shapes:** `extractProjectUuids()` in `shared.ts` handles both `projectUuid: string` and `projectUuids: string[]`. When writing project-allowlist or audit logic, always use this helper instead of reading `args.projectUuid` directly.
- **Env var naming is not uniform — know each one:** `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` (project allowlist), `LIGHTDASH_DRY_RUN` (accepts `1`, `true`, or `yes`), `LIGHTDASH_AUDIT_LOG` (file path or unset for stderr), `LIGHTDASH_TOOL_SAFETY_MODE`. The `LIGHTDASH_TOOLS_` prefix is only on the allowlist var.
- **`initAuditLog()` must be called once at process startup:** Both `packages/cli/src/index.ts` and MCP's `bin.ts` call `initAuditLog()` at startup. Any new entrypoint must do the same; individual command files do not need to call it.
- **MCP tool names must be concise:** Some MCP clients (e.g., Claude Desktop) impose a 60-character limit on combined server and tool names. Use the `ldt__` prefix (set in `packages/mcp/src/tools/shared.ts`) and avoid excessively long tool names to ensure they are not filtered out.
- **`pnpm audit` can be registry-blocked in this environment:** The npm audit endpoint may return HTTP 403 (`ERR_PNPM_AUDIT_BAD_RESPONSE`), so a failing audit command can be an infrastructure limitation rather than package vulnerability output. Run upgrades/checks (`pnpm outdated -r`, targeted `pnpm up -r ...`) and report audit as a warning when this happens.
