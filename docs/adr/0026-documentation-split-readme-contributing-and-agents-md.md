# 26. Documentation split: README, CONTRIBUTING, and AGENTS.md

Date: 2026-02-11

## Status

Accepted

## Context

README contained template placeholders (`{PROJECT_NAME}`, `{PROJECT_DESCRIPTION}`, `{LICENSE}`) and listed only one package; CONTRIBUTING was empty. All contributor workflow (setup, code style, testing, branch/PR/commit, ADR/changelog) lived only in AGENTS.md, which is written for AI agents and includes agent/skill tables. New human contributors had no clear entry point or contribution guide.

## Decision

We split documentation into three roles:

1. **README**: Project identity (name, description, license), prerequisites, install, dev/build/lint/format, and project structure listing all packages (`cli`, `client`, `common`, `mcp`). Links to AGENTS.md for agent instructions and to CONTRIBUTING for how to contribute.
2. **CONTRIBUTING**: Human-oriented contribution flow only: setup, branch from `main`, pre-commit (`pnpm lint && pnpm test`), commit format, PR expectations, where ADRs/changelog/OpenSpec live. Ends with "for full command list, code style, and tooling see AGENTS.md." No duplication of agent/skill tables.
3. **AGENTS.md**: Remains the canonical reference for commands, code style, testing, git/PR workflow, package naming, subagents, and skills. Workflow changes are made here first; CONTRIBUTING only summarizes.

## Consequences

- **Easier**: New contributors get a clear path (README → CONTRIBUTING) without reading agent-specific content. README reflects the real project; CONTRIBUTING is short and actionable.
- **Maintainability**: Minimal duplication. When workflow or tooling changes, update AGENTS.md first, then CONTRIBUTING only where it summarizes that workflow.
- **Risk**: Contributors must know to refer to AGENTS.md for full detail; the CONTRIBUTING pointer makes this explicit.
