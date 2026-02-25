# TypeScript Monorepo - Claude Code Memory

For full shared agent instructions (setup, build, test, code style, git workflow, architecture, and gotchas), see `AGENTS.md`.

## Shared Project Instructions

Use `AGENTS.md` as the canonical project and cross-platform agent guide.

## Parallel Task Execution

For large tasks that can benefit from concurrent work:

```bash
/parallel-executor Add comprehensive logging to all modules
```

This decomposes tasks into independent subtasks with file ownership, executes them in parallel, and verifies results.

## Available Agents

| Agent                    | Purpose                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `project-manager`        | Unified project management (changelog, ADR, OpenSpec, issues); routes to specialists and default project. |
| `github-project-manager` | Sync repo work with GitHub Projects                                                                       |
| `github-triage-agent`    | Triage, label, and assign issues                                                                          |
| `openspec-manager`       | Run OpenSpec SDD workflows (root: `docs/openspec/`; run CLI from `docs/` or `pnpm openspec --`)           |
| `verifier`               | Run build → lint → test cycle                                                                             |
| `code-reviewer`          | Review code for quality and security                                                                      |
| `parallel-executor`      | Orchestrate parallel task execution                                                                       |
| `parallel-tasks-planner` | Plan task decomposition                                                                                   |
| `task-worker`            | Execute isolated subtasks                                                                                 |

## Default GitHub Project

This repository uses the following GitHub Project for tracking work:

- **URL**: <https://github.com/users/yu-iskw/projects/3/views/1> <!-- markdown-link-check-disable-line -->
- **Owner**: `yu-iskw`
- **Project Number**: `3`

When using the `github-project-manager` agent or GitHub Project-related skills, this project should be used as the default target unless explicitly specified otherwise. ADR, changelog, OpenSpec, and issue work must always be tracked on this project (add or link issues via `gh-adding-items-to-projects` or the github-project-manager agent).

## Available Skills

| Skill                          | Purpose                                                                                        |
| :----------------------------- | :--------------------------------------------------------------------------------------------- |
| `build-and-fix`                | Build the project and automatically fix build errors, compilation failures, or type mismatches |
| `clean-project`                | Perform a "hard reset" of the development environment (clean node_modules, lockfiles, etc.)    |
| `fix-issue`                    | Fix a GitHub issue end-to-end (view, branch, fix, test, PR)                                    |
| `improve-claude-config`        | Self-improvement skill for evolving Claude Code configuration                                  |
| `initialize-project`           | Initialize a new project from the template (rename packages, update metadata)                  |
| `lint-and-fix`                 | Run linters and fix violations, formatting errors, or style mismatches using Trunk             |
| `manage-adr`                   | Manage Architecture Decision Records (init, create, list, link ADRs in `docs/adr`)             |
| `manage-changelog`             | Manage changelogs with Changie (init, add fragments, batch releases, merge into CHANGELOG.md)  |
| `node-upgrade`                 | Safely upgrade Node.js dependencies in pnpm workspaces                                         |
| `security-vulnerability-audit` | Audit security vulnerabilities using Trunk (Trivy and OSV-scanner)                             |
| `setup-dev-env`                | Set up the development environment (Node.js, pnpm, Trunk)                                      |
| `test-and-fix`                 | Run unit tests and automatically fix failures, regression bugs, or test mismatches             |
| `problem-solving`              | Systematic issue analysis and report generation (global skill)                                 |

## Decision Documentation Hierarchy

This project follows a strict documentation hierarchy for technical decisions:

- **ADR** (`docs/adr`): The **Why**. High-level architecture, strategy, and trade-offs.
- **OpenSpec** (`docs/openspec`): The **How**. Detailed design, API specifications, and implementation tasks.
- **Code** (`packages/*`): The **What**. Implementation.

Refer to [.claude/skills/manage-adr/references/adr-granularity.md](.claude/skills/manage-adr/references/adr-granularity.md) for detailed guidance on ADR vs. OpenSpec granularity.

## Configuration Self-Improvement

This project supports Claude Code self-improvement. When you notice repeated mistakes, recurring explanations, or opportunities for automation:

1. **Analyze Pattern**: Identify if it's a rule (guidance), a hook (mandatory action), a skill (workflow), or an agent (specialized task).
2. **Implement Improvement**:
   - **Rules**: Add to `AGENTS.md` (shared) or `CLAUDE.md` / `.cursor/rules/` (platform-specific) for guidance requiring judgment.
   - **Hooks**: Use `PreToolUse` or `PostToolUse` in `.claude/settings.json` for deterministic, mandatory checks.
   - **Skills**: Create new entries in `.claude/skills/` for reusable complex workflows.
   - **Agents**: Define new agents in `.claude/agents/` for specialized context isolation.
3. **Use Subagents**: For configuration research or verification, use subagents to isolate context and prevent contamination of the main session.
4. **Be Specific & Minimal**: Only add rules or skills that provide clear, non-obvious value.

Use the `/improve-claude-config` skill to orchestrate these changes.

## Recent Learnings

- [2026-02-05]: Initial setup of the comprehensive skills reference and self-improvement guidelines.
