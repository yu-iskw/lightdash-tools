# 26. Documentation split: README, CONTRIBUTING, and AGENTS.md

Date: 2026-02-11

## Status

Accepted

## Context

README contained template placeholders (`{PROJECT_NAME}`, `{PROJECT_DESCRIPTION}`, `{LICENSE}`) and listed only one package; CONTRIBUTING was empty. All contributor workflow (setup, code style, testing, branch/PR/commit, ADR/changelog) lived only in AGENTS.md, which is written for AI agents and includes agent/skill tables. New human contributors had no clear entry point or contribution guide.

## Decision

We split documentation into three roles:

1. **README** (audience: **end-users**): Project identity (name, description, license) and "Using the tools" — HTTP client, CLI, MCP: one sentence each plus link to the corresponding package README (`packages/client/README.md`, `packages/cli/README.md`, `packages/mcp/README.md`). No build, lint, Trunk, or project structure in README. Single line: "Developing? See [CONTRIBUTING](../../CONTRIBUTING.md)." Optionally a brief line linking to [AGENTS.md](../../AGENTS.md) for agent instructions.
2. **CONTRIBUTING** (audience: **developers**): Setup, building from source, project structure, branch from `main`, pre-commit (`pnpm lint && pnpm test`), commit format, PR expectations, where ADRs/changelog/OpenSpec live. Ends with "for full command list, code style, and tooling see AGENTS.md." No duplication of agent/skill tables.
3. **AGENTS.md**: Remains the canonical reference for commands, code style, testing, git/PR workflow, package naming, subagents, and skills. Workflow changes are made here first; CONTRIBUTING only summarizes.

## Consequences

- **Easier**: End-users get a product-oriented intro (what the client, CLI, and MCP are and where to use them). Developers get one doc (CONTRIBUTING) for all contribution and repo layout.
- **Maintainability**: Minimal duplication. When workflow or tooling changes, update AGENTS.md first, then CONTRIBUTING only where it summarizes that workflow.
- **Risk**: Contributors must know to refer to AGENTS.md for full detail; the CONTRIBUTING pointer makes this explicit.
