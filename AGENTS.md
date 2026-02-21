# Agent Instructions

## Project Overview

This repository is a production-ready TypeScript monorepo template.
It uses pnpm workspaces, Node.js (see `.node-version`), Trunk, Vitest, and GitHub Actions.
Use this file as the shared quick reference for Cursor, Claude Code, Codex, and Gemini CLI.

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
- Store ADRs in `docs/adr` and use `manage-adr` when `adr-tools` is available.

## Architecture

- Monorepo packages live in `packages/*`.
- CI workflows live in `.github/workflows/`.
- Claude-specific config lives in `.claude/`.
- Cursor-specific config lives in `.cursor/`.
- OpenSpec lives under `docs/openspec/`. Run OpenSpec CLI commands from the `docs/` directory (e.g. `cd docs && openspec list`) or from repo root via `pnpm openspec -- <subcommand>`.

## Package Naming

- Project scope is `@lightdash-tools`; root package name is `@lightdash-tools`.
- Workspace packages must be named `@lightdash-tools/<dirname>` (for example, `packages/common` → `@lightdash-tools/common`).
- Run `pnpm validate:names` before submitting PRs that touch package names or add packages.

## Default GitHub Project

This repository uses the following GitHub Project for tracking work:

- **URL**: <https://github.com/users/yu-iskw/projects/3/views/1> <!-- markdown-link-check-disable-line -->
- **Owner**: `yu-iskw`
- **Project Number**: `3`

When using the `github-project-manager` agent or GitHub Project-related skills, this project should be used as the default target unless explicitly specified otherwise. Work tied to ADRs, changelogs, OpenSpec, or GitHub issues must be tracked on this project; when creating such work, add or link the corresponding issue to the project. For general project management, use the project-manager agent; it routes to specialists and enforces project tracking.

## Subagents

| Agent                    | Purpose                                                                                                 |
| :----------------------- | :------------------------------------------------------------------------------------------------------ |
| `project-manager`        | Unified project management: changelog, ADR, OpenSpec, issues; ensure work is on default GitHub Project. |
| `github-project-manager` | Sync repository work with GitHub Projects.                                                              |
| `github-triage-agent`    | Triage issues, apply labels, and assign owners.                                                         |
| `openspec-manager`       | Run Spec-Driven Development workflows with OpenSpec.                                                    |
| `verifier`               | Run build, lint, and test verification cycles.                                                          |
| `code-reviewer`          | Review code quality and security concerns.                                                              |
| `parallel-executor`      | Orchestrate parallel task execution.                                                                    |
| `parallel-tasks-planner` | Decompose work into isolated parallel tasks.                                                            |
| `task-worker`            | Execute a single isolated subtask with clear file ownership.                                            |

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

When using `manage-adr`, `manage-changelog`, or OpenSpec, ensure related issues are on the default GitHub Project. Additional specialized skills are documented in `CLAUDE.md`.

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
