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

| Agent                    | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `project-manager`        | Unified project management (changelog, ADR). |
| `verifier`               | Run build → lint → test cycle                |
| `code-reviewer`          | Review code for quality and security         |
| `parallel-executor`      | Orchestrate parallel task execution          |
| `parallel-tasks-planner` | Plan task decomposition                      |
| `task-worker`            | Execute isolated subtasks                    |

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
- **Code** (`packages/*`): The **What**. Implementation. Detailed design and specs go in design docs, README, or code.

Refer to [.claude/skills/manage-adr/references/adr-granularity.md](.claude/skills/manage-adr/references/adr-granularity.md) for ADR granularity guidance.

## Configuration Self-Improvement

This project supports Claude Code self-improvement. **At the end of every task where something non-obvious was learned, you MUST update `CLAUDE.md` (Recent Learnings) and/or `AGENTS.md` (Common Gotchas).** See `AGENTS.md → Self-Documentation Protocol` for the full rules; a short summary:

- Discoveries that apply to all AI tools → `AGENTS.md` → **Common Gotchas**
- Claude Code-specific findings → `CLAUDE.md` → **Recent Learnings** (format: `- [YYYY-MM-DD]: ...`)
- When in doubt, update both.

When you notice repeated mistakes, recurring explanations, or opportunities for automation, also consider deeper improvements:

1. **Analyze Pattern**: Identify if it's a rule (guidance), a hook (mandatory action), a skill (workflow), or an agent (specialized task).
2. **Implement Improvement**:
   - **Rules**: Add to `AGENTS.md` (shared) or `CLAUDE.md` / `.cursor/rules/` (platform-specific) for guidance requiring judgment.
   - **Hooks**: Use `PreToolUse` or `PostToolUse` in `.claude/settings.json` for deterministic, mandatory checks.
   - **Skills**: Create new entries in `.claude/skills/` for reusable complex workflows.
   - **Agents**: Define new agents in `.claude/agents/` for specialized context isolation.
3. **Use Subagents**: For configuration research or verification, use subagents to isolate context and prevent contamination of the main session.
4. **Be Specific & Minimal**: Only add rules or skills that provide clear, non-obvious value.

Use the `/improve-claude-config` skill to orchestrate deeper changes.

## Recent Learnings

- [2026-08-07]: content-reader verified discovery is `list_verified_content` → `GET …/content-verification`; `search_content` / OpenAPI v2 content list has no `verifiedOnly` filter — prompt preference flags must call the dedicated tool.
- [2026-08-07]: PoP on content-developer: prefer cloned metrics with `generationType: periodOverPeriod` from seeds; table calculations remain the fallback when seeds lack native PoP (Explorer “Add period comparison” UI is unavailable on MCP).
- [2026-08-06]: Pivot row share SQL is `row_total(${metric})` (aggregate), not invented `pivot_row_total` — that name does not exist; `pivot_*` are offset/index/row helpers only. Preview still accepts bad SQL helpers.
- [2026-08-06]: Content-developer `preview_chart_changes` / `confirm_preview` accept invented `tableCalculations` template `fieldId`s; copy real IDs from `get_chart_as_code` (jaffle: `orders_sum_order_amount`, not playbook-illustrative names). Profile cannot execute queries to verify calc row values.
- [2026-08-05]: MCP SDK v2 progress uses `ctx.mcpReq.notify({ method: 'notifications/progress', params })` with `mcpReq._meta.progressToken`; a top-level `sendNotification` on `ServerContext` does not exist and silently no-ops reporters that look for it.
- [2026-08-04]: MCP mounts are profile-owned `ToolModule` imports (ADR-0022). Export `defineTool` / `defineToolVariant` beside handlers; profiles import those modules; `registry.ts` is denylist + `registerTools` only — not a second catalog.
- [2026-08-04]: MCP stdio is transport-first — `lightdash-mcp stdio --profile <id>` (required); bare invoke fails closed; `http` for Streamable HTTP.
- [2026-08-04]: `AGENTS.md` Common Gotchas is capped at ≤30 lines (pointer hub + traps). Profile/ADR essays belong in `docs/adr` and `docs/profiles`; replace obsolete bullets instead of appending forever.
