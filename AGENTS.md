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

- Use `pnpm` only (do not use `npm` or `yarn`).
- **Trunk via devDependency:** `@trunkio/launcher` provides the local `trunk` CLI (`pnpm exec trunk`). Run `pnpm trunk:install` after `pnpm install` to fetch Trunk-managed linters. No global Trunk install required.
- Keep `pnpm-lock.yaml` committed for reproducible installs.
- **pnpm v11 config location:** `overrides` and other pnpm settings live in `pnpm-workspace.yaml`, not `package.json#pnpm`. The repo pins `packageManager` to `pnpm@11.5.3`.
- **npm publish uses OIDC Trusted Publishers:** [`.github/workflows/publish.yml`](.github/workflows/publish.yml) publishes with `id-token: write` under GitHub Environment `release` — no `NPM_TOKEN` / `NODE_AUTH_TOKEN`. Each `@lightdash-tools/*` package must have Trusted Publisher on npmjs.com for `yu-iskw` / `lightdash-tools` / workflow `publish.yml` / environment `release`, plus matching `repository.url` in `package.json`. After the first successful OIDC publish, delete the repo `NPM_TOKEN` secret (if still present), revoke the npm automation token, and set package Publishing access to require 2FA / disallow tokens.
- **Build before ESLint:** Workspace packages resolve via `dist/` entrypoints. `verify:pr` and `verify:quick` run `pnpm build` first so `import-x/no-unresolved` does not false-negative.
- ADR and Changie are initialized (`docs/adr`, `.changie.yaml`); use the `manage-adr` and `manage-changelog` skills when `adr-tools` and `changie` are available.
- **Changie kind templates use `{{.Kind}}`, not `{{.Label}}`:** Per-kind `format: '### {{.Label}}'` fails at batch time (often silently → version file is header-only). Use global `kindFormat: '### {{.Kind}}'` + `changeFormat: '* {{.Body}}'`. Fragments must be `.yaml` with kind **keys** (`feat`/`fix`/…), not Keep-a-Changelog labels (`Added`/`Changed`). Dry-run `changie batch <ver> --dry-run` and confirm bodies before `--force`/merge. Version files use empty `versionExt` (e.g. `.changes/0.7.0.`).
- **`pnpm -r version` needs a clean git tree:** If the working tree is dirty, root `pnpm version X --no-git-tag-version` may succeed while recursive bumps fail with `ERR_PNPM_UNCLEAN_WORKING_TREE`. Set each `packages/*/package.json` `"version"` directly (or stash first), then `pnpm install`.
- **Trunk unavailable (restricted network):** If `curl https://get.trunk.io` returns 403, use these direct fallbacks instead of Trunk commands:
  - Lint: `pnpm lint:eslint`
  - Format: `pnpm format:eslint` (ESLint auto-fix) and `pnpm format:prettier` (Prettier)
  - These skip Trunk entirely but cover the essential formatting and linting checks.
