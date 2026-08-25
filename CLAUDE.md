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

- [2026-08-25]: MCP HTTP volume/TLS/Host/WAF belong at the operator edge (GCLB + Armor throttle, Cloud Run `internal-and-cloud-load-balancing`). Do not delete Origin, dual-leg OAuth, or per-user query budgets to “delegate to Armor”; empty `ALLOWED_ORIGINS` is the hosted default (ADR-0032). Stock OWASP CRS on JSON-RPC POSTs false-positives SQL/Explore payloads.
- [2026-08-21]: `ai-agent-chat` agent pick is named/hint → preferences → `route_agent` → single-agent or ask user (ADR-0031). Never match on instruction/`enableContentTools`. Prefix Lightdash dashboard/chart UUID into create prompt; require title+UUID in the reply.
- [2026-08-21]: `ai-agent-chat` `create_agent_thread` requires `prompt` (ADR-0030). Empty `{}` fails live: upstream inserts `ai_thread` then `getThread` INNER JOINs `ai_prompt` (promptless = unfetchable). Flow: create(+prompt)→generate; follow-ups message→generate.
- [2026-08-20]: HttpClient per-request retry is the 4th argument on get/post/put/patch/delete — do not put retry on Axios config. `ai-agent-chat` conversation writes pass `{ maxRetries: 0 }` so a 5xx after generate does not duplicate warehouse/LLM work.
- [2026-08-20]: Vitest `vitest/valid-expect` forbids `expect(value, message)` — use `it.each` to label table-driven cases.
- [2026-08-20]: `ai-agent-chat` is a dedicated conversation profile (`/ai-agent-chat/v1/mcp`, server `lightdash-mcp-aichat`): first turn create-with-prompt → `POST …/generate`; follow-ups message → generate. Do not add generate to `ai-agent-ops`. Do not describe the profile as read-only — nested agent MCP tools stay a Lightdash config boundary (ADR-0029/0030). Tool modules follow `evaluations.ts`: preferences on `agents.ts`, conversation writes on `threads.ts` — not `chat.ts`/`preferences.ts`.
- [2026-08-20]: content-reader `run_dashboard_tile` executes saved `sql_chart` tiles via `POST …/query/dashboard-sql-chart` (ADR-0028); `run_chart` SQL and `POST …/query/sql` stay off. `dateZoom` is not a field on dashboard-sql-chart — warn `DATE_ZOOM_IGNORED`.
- [2026-08-11]: MCP prompts default to progressive-disclosure `compact` (ADR-0025 / RFC); roll back with `LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT=embedded`. Invariants live in per-profile `invariants.ts` — do not paste HARD_BANS into prompt task text.
- [2026-08-10]: OpenAPI sync is pin-first: write a release commit SHA to `config/lightdash-openapi-ref.txt`, then `pnpm --filter @lightdash-tools/common generate:types` — skills that implied always-from-`main` were wrong.
- [2026-08-10]: After `changie merge`, Trunk/Prettier rewrites CHANGELOG.md (`*` bullets → `-`, blank lines around headings). Format before claiming lint clean.
- [2026-08-17]: Grype/GHSA-2v37-7h3g-55p8 now treats `nanoid` `<3.3.18` as High; pin exact `nanoid: 3.3.18` (not `>=`) — `3.3.17` was the prior pin and fails SBOM.
- [2026-08-10]: pnpm `overrides` with `>=x.y.z` can jump majors (`js-yaml` 4→5, `nanoid` 3→6). Pin exact patched lines (4.3.1 / 3.3.18) for SBOM High CVEs.
- [2026-08-10]: HTTP `LIGHTDASH_TOOLS_MCP_PROFILES` is a mount allowlist (unset = all eight paths); stdio still requires `--profile` and ignores this env. Disabled paths and their RFC 9728 PRM 404.
- [2026-08-07]: content-reader verified discovery is `list_verified_content` → `GET …/content-verification`; `search_content` / OpenAPI v2 content list has no `verifiedOnly` filter — prompt preference flags must call the dedicated tool.
- [2026-08-07]: PoP on content-developer: prefer cloned metrics with `generationType: periodOverPeriod` from seeds; table calculations remain the fallback when seeds lack native PoP (Explorer “Add period comparison” UI is unavailable on MCP).
- [2026-08-06]: Pivot row share SQL is `row_total(${metric})` (aggregate), not invented `pivot_row_total` — that name does not exist; `pivot_*` are offset/index/row helpers only. Preview still accepts bad SQL helpers.
- [2026-08-06]: Content-developer `preview_chart_changes` / `confirm_preview` accept invented `tableCalculations` template `fieldId`s; copy real IDs from `get_chart_as_code` (jaffle: `orders_sum_order_amount`, not playbook-illustrative names). Profile cannot execute queries to verify calc row values.
- [2026-08-05]: MCP SDK v2 progress uses `ctx.mcpReq.notify({ method: 'notifications/progress', params })` with `mcpReq._meta.progressToken`; a top-level `sendNotification` on `ServerContext` does not exist and silently no-ops reporters that look for it.
- [2026-08-04]: MCP mounts are profile-owned `ToolModule` imports (ADR-0022). Export `defineTool` / `defineToolVariant` beside handlers; profiles import those modules; `registry.ts` is denylist + `registerTools` only — not a second catalog.
- [2026-08-04]: MCP stdio is transport-first — `lightdash-mcp stdio --profile <id>` (required); bare invoke fails closed; `http` for Streamable HTTP.
- [2026-08-04]: `AGENTS.md` Common Gotchas is capped at ≤30 lines (pointer hub + traps). Profile/ADR essays belong in `docs/adr` and `docs/profiles`; replace obsolete bullets instead of appending forever.
