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

- [2026-08-03]: MCP and CLI share `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` as the optional project ceiling. MCP has no process default (`LIGHTDASH_TOOLS_PROJECT_UUID` removed); resolve pin → tool `projectUuid` → `PROJECT_SCOPE_REQUIRED`. Removed `LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS` fails startup if set. Still ignore SAFETY_MODE/DRY_RUN on MCP.
- [2026-08-03]: ADR-0018 `ai-agent-ops` persona is thin Lightdash API wrappers only (server `lightdash-mcp-aops`). Loop engineering stays on host + CLI `agentops`; do not add offline scorers/Git dataset/`recommend_*` tools under `packages/mcp`. Prefer project `…/aiAgents` endpoints over admin list+filter. `get_agent_eval_run_results` is the shortened MCP toolName for the 60-char limit. Default MCP redaction covers `firstMessage` + nested reasoning/steers/tool I/O and eval prompt text (`includeMessageText` / `includePromptText`); `getExploreAccessSummary` is `(projectUuid, body?)` with no `agentUuid`. When combining redaction steps, never short-circuit with `||` — `redactFirstMessage() || redactMessageArray()` skips message bodies once firstMessage changes.
- [2026-08-02]: PR #162 review pass: content move lookup uses OpenAPI `uuids` (not `search`); Redis DCR enforces `maxClients` via ZSET+Lua; Redis preview PX = logical `expiresAt` + grace so `PREVIEW_EXPIRED` is distinguishable; `pinnedParameters` is create-only on dashboard update schema; `duplicate_dashboard` copies source `description` into `dashboardDesc`.
- [2026-08-02]: Promote confirmations use one-shot claims (`confirmation-claim.ts`): Redis `SET NX` + compare-and-delete token when `LIGHTDASH_TOOLS_MCP_STORE=redis`; release only on `classifyMutationFailure === 'release'`. Duplicate preview uses `resolveConcurrentLookups` so source 404 wins over target errors.
- [2026-08-02]: PR #162 Codex follow-ups: `preview_*` accepts duplicate `changes` shapes matching apply hashes; `duplicate_chart` re-reads source baseline after `getChartsAsCode`; project scope is pin or tool `projectUuid` only. Upstream validate APIs have no unsaved-payload body — `validate_*` stays saved-UUID health check. ADR-0015 requestState is HMAC-signed (not AEAD).
- [2026-08-02]: ADR-0016 pluggable ephemeral store (`packages/mcp/src/store/`): `LIGHTDASH_TOOLS_MCP_STORE=memory` (default) vs `redis` for multi-instance HTTP preview ledger / OAuth pending / session index. Content-developer apply is claim → mutate → mark applied (`claimPreviewForApply` / `markPreviewApplied` / `releaseOrReconcilePreview` + `classifyMutationFailure`); never delete-before-I/O. Double claim fails via CAS; known 4xx releases to `validated` for retry; 5xx/network → `reconciliation_required`.
- [2026-08-02]: Content-developer unlock is `confirm_preview` only. `validate_*` is saved-UUID health check (no ledger unlock). Create occupied slug → `CHART_SLUG_EXISTS`; create preview with no baseline fails `PREVIEW_STALE` if slug appears before apply (`fetchChartBaselineOptional` / `duplicate_chart` re-read). `duplicate_dashboard` omits `spaceUuid` — relocate via `move_content`. Shared `baselineFromResource` in `developer-helpers.ts`.
- [2026-08-02]: Content-developer preview gate hardening: ledger stores `resourceAliases` (uuid↔slug) and optional `baseline.updatedAt`; `contentHash` covers `{proposed,baseline}`; apply rechecks baseline → `PREVIEW_STALE`. `versionUuidA`/`versionUuidB` are UUID keys in `RESOURCE_ID_KEYS`. Validation client returns unwrapped `{ errors }` results.
- [2026-08-02]: Dashboard promote on content-governance (ADR-0017): reuse `registerElicitationGatedTool` (generalized from soft-delete) with `confirm_promote` / typed name; bind `requestState` digest to dashboard metadata **and** `PromotionChanges`; re-fetch promoteDiff on accept → `RESOURCE_CHANGED` if drifted. Ship read-only `get_dashboard_promote_diff` + elicitation-gated `promote_dashboard` only (no chart/SQL promote). Upstream is Data Ops config, not a tool arg.
- [2026-08-02]: Destructive soft-delete MRTR (ADR-0015): `@modelcontextprotocol/server@2.0.0` `SUPPORTED_PROTOCOL_VERSIONS` is 2025-only — handlers still return `inputRequired`, fulfilled by the server legacy shim via `elicitation/create`. `supportsFormElicitation` must fall back to `Server.getClientCapabilities()` when the per-request envelope lacks `CLIENT_CAPABILITIES_META_KEY`. Catalog `defineOperation` forbids `write-destructive` + `idempotentHint: true`; soft-delete sets `idempotentHint: true` only at `registerDestructiveDeleteTool` registration. Client auto-fulfill: `setRequestHandler('elicitation/create', …)` (default `inputRequired.autoFulfill: true`).
- [2026-08-02]: Persona playbooks use `definePersonaPlaybooks` in `personas/lib/playbook-resources.ts` (index + core + topics). `createPromptPlaybookEmbedder` topicId is optional (omit = core only). Content-developer: `preview_content_move` (required `contentTypes`; no `space` preview kind / MOVE type); no `create_space`/`update_space`; soft dashboard-first SOP; `confirm_preview` + bound `markPreviewValidated`.
- [2026-08-01]: Content-developer ADR-0014 handlers: `resourceKey` for chart/dashboard previews is `slug ?? uuidOrSlug ?? 'new'`; tile-op tools compute `nextTiles` then `consumeValidatedPreview` against `{ tiles: nextTiles }`. `VALIDATE_SAFETY` / `COMPARE_SAFETY` alongside `PREVIEW_SAFETY`/`WRITE_SAFETY`. `BLOCKED_POLICY_CODES` includes `PREVIEW_*`.
- [2026-08-01]: Operation catalog cutover (ADR-0013): `packages/common/src/operations/` is sole agent-surface SSOT — agent ops need **mcp and/or cli** (`sensitivity` defaults to `none`); client-only omits mcp/cli and uses `bannedMcpToolName`. MCP `registerToolsByIds` and CLI `schema` are catalog-only (no `LEGACY_SCHEMA_REGISTRY`); schema omits `mcpToolName` unless `exposed: true`. Client coverage map + `check:client-coverage` fail closed; curated types barrel is `packages/common/src/types/index.ts`.
- [2026-08-01]: Content-reader Codex P2 fixes: hold query budget (`budgetHeld`) until terminal status/cancel/TTL; pre-classify SQL charts via `search_content` `source` before `getSavedChart`; `list_project_parameters` sets envelope `complete`/`truncated` via `isPageComplete`. Rebase `--continue` can still hang on GPG (`commit -S`) — finish with `git commit --no-gpg-sign -F rebase-merge/message` then continue.
- [2026-08-01]: Content-reader ledger/budget must not use process-lifetime `getSessionId()` on multi-client HTTP — `wrapTool` sets ALS from MCP `extra.sessionId` (`getMcpClientSessionId()`); stdio uses `process:…`. Shared `get_project` is persona-gated: `content-reader` / `content-developer` get capabilities + pin/arg scope; semantic-layer stays pin-aware. Policy denials use `isError` + `_lightdashBlocked` for audit `blocked`.
- [2026-08-01]: Content-reader envelope `coverage.complete` should only be true when normalized query status is `complete` and not truncated. Using `!truncated` alone mislabels running/failed/cancelled responses as complete.
- [2026-08-01]: Content-reader persona (ADR-0012) uses server name `lightdash-mcp-content` (not `…-content-reader`) so `lightdash_list_project_parameters` stays ≤60 combined chars. SQL chart execution is off by default; project scope is HTTP pin or tool `projectUuid`.
- [2026-08-01]: npm publish is OIDC-only via Trusted Publishers: `publish.yml` uses GitHub Environment `release`, `id-token: write`, and no `NPM_TOKEN`. Workspace packages need `repository.url` = `git+https://github.com/yu-iskw/lightdash-tools.git` (plus `directory`). Trusted Publisher Environment name on npmjs.com must be `release` to match the job.
- [2026-08-01]: Changie batch was writing header-only version files because `.changie.yaml` used `format: '### {{.Label}}'` (invalid; use `kindFormat`/`changeFormat` with `{{.Kind}}`). Also convert leftover `.md` fragments with `Added`/`Changed` to `.yaml` kind keys before batch; `pnpm -r version` fails on unclean trees so bump workspace `package.json` versions directly.
- [2026-07-31]: `packages/mcp/src/stdio.process.test.ts` can fail in full-suite runs if the child process inherits `LIGHTDASH_TOOLS_MCP_STDIO_PERSONA` from ambient env/test state. Pin `LIGHTDASH_TOOLS_MCP_STDIO_PERSONA=semantic-layer` in spawned env and include stderr in early-exit errors for deterministic diagnostics.
- [2026-08-01]: MCP tool response sensitivity classes (ADR-0011): emails masked unless `includeEmail === true`; scheduler destinations redacted unless `revealDestinations === true`; `warehouseConnection`/`dbtConnection`/PATs never on MCP. No `withSensitive` — class-specific flags only. Handler-level redaction in `tools/lib/redaction.ts`, not `registerToolSafe` middleware.
- [2026-08-01]: OAuth PRM/`WWW-Authenticate` must be persona-path-aware once multiple HTTP personas ship. Pass `persona.path` into PRM builders and auth challenges; serve `/.well-known/oauth-protected-resource{persona.path}` for every `listPersonaPaths()` entry (root PRM stays default persona). Strip all persona suffixes in `normalizePublicUrl`. `dashboardUuid`/`chartUuid` need uuid-or-slug validation; `list_content` `sortBy` must match OpenAPI `ContentSortByColumns` (`name`/`space_name`/`last_updated_at`/`views`).
- [2026-07-31]: Organization-audit MCP persona ships at `/organization-audit/v1/mcp` with server name `lightdash-mcp-org-audit` (60-char limit). Stdio: `lightdash-mcp organization-audit`. 18 read-only primitives only (no `audit_*` mega-tools); playbook/prompts orchestrate. Tools live under `tools/{organization,project,space,semantic,lib}`. No unused-content API — use user-activity + content views.
- [2026-07-31]: MCP tool wire prefix renamed from `ldt__` to `lightdash_` (`TOOL_PREFIX` in `packages/mcp/src/tools/shared.ts`). Breaking for clients that hardcode tool names; combined server+longest tool stays under ~60 chars for current semantic-layer tools.
- [2026-07-31]: In this runner, `pnpm` may be missing from `PATH` until `corepack enable` is executed. Run that first, or MCP package scripts that invoke nested `pnpm` commands fail with `sh: 1: pnpm: not found`.
- [2026-07-31]: Playbook/prompt rewrite from live OAuth MCP runs on `jp-phr-dwh`: stick to user projectUuid (unpinned `list_projects` is org-wide); match explores by label **or** `name` `__{table}` (humanized labels); `_itm_*` often has zero explores; prefer explore-local metrics; `unknown field id` from short names; summarize huge `get_metric`/lineage.
- [2026-07-31]: Semantic-layer multi-insight on large explores (e.g. `medico_session_summary`): `list_metrics` by table/explore id → often empty; by `medico` → hundreds of wrong tables. After filter `tableName === exploreId` is empty, use `get_explore` → `tables[baseTable].metrics` only. Playbook covers dimension shortlists + multi-insight cuts (trend/funnel/NPS/outcome/acquisition).
- [2026-07-31]: Local hosted-OAuth smoke uses Cloudflare Tunnel (`cloudflared` → `:3100`, `PUBLIC_URL` in `.env` as `*.trycloudflare.com`), not free ngrok. Free ngrok interstitial breaks Cursor post-callback Mozilla PRM/AS GETs (`You are about…`); process still warns on `*.ngrok-free.app`.
- [2026-07-31]: ngrok Free + Cursor OAuth: authorize/callback can succeed, then post-callback Mozilla GET to well-known hits interstitial (`You are about…`) so token exchange never runs. Use Cloudflare Tunnel (or paid non-interstitial edge); CORS/PKCE fixes are necessary but insufficient on free ngrok.
- [2026-07-31]: OAuth broker must reflect CORS on public AS/discovery routes independently of MCP `ALLOWED_ORIGINS`; Cursor completes authorize/callback then token-exchanges from `http://localhost:8787`. Also validate redirect/PKCE before consuming the authorization code.
- [2026-07-31]: Removed `LIGHTDASH_TOOLS_MCP_INSECURE_DEV`. Local unauthenticated HTTP is gated only by `NODE_ENV !== 'production'` (Compose sets `development`). Obsolete var is rejected at startup like `DANGEROUSLY_*`.
- [2026-07-31]: MCP src layout: `auth/{providers,resource-server,oauth-broker}`, `server/` (core), `governance/project-pin.ts`. Entrypoints stay at `src/{bin,index,http}.ts`. `server/version.ts` loads `../../package.json`.
- [2026-07-30]: MCP `src` tidy: deleted package-level `prompts/`/`resources/`/`completion/`/`tasks/`/`tools/ai-agents/`/`utils/`; runtime config is `config/runtime.ts`; audit helpers live under `audit/`. Persona owns prompts/resources.
- [2026-07-30]: Semantic-layer Compose HTTP uses `NODE_ENV=development` + PAT from `.env` (`docker compose -f docker-compose.dev.yml --profile semantic-layer up`). Cursor is `url: http://localhost:8080/semantic-layer/v1/mcp` only — no OAuth client secret in client config.
- [2026-02-05]: Initial setup of the comprehensive skills reference and self-improvement guidelines.
- [2026-02-21]: When Trunk cannot be installed (e.g., `curl https://get.trunk.io` returns 403 in restricted environments), fall back to standalone formatters already available in `package.json`: `pnpm lint:eslint` for linting, `pnpm format:eslint` for ESLint auto-fix, and `pnpm format:prettier` for Prettier formatting. These bypass Trunk entirely and are sufficient for CI/CD environments where Trunk binary download is blocked.
- [2026-02-21]: Lightdash paginated list endpoints return a wrapper shape — `{ results: { data: { <key>: T[] }, pagination? }, status: 'ok' }` — not a bare array. Always check the `ApiXxxListResponse` type in the generated OpenAPI file before writing the client method, then extract the inner array (e.g. `response.results.data.runs`). Missed this initially; caught by PR review.
- [2026-02-21]: When adding a new type from the OpenAPI-generated schema to `packages/common`, it must be exported from three layers in sequence: (1) `types/v1/ai-agents.ts` namespace, (2) both namespace and flat exports in `types/v1/lightdash-api.ts`, (3) flat export block in `types/lightdash-api.ts`. Missing any layer causes "not exported" build errors in `packages/client` or `packages/mcp`.
- [2026-02-21]: CLI flags that control org-wide boolean settings must validate inputs explicitly. `value === 'true'` silently coerces any non-`'true'` string (including typos like `True`) to `false`, which can silently disable org-wide features. Instead, check `value !== 'true' && value !== 'false'` and exit with a descriptive error.
- [2026-02-21]: MCP guardrail layer order (from `registerToolSafe`): safety-mode filter (static, skips registration) → safety-mode block (runtime) → dry-run simulation → project-allowlist check → audit wrapper (outermost). New guardrails must be inserted before the audit layer. The `_lightdashBlocked: true` marker signals a blocked result between inner layers and is stripped by the audit wrapper before the response reaches the MCP client.
- [2026-02-21]: Every CLI action must be wrapped with `wrapAction(annotations, fn)` (from `packages/cli/src/utils/safety.ts`) and every MCP tool with `registerToolSafe()`. Bypassing these means the call is not safety-checked or audit-logged. `initAuditLog()` must be called once in any new process entrypoint.
- [2026-03-06]: All project-specific env vars use `LIGHTDASH_TOOLS_` prefix: `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`, `LIGHTDASH_TOOLS_DRY_RUN`, `LIGHTDASH_TOOLS_AUDIT_LOG`, `LIGHTDASH_TOOLS_SAFETY_MODE`. See ADR-0035.
- [2026-02-27]: Shortened the MCP tool naming prefix from `lightdash_tools__` to `ldt__` to satisfy the 60-character limit imposed by some clients (e.g., Claude Desktop). Bumped package versions to `0.4.0` across the monorepo to reflect these changes.
- [2026-06-12]: ADR-0037 agent-safe surface: irrecoverable ops (e.g. `delete_member`) are `client-only` in `packages/common/src/operations/` and must not be MCP/CLI tools; reversible destructive ops keep `WRITE_DESTRUCTIVE` + safety-mode guardrails.
- [2026-07-29]: MCP stdio process smoke tests cannot use `import.meta` (`packages/mcp` tsc is CommonJS). Use `process.cwd()` for `packages/mcp/dist/bin.js`. Dummy `LIGHTDASH_URL` + `LIGHTDASH_API_KEY` are required at startup; API calls are deferred until tool execution.
- [2026-07-29]: MCP SDK v2 migration (ADR-0041): replace `@modelcontextprotocol/sdk` with exact `@modelcontextprotocol/server@2.0.0` + `@modelcontextprotocol/node@2.0.0` (`hono` peer). Keep `server.connect(StdioServerTransport)` and `NodeStreamableHTTPServerTransport`; do not enable `serveStdio`/`createMcpHandler` without an explicit protocol-era decision.
- [2026-07-30]: Knip 6.29 reports unused re-exports from intermediate barrels that 6.16 did not. When upgrading knip, delete unused barrel re-exports (keep imports used in-file) rather than expanding `ignoreIssues` unless the barrel is intentional public API. Also ignore `.cursor/` in `.prettierignore` so local Cursor MCP config does not fail `prettier --check`.
- [2026-07-30]: After bumping `config/lightdash-openapi-ref.txt` and regenerating types, `AuthenticatedUser` gained required `avatarUrl` / `avatarGradient`. Update `satisfies AuthenticatedUser` fixtures (e.g. MCP OAuth contract test) before `pnpm build` will pass.
- [2026-07-30]: MCP personas (ADR-0042): shared `tools/registry.ts` + `personas/semantic-layer` (fixed `/semantic-layer/v1/mcp`, nine `ldt__*` tools). `@lightdash-tools/semantic-layer-mcp` is a deprecated shim. Docker/Compose use `packages/mcp/Dockerfile`; Cursor URL is `…/semantic-layer/v1/mcp`.
- [2026-07-30]: `@lightdash-tools/semantic-layer-mcp` project pin is HTTP-only (`X-Lightdash-Project` → `governance.pinnedProjectUuid`). Removed unused `LIGHTDASH_TOOLS_PINNED_PROJECT` / `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` and `--pin-project` / `--projects` from this package (monolith `packages/mcp` keep allowlist).
- [2026-07-30]: Semantic-layer MCP stdio Docker image: build from repo root with `-f packages/semantic-layer-mcp/Dockerfile`; root `.dockerignore` symlinks to the package ignore file. Use `pnpm deploy --prod --legacy`. Cursor wires `envFile` + `docker run -i --rm -e LIGHTDASH_URL -e LIGHTDASH_API_KEY` (no values).
- [2026-07-30]: `@lightdash-tools/semantic-layer-mcp` MVP tools use thin `registerTool` (unprefixed names, no `registerToolSafe`/`ldt__`). Surface: projects, explores, metrics, `compile_query` only — playbook must list exactly those tools.
- [2026-07-30]: Semantic-layer MCP `compile_query` field IDs are `{table}_{name}` (from `list_dimensions.fieldId`). `list_explores` returns summaries with client-side `search`/`limit`; warehouse table names are search hints, not explore IDs.
- [2026-07-30]: Removed `@lightdash-tools/semantic-layer-mcp` (never published). Use `@lightdash-tools/mcp` only (`lightdash-mcp`, path `/semantic-layer/v1/mcp`).