- **OpenAPI paginated responses are always wrapped:** Lightdash list endpoints return `{ results: { data: { <key>: T[] }, pagination? }, status: 'ok' }`, not a bare array. Always check the `ApiXxxListResponse` schema in `packages/common/src/types/generated/openapi-types.ts` before assuming the shape. Extract the inner array (e.g. `response.results.data.runs`) after fetching.
- **New common types use the curated types barrel:** Alias OpenAPI schemas under `packages/common/src/types/v1/` or `types/v2/`, then export through `types/lightdash-api.ts` (still the consolidation point) which is re-exported by `types/index.ts` → package root. Import consumer types only from `@lightdash-tools/common`. Generated `openapi-types.ts` stays pinned via `config/lightdash-openapi-ref.txt`.
- **Operation catalog is the sole agent-surface SSOT (ADR-0013):** Every MCP persona tool id and CLI `schema` resource must exist in `packages/common/src/operations/`. Agent ops require **at least one** of `mcp` or `cli` (`sensitivity` defaults to `none`); client-only ops omit mcp/cli and may set `bannedMcpToolName`. Schema only advertises `mcpToolName` when `mcp.taskSupport.exposed === true`. `registerToolsByIds` and `pnpm --filter @lightdash-tools/common check:client-coverage` fail closed on drift. No `LEGACY_SCHEMA_REGISTRY`.
- **Validate org-wide CLI flags explicitly:** Boolean CLI flags that affect organization-wide settings (e.g. `--ai-agents-visible`) must validate against the exact allowed literals (`'true'`/`'false'`) and `process.exit(1)` on invalid input. Never silently coerce via `value === 'true'` — typos like `True` or `yes` would silently disable features.
- **Agent-safe surface (ADR-0004):** Irrecoverable operations (e.g. `delete_member`) must not be exposed on MCP or CLI — register them as `agentExposure: 'client-only'` in `packages/common/src/operations/` and use `@lightdash-tools/client` for admin scripts. Reversible destructive ops (delete group, revoke access) may stay on both surfaces with `WRITE_DESTRUCTIVE` and existing guardrails.
- **MCP tools must use `registerToolSafe()`:** Every MCP tool registration must go through `registerToolSafe()` in `packages/mcp/src/tools/shared.ts`, never the raw `server.registerTool()`. Guardrails (ADR-0008): audit (outer) → available projects → HTTP project pin → input validation → handler. Capability surface is persona `toolIds` (ADR-0006), not process safety mode.
- **MCP upstream tool errors are coded:** Uncaught Lightdash client failures from `wrapTool` become `{ error: { code, message } }` with `isError: true` (`UPSTREAM_*` / `RATE_LIMITED` via `classifyUpstreamError`). Not protocol errors; not `_lightdashBlocked`.
- **CLI actions must use `wrapAction()`:** Every CLI command's `.action()` callback must be wrapped with `wrapAction(annotations, fn)` from `packages/cli/src/utils/safety.ts`. This enforces safety-mode and records audit log entries for every invocation.
- **Input validation applies only to known identifier keys:** `validateResourceIdsInObject()` walks `RESOURCE_ID_KEYS` (`projectUuid`, `slug`, `dashboardUuid`, etc.). Most keys are UUID-only; `slug` uses slug rules; `dashboardUuid`/`chartUuid` accept OpenAPI UuidOrSlug via `validateUuidOrSlug`. Free-form positionals (query, name, resource) are not walked. When adding a new identifier option, include its key (and uuid-or-slug exception if needed) in `packages/common/src/argument-validation.ts` / CLI `safety.ts`. See [ADR-0008](docs/adr/0008-mcp-request-scope-and-hardening.md).
- **`_lightdashBlocked` marker convention:** Guardrail layers (project-pin denial, input-validation failure; CLI still uses safety-mode / dry-run / allowlist) return `{ ..., _lightdashBlocked: true }`. The audit wrapper reads this flag to set `status = 'blocked'`, then strips it before returning to the MCP client. Do not return this marker from real tool handlers.
- **Tool args may use singular or plural project UUID shapes:** `extractProjectUuids()` in `shared.ts` handles both `projectUuid: string` and `projectUuids: string[]`. When writing project-allowlist or audit logic, always use this helper instead of reading `args.projectUuid` directly.
- **Env vars use LIGHTDASH_TOOLS\_ prefix:** Project-specific vars use this prefix to distinguish from official Lightdash vars (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`). CLI uses `LIGHTDASH_TOOLS_SAFETY_MODE`, `LIGHTDASH_TOOLS_DRY_RUN`, and shared `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`; MCP uses persona + pin + the same optional `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` ceiling (no process safety-mode / dry-run). `LIGHTDASH_TOOLS_AUDIT_LOG` is an optional **file** sink (CLI/local); unset writes pure JSON audit lines to stderr (`channel: "audit"`) for Cloud Logging on Cloud Run — do not set a container file path in production. See [ADR-0009](docs/adr/0009-cross-cutting-conventions.md) and [cloud-run.md](docs/operators/cloud-run.md).
- **Shared project allowlist (CLI + MCP):** `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` is a comma-separated UUID ceiling (unset/empty = unrestricted). MCP has no project default — clients set `X-Lightdash-Project` or pass tool `projectUuid`. Removed `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` and `LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS` fail closed if still set.
- **Secrets:** Use env vars from the parent process. Do not recommend plaintext `.env` to users; if they use file-based config, recommend dotenvx. See [docs/operators/secrets.md](docs/operators/secrets.md).
- **`initAuditLog()` must be called once at process startup:** Both `packages/cli/src/index.ts` and MCP's `bin.ts` call `initAuditLog()` at startup. Any new entrypoint must do the same; individual command files do not need to call it.
- **MCP tool names must be concise:** Some MCP clients (e.g., Claude Desktop) impose a 60-character limit on combined server and tool names. Use the `lightdash_` prefix (set in `packages/mcp/src/tools/shared.ts`). With server name `lightdash-mcp-semantic-layer`, the longest shipped tool (`lightdash_get_field_lineage`) is 53 combined chars — keep new tool ids short enough to stay under 60.
- **Knip ignores intentional type barrels:** `knip.json` uses `ignoreIssues` for `packages/common/src/types/**` because namespace re-exports are public API surface, not dead code. Do not remove those ignores when knip reports unused namespace members in type files.
- **Knip 6.29+ flags unused barrel re-exports:** Intermediate `index.ts` barrels that re-export symbols only imported from their defining modules will fail `pnpm knip`. Prefer deleting unused re-exports over broad `ignoreIssues` unless the barrel is intentional public API.
- **`pnpm audit` can be registry-blocked in this environment:** The npm audit endpoint may return HTTP 403 (`ERR_PNPM_AUDIT_BAD_RESPONSE`), so a failing audit command can be an infrastructure limitation rather than package vulnerability output. Run upgrades/checks (`pnpm outdated -r`, targeted `pnpm up -r ...`) and report audit as a warning when this happens.
- **MCP SDK v2 + OAuth broker (ADR-0007):** Pin `@modelcontextprotocol/server@2.0.0` / `@modelcontextprotocol/node@2.0.0`. **Stdio:** `serveStdio(factory, { legacy: 'serve' })` — hand-`connect(StdioServerTransport)` stays 2025-era only. **HTTP:** `createMcpHandler(factory, { legacy: 'stateless' })` + `toNodeHandler` (auth/Origin/PRM in front). Hosted HTTP auth is credential-inferred: `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID` + `_SECRET` + `PUBLIC_URL` → OAuth broker (server-held confidential client, shared `{PUBLIC_URL}/oauth/callback`, PRM `authorization_servers` = public MCP host). Clients use URL-only config. Obsolete `AUTH_MODE` / `EXPERIMENTAL_*` / `DANGEROUSLY_*` / `INSECURE_DEV` are rejected. PAT + `NODE_ENV=development` remain secondary for stdio/local. Auth protocol docs: [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
- **MCP src namespaces (OAuth seams):** `auth/oauth-broker/` (co-located AS), `auth/resource-server/` (Bearer/PRM/WWW-Authenticate/shared-key), `auth/providers/` (env/bearer context), `server/` (server/capabilities/request-context/errors/version), `governance/project-pin.ts` (HTTP `X-Lightdash-Project` ALS). Persona implementation lives under `personas/semantic-layer/v1/`. Entrypoints stay at `src/{bin,index,http}.ts`. No package-level auth barrels.
- **Local OAuth public URL = Cloudflare Tunnel:** For Cursor hosted-OAuth smoke, run `cloudflared tunnel --url http://127.0.0.1:3100`, set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in `.env` to the printed `https://*.trycloudflare.com` host (not hard-coded in Compose), recreate the mcp container, register `{PUBLIC_URL}/oauth/callback` in Lightdash, and point Cursor at `{PUBLIC_URL}/semantic-layer/v1/mcp`. Free ngrok interstitials break Cursor’s post-callback Mozilla GET to PRM/AS (`Unexpected token 'Y', "You are ab"...`); the process still warns if `PUBLIC_URL` is `*.ngrok-free.app`.
- **OAuth broker CORS ≠ MCP Origin allowlist:** Empty `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` still blocks Origin reflection on persona MCP routes, but `/oauth/*` and discovery reflect any `Origin` via `buildCorsHeaders(origin, [], true)` (allowlist ignored on those paths) so Cursor’s loopback token exchange (`http://localhost:8787`) can read JSON. Validate redirect/PKCE before consuming the code so bad probes do not burn one-time codes.
- **MCP package tests are CommonJS under `tsc`:** `packages/mcp/tsconfig.json` uses `"module": "commonjs"` and compiles `*.test.ts` into `dist/`. Do not use `import.meta` in MCP tests — it fails `pnpm --filter @lightdash-tools/mcp build`. Resolve the repo root with `process.cwd()` (Vitest runs from the monorepo root).
- **MCP Streamable HTTP is stateless (ADR-0019):** Served via process-lifetime `createMcpHandler` + `toNodeHandler` (`legacy: 'stateless'`) — do not recreate the handler per POST. Per-request `contextProvider`/`persona` enter the factory through `runWithMcpPostFactoryAsync` (`governance/mcp-post-factory-context.ts`). No `SessionStore` / Redis. `LIGHTDASH_TOOLS_MCP_STORE` and `LIGHTDASH_TOOLS_MCP_REDIS_URL` are OBSOLETE_ENV_VARS (fail closed). GET/DELETE on persona paths return 405. Each POST carries exactly one JSON-RPC message. **Form elicitation caps:** read from per-request `_meta[CLIENT_CAPABILITIES_META_KEY]` (no process-local initialize cache). Multi-replica content-governance must send envelope caps on each gated `tools/call`. OAuth broker stays in-memory — sticky `/oauth/*` or single replica.
- **Stdio MCP smoke env:** `EnvContextProvider` calls `getClient()` at construct time, so `LIGHTDASH_URL` and `LIGHTDASH_API_KEY` must be set before the process starts. Dummy values are enough for initialize/tools/list; the Lightdash API is only hit on tool execution.
- **Stdio smoke tests should pin persona env explicitly:** `stdio.process.test.ts` can fail in full-suite runs if it inherits `LIGHTDASH_TOOLS_MCP_STDIO_PERSONA` from outer env/test state. Set `LIGHTDASH_TOOLS_MCP_STDIO_PERSONA=semantic-layer` in the spawned child env (and capture stderr) to keep the process smoke deterministic.
- **OpenAPI pin lives in `config/lightdash-openapi-ref.txt`:** `generate:types` fetches swagger from that commit SHA (not floating `main`). Bump the pin, regenerate, then fix breakages — never hand-edit `openapi-types.ts`.
- **`LightdashUser` / `AuthenticatedUser` avatar fields:** Upstream now requires `avatarUrl` and `avatarGradient` (`string | null`). Fixtures using `satisfies AuthenticatedUser` must include both after an OpenAPI sync.
- **MCP personas + shared tool registry (ADR-0006 / ADR-0008):** Shared tools live under `packages/mcp/src/tools/` (`registry.ts` plus scope folders `organization/`, `project/`, `space/`, `semantic/`, `query/`, `composition/`, and `lib/` helpers); personas under `packages/mcp/src/personas/<id>/v1/` own `toolIds`, prompts, playbooks, and a fixed HTTP `path`. Shipped personas: `semantic-layer` (`/semantic-layer/v1/mcp`), `organization-audit` (`/organization-audit/v1/mcp`, server name `lightdash-mcp-org-audit`), `content-reader` (`/content-reader/v1/mcp`, server name `lightdash-mcp-content`), `content-developer` (`/content-developer/v1/mcp`, server name `lightdash-mcp-cdev`), `content-governance` (`/content-governance/v1/mcp`, server name `lightdash-mcp-gov`), and `ai-agent-ops` (`/ai-agent-ops/v1/mcp`, server name `lightdash-mcp-aops`). Stdio: `lightdash-mcp` / `semantic-layer` default to semantic-layer; `lightdash-mcp organization-audit` / `content-reader` / `content-developer` / `content-governance` / `ai-agent-ops` select those personas. No process safety-mode / allowlist / dry-run on MCP. No free-form `LIGHTDASH_TOOLS_MCP_PATH`. OAuth PRM and `WWW-Authenticate` are persona-path-aware: path-specific metadata is at `/.well-known/oauth-protected-resource{persona.path}`; root PRM uses the default persona. `normalizePublicUrl` strips any shipped persona suffix from `PUBLIC_URL`.
- **Organization-audit persona (ADR-0010):** Read-only primitives only (18 `lightdash_*` tools); multi-step audits via prompts/playbook, not composed `audit_*` tools. Prefer v2 for content/roles/validation; v1 for members/groups/projects/direct access/user-activity/schedulers list. No unused-content endpoint — use `get_project_user_activity` + content views. Space access is composed from space list/get. Scheduler destinations redacted by default. Findings are review signals, not compliance certifications. Endpoint map: [docs/personas/organization-audit/inventory.md](docs/personas/organization-audit/inventory.md).
- **Content-reader persona (ADR-0012):** Project-scoped saved-content discovery and bounded execution (14 tools). Project precedence: `X-Lightdash-Project` → tool `projectUuid` → `PROJECT_SCOPE_REQUIRED` (shared `get_project` is pin-aware for semantic-layer; optional ceiling `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`). Semantic `run_chart` / `run_dashboard_tile` only; SQL charts return `CONTENT_NOT_EXECUTABLE` by default. `export_chart_image` returns one PNG snapshot (MCP ImageContent; headless browser required; not CSV/bulk download). Query `queryUuid` is the client-carried handle (ledger best-effort per process). Concurrency budgets prefer auth `subject`; anonymous/stdio fall back to `getMcpClientSessionId()` / `process:{getSessionId()}`. Execution tools use `SAVED_EXECUTION_ANNOTATIONS` (`readOnlyHint: true`, `idempotentHint: false`). Endpoint map: [docs/personas/content-reader/inventory.md](docs/personas/content-reader/inventory.md).
- **Content-developer persona (ADR-0014):** Project-scoped authoring (26 tools). Hybrid APIs: charts via as-code upsert; dashboards via native create/v2 PATCH/`duplicateFrom`; tiles via full-dashboard PATCH composition; bulk `move_content` into **existing** spaces (`list_spaces`/`get_space`/`preview_content_move` only — no `create_space`/`update_space`; spaces are Terraform/out-of-band). Soft dashboard-shell-first SOP: create dashboard first, then charts with `dashboardSlug` as tile prerequisites (promote via content-governance at dashboard level). Hard preview gate (ADR-0019): SAFE_WRITE requires HMAC-signed validated `previewToken` whose `contentHash` matches `{proposed,baseline}`; confirm remints validated token; apply re-sends proposed (no server ledger). HTTP startup requires `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` (≥32 bytes) or the persona fails closed. Authoring SOP: create dashboard shell first, then charts with `dashboardSlug` (official as-code dashboard scope); clone via `get_chart_as_code` — never invent fieldIds or skinny cartesian (`series` without `encode.xRef`/`yRef`; bar/line/area/scatter are series under `chartConfig.type: cartesian`). Playbook topic `chart-types` + prompt `author_chart`. `create_chart` needs top-level `slug` and `chart.slug`; create-dashboard `resourceKey` is literal `new`; charts use `spaceSlug`/`skipSpaceCreate` + `dashboardSlug`, dashboards use `spaceUuid`; `validate_*` is schema/health only (not UI-render proof; no `run_chart` on this persona). Chart/dashboard updates store UUID as canonical `resourceKey` with slug aliases, capture `updatedAt` baseline, and recheck it at apply (`PREVIEW_STALE` on drift). Every write unlocks via `confirm_preview` with bound `resourceKind`/`resourceKey` (`chart`/`dashboard`/`content-move` only); `validate_*` is an optional saved-UUID health check and does not mark the ledger. Create chart previews that supply only an occupied `slug` return `CHART_SLUG_EXISTS`; create previews store no baseline and fail as `PREVIEW_STALE` if the slug appears before apply. `duplicate_dashboard` has no `spaceUuid` (OpenAPI duplicateFrom body is name/desc only) — relocate with `move_content`. Duplicate previews use dedicated `changes` shapes (`{ sourceChartUuidOrSlug, newSlug, newName? }` / `{ newName? }`) hashed identically at apply; `duplicate_chart` re-reads the source baseline after `getChartsAsCode` to reject mid-read drift. Persona playbooks use `definePersonaPlaybooks` (`lightdash://playbooks/<persona>/<topic>` + `core`; prompts embed core, optional topic). No warehouse execution, SQL authoring, hard delete, or promote on this persona in v1. Endpoint map: [docs/personas/content-developer/inventory.md](docs/personas/content-developer/inventory.md).
- **Content-governance persona (ADR-0015 / ADR-0017):** Soft-delete (`delete_chart` / `delete_dashboard`) and dashboard promote (`get_dashboard_promote_diff` + elicitation-gated `promote_dashboard`) via form elicitation + signed `requestState` (`LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY`, ≥32 bytes in production; HMAC-signed opaque token per ADR-0015 — not AEAD). Project scope is pin or tool `projectUuid` only (same as other personas; optional `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` ceiling). Framework under `packages/mcp/src/destructive/` (`registerElicitationGatedTool`). Handlers return SDK `inputRequired` / `inputRequired.elicit`; on `@modelcontextprotocol/server@2.0.0` (2025-era), the legacy shim uses `elicitation/create` (clients: `setRequestHandler('elicitation/create')`). Form capability: prefer per-request `CLIENT_CAPABILITIES_META_KEY`, else initialize caps. Missing form support → `ELICITATION_REQUIRED` (no DELETE/POST promote). Promote binds digest of dashboard metadata + `PromotionChanges`; chart/SQL-chart promote stay off MCP. Catalog keeps `WRITE_DESTRUCTIVE` without `idempotentHint: true`; registration sets `idempotentHint: true` for soft-delete retries only. Permanent purge / space delete / bulk delete stay off MCP. Inventory: [docs/personas/content-governance/inventory.md](docs/personas/content-governance/inventory.md); client matrix: [docs/personas/content-governance/client-compatibility.md](docs/personas/content-governance/client-compatibility.md).
- **AI agent-ops persona (ADR-0018):** Thin project-scoped Lightdash AI-agent APIs only (17 tools). Inventory + readiness/suggestions/models/explore-access + thread reads + evaluation suite CRUD/run/results. No offline scorers, Git dataset tools, `analyze_*`/`recommend_*`, agent CRUD, or thread generate on MCP. Loop engineering is distributed: MCP playbooks + host synthesis + CLI `agentops` (bundles/gates). Server name `lightdash-mcp-aops`; path `/ai-agent-ops/v1/mcp`. Project scope like content-reader. Inventory: [docs/personas/ai-agent-ops/inventory.md](docs/personas/ai-agent-ops/inventory.md); loop: [docs/personas/ai-agent-ops/loop.md](docs/personas/ai-agent-ops/loop.md).
- **Content-reader coverage semantics:** `coverage.complete` must be `true` only when query status is `complete` and results are not truncated. Do not derive completeness from truncation alone, or `QUERY_RUNNING`/failed/cancelled responses can be mislabeled as complete.
- **MCP tool response sensitivity (ADR-0011):** Handler-level redaction — emails masked unless `includeEmail === true`; scheduler destinations stripped unless `revealDestinations === true`; `warehouseConnection` / `dbtConnection` / PATs never on MCP (use `@lightdash-tools/client` or CLI). No global `withSensitive` flag; class-specific opt-in only. `allowedEmailDomains` classifies external emails on redacted fields.
- **AI agent-ops persona (ADR-0018):** Thin Lightdash API wrappers only (`lightdash-mcp-aops`, path `/ai-agent-ops/v1/mcp`). Conversation/eval prompt text uses handler redaction (`includeMessageText` / `includePromptText`) — also redact nested `reasoning` / `steers` / `toolCalls.toolArgs` / `toolResults.result` / `firstMessage`, not just top-level `message`. `get_explore_access_summary` is project-scoped (`POST …/aiAgents/explore-access-summary`); do not require or forward `agentUuid`. Promotion gates stay on CLI `agentops evaluate-gate`. Catalog `SensitivityClass` has no conversation enum — privacy is handler-level.
- **Semantic-layer MCP UX:** Prompts (`lightdash_semantic_explore`, `lightdash_semantic_compose_compile`, `lightdash_semantic_compile_debug`) + playbook `lightdash://playbooks/semantic-layer` cite `lightdash_*` names. Without HTTP pin, `list_projects` may return the whole org — always pass the user project UUID (≠ warehouse cloud project; match inventory to explore `databaseName`/`schemaName`). `list_explores` needs `search`/`limit`; match warehouse tables by exact `label` **or** explore `name` containing `__{table}` (labels can be humanized); skip empty `schemaName`; some inventory tables have no explore. Prefer `get_explore` → `tables[baseTable].metrics` once the explore is known (`list_metrics` is org catalog — filter `tableName === exploreId`; table tokens often zero). Shortlist dimensions by role (time/channel/segment); ignore join tables and nested event paths. Compile with full `fieldId`s — short names → `unknown field id` / empty SELECT; SQL may add related metrics. Multi-insight: one explore, diverse cuts. Optional pin via `X-Lightdash-Project` → `governance.pinnedProjectUuid`.
- **MCP Docker / Compose:** Build from repo root: `docker build -f packages/mcp/Dockerfile -t lightdash-mcp:local .`. Root `.dockerignore` → `packages/mcp/.dockerignore`. Compose: `docker compose -f docker-compose.dev.yml --profile semantic-layer up --build`. PAT/local: Cursor `url: http://localhost:8080/semantic-layer/v1/mcp`. Hosted OAuth: Cloudflare Tunnel on `:3100` + `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in `.env` (see [docs/operators/cursor-claude.md](docs/operators/cursor-claude.md)).
- **Enable Corepack when `pnpm` is missing:** Some runners do not expose `pnpm` on `PATH` initially (`pnpm: command not found`). Run `corepack enable` once before repository commands/tests so package scripts that shell out to `pnpm` work correctly.
- **Package-level `test:fast` is not universal:** `pnpm --filter <pkg> test:fast` can fail with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` because some workspaces only define `test` (or no package-local test script). For targeted test files, run root `pnpm exec vitest run <files...>` instead of assuming `test:fast` exists per package.

## Learned User Preferences

- Prefer simple, minimal implementations; avoid over-engineering when a shared helper or targeted fix suffices.
- Keep root `package.json` lint and format on Trunk (`pnpm exec trunk`); do not replace with Vite+ `vp check` without explicit approval.
- When implementing from an attached plan file, do not edit the plan file itself.
- Use pnpm for local MCP testing workflows (including MCP Inspector); do not substitute npm or yarn.
- Wrap agent-shell `git commit` and `git push` with `timeout 10` so GPG/pinentry or hook stalls fail fast instead of hanging the session.
- For agent-driven commits when `commit.gpgsign=true`, use `--no-gpg-sign` or an interactive terminal with pinentry; `--no-verify` skips hooks only, not GPG signing.

## Learned Workspace Facts

- OpenSpec and gh-\* GitHub agent skills were removed; project-management is changelog and ADR only.
- MCP `structuredContent` must be a JSON object; `toStructuredContent()` in `packages/mcp/src/tools/shared.ts` wraps non-objects (including arrays) as `{ data: ... }`.
- `pnpm-workspace.yaml` maintains supply-chain mitigations for global pnpm policies: `semver: '>=7.8.4'` override, expanded `minimumReleaseAgeExclude`, and `vite: 8.1.5` pin.
- `getUserAgentPreferences` returns `null` when the API responds with `ApiSuccessEmpty` (user has no saved preferences).
- The openapi-drift CI workflow uses `scripts/generate-cli-docs.mjs` to regenerate CLI documentation.
- With `commit.gpgsign=true`, non-interactive agent shells block on GPG pinentry after Trunk pre-commit passes; the hang is signing, not the hook.
- **Rebase + GPG:** `git rebase --continue` may still invoke `git commit -S` (from `rebase-merge/gpg_sign_opt` or `commit.gpgsign`) and hang on pinentry even with `-c commit.gpgsign=false`. Finish with `git commit --no-gpg-sign --no-edit -F "$(git rev-parse --git-path rebase-merge)/message"`, then `git rebase --continue`.
- Operation registry generator requires non-empty `mcp.toolName` and/or `cli.commandPath` for `agentExposure: 'agent'`; `client-only` ops document banned MCP names but omit MCP/CLI metadata.
- Per ADR-0004, irrecoverable ops such as `delete_member` stay off MCP and CLI; use `@lightdash-tools/client` directly for `users.members.delete`.
- **Slim ADRs:** Binding decisions live under [`docs/adr`](docs/adr) (currently 0001–0019); see the old→new mapping in [`docs/adr/README.md`](docs/adr/README.md).
- **Content-developer preview tokens (ADR-0014 / ADR-0019):** `packages/mcp/src/policy/preview-ledger.ts` mints HMAC-signed opaque `previewToken`s (`createRequestStateCodec`, same key as destructive `requestState`). Tokens carry subject, project, resource bindings, and `contentHash` of `{proposed,baseline}` — not the proposed body. `confirm_preview` returns a validated token (no server write). Apply verifies token + re-sends proposed (hash match) + baseline re-check → `PREVIEW_STALE` on drift. No server ledger / Redis / CAS. Bind subject from auth (`PREVIEW_NOT_OWNED` on mismatch). Resolve move manifests with content `uuids` (exact), not `search: uuid`. `PreviewLedgerError` reports via `code` — assert `err.code`, not `toThrow(/CODE/)`.
- **OAuth broker is in-memory only (ADR-0019):** Pending auth / codes / DCR live in process memory. MCP persona paths are stateless and horizontally scalable; use one replica or sticky `/oauth/*` for the broker until signed-state/CIMD.
- **`import-x/order`'s `type` group is unified, not split by parent/sibling:** With `groups: [..., 'sibling', 'index', 'type']` and `pathGroupsExcludedImportTypes: ['type']`, all `import type { ... } from '...'` statements land in one final `type` bucket and are alphabetized as a flat list — mixing `../../foo.js` and `./bar.js` type imports does not follow the parent-before-sibling rule that applies to value imports. Run `eslint --fix` (or just try the order the autofixer wants) instead of guessing from the value-import convention.
