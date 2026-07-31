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
- **Trunk via devDependency:** `@trunkio/launcher` provides the local `trunk` CLI (`pnpm exec trunk`). Run `pnpm trunk:install` after `pnpm install` to fetch Trunk-managed linters. No global Trunk install required.
- Keep `pnpm-lock.yaml` committed for reproducible installs.
- **pnpm v11 config location:** `overrides` and other pnpm settings live in `pnpm-workspace.yaml`, not `package.json#pnpm`. The repo pins `packageManager` to `pnpm@11.5.3`.
- **Build before ESLint:** Workspace packages resolve via `dist/` entrypoints. `verify:pr` and `verify:quick` run `pnpm build` first so `import-x/no-unresolved` does not false-negative.
- ADR and Changie are initialized (`docs/adr`, `.changie.yaml`); use the `manage-adr` and `manage-changelog` skills when `adr-tools` and `changie` are available.
- **Trunk unavailable (restricted network):** If `curl https://get.trunk.io` returns 403, use these direct fallbacks instead of Trunk commands:
  - Lint: `pnpm lint:eslint`
  - Format: `pnpm format:eslint` (ESLint auto-fix) and `pnpm format:prettier` (Prettier)
  - These skip Trunk entirely but cover the essential formatting and linting checks.
- **OpenAPI paginated responses are always wrapped:** Lightdash list endpoints return `{ results: { data: { <key>: T[] }, pagination? }, status: 'ok' }`, not a bare array. Always check the `ApiXxxListResponse` schema in `packages/common/src/types/generated/openapi-types.ts` before assuming the shape. Extract the inner array (e.g. `response.results.data.runs`) after fetching.
- **New common types must be threaded through three layers:** When adding a type from the OpenAPI-generated file to `packages/common`, export it from: (1) `types/v1/ai-agents.ts` namespace, (2) both the namespace and the flat exports in `types/v1/lightdash-api.ts`, and (3) the flat export block in `types/lightdash-api.ts`. Missing any layer causes "not exported" build errors in dependent packages.
- **Validate org-wide CLI flags explicitly:** Boolean CLI flags that affect organization-wide settings (e.g. `--ai-agents-visible`) must validate against the exact allowed literals (`'true'`/`'false'`) and `process.exit(1)` on invalid input. Never silently coerce via `value === 'true'` — typos like `True` or `yes` would silently disable features.
- **Agent-safe surface (ADR-0004):** Irrecoverable operations (e.g. `delete_member`) must not be exposed on MCP or CLI — register them as `agentExposure: 'client-only'` in `packages/common/src/operations/` and use `@lightdash-tools/client` for admin scripts. Reversible destructive ops (delete group, revoke access) may stay on both surfaces with `WRITE_DESTRUCTIVE` and existing guardrails.
- **MCP tools must use `registerToolSafe()`:** Every MCP tool registration must go through `registerToolSafe()` in `packages/mcp/src/tools/shared.ts`, never the raw `server.registerTool()`. Guardrails (ADR-0008): audit (outer) → HTTP project pin → input validation → handler. Capability surface is persona `toolIds` (ADR-0006), not process safety mode.
- **CLI actions must use `wrapAction()`:** Every CLI command's `.action()` callback must be wrapped with `wrapAction(annotations, fn)` from `packages/cli/src/utils/safety.ts`. This enforces safety-mode and records audit log entries for every invocation.
- **Input validation applies only to known identifier keys:** `validateResourceId()` is applied to strings under `project`, `projectUuid`, `projectUuids`, `projects`, `slug` in options/nested objects—not to bare positional strings. Free-form positionals (query, name, resource) may contain `?`, `#`, `%`; do not add validation for them. When adding a new identifier option, include its key in the list in `packages/cli/src/utils/safety.ts`. See [ADR-0008](docs/adr/0008-mcp-request-scope-and-hardening.md).
- **`_lightdashBlocked` marker convention:** Guardrail layers (project-pin denial, input-validation failure; CLI still uses safety-mode / dry-run / allowlist) return `{ ..., _lightdashBlocked: true }`. The audit wrapper reads this flag to set `status = 'blocked'`, then strips it before returning to the MCP client. Do not return this marker from real tool handlers.
- **Tool args may use singular or plural project UUID shapes:** `extractProjectUuids()` in `shared.ts` handles both `projectUuid: string` and `projectUuids: string[]`. When writing project-allowlist or audit logic, always use this helper instead of reading `args.projectUuid` directly.
- **Env vars use LIGHTDASH*TOOLS* prefix:** Project-specific vars use this prefix to distinguish from official Lightdash vars (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`). CLI still uses `LIGHTDASH_TOOLS_SAFETY_MODE`, `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`, `LIGHTDASH_TOOLS_DRY_RUN`; MCP uses persona + pin + optional `LIGHTDASH_TOOLS_AUDIT_LOG`. See [ADR-0009](docs/adr/0009-cross-cutting-conventions.md).
- **Secrets:** Use env vars from the parent process. Do not recommend plaintext `.env` to users; if they use file-based config, recommend dotenvx. See [docs/secrets-and-credentials.md](docs/secrets-and-credentials.md).
- **`initAuditLog()` must be called once at process startup:** Both `packages/cli/src/index.ts` and MCP's `bin.ts` call `initAuditLog()` at startup. Any new entrypoint must do the same; individual command files do not need to call it.
- **MCP tool names must be concise:** Some MCP clients (e.g., Claude Desktop) impose a 60-character limit on combined server and tool names. Use the `ldt__` prefix (set in `packages/mcp/src/tools/shared.ts`) and avoid excessively long tool names to ensure they are not filtered out.
- **Knip ignores intentional type barrels:** `knip.json` uses `ignoreIssues` for `packages/common/src/types/**` because namespace re-exports are public API surface, not dead code. Do not remove those ignores when knip reports unused namespace members in type files.
- **Knip 6.29+ flags unused barrel re-exports:** Intermediate `index.ts` barrels that re-export symbols only imported from their defining modules will fail `pnpm knip`. Prefer deleting unused re-exports over broad `ignoreIssues` unless the barrel is intentional public API.
- **`pnpm audit` can be registry-blocked in this environment:** The npm audit endpoint may return HTTP 403 (`ERR_PNPM_AUDIT_BAD_RESPONSE`), so a failing audit command can be an infrastructure limitation rather than package vulnerability output. Run upgrades/checks (`pnpm outdated -r`, targeted `pnpm up -r ...`) and report audit as a warning when this happens.
- **MCP SDK v2 + OAuth broker (ADR-0007):** Pin `@modelcontextprotocol/server@2.0.0` / `@modelcontextprotocol/node@2.0.0`. Keep `server.connect(StdioServerTransport)` and `NodeStreamableHTTPServerTransport` (no `createMcpHandler` / `server-legacy` AS). Hosted HTTP auth is credential-inferred: `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID` + `_SECRET` + `PUBLIC_URL` → OAuth broker (server-held confidential client, shared `{PUBLIC_URL}/oauth/callback`, PRM `authorization_servers` = public MCP host). Clients use URL-only config. Obsolete `AUTH_MODE` / `EXPERIMENTAL_*` / `DANGEROUSLY_*` / `INSECURE_DEV` are rejected. PAT + `NODE_ENV=development` remain secondary for stdio/local. Auth protocol docs: [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
- **Local OAuth public URL = Cloudflare Tunnel:** For Cursor hosted-OAuth smoke, run `cloudflared tunnel --url http://127.0.0.1:3100`, set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in `.env` to the printed `https://*.trycloudflare.com` host (not hard-coded in Compose), recreate the mcp container, register `{PUBLIC_URL}/oauth/callback` in Lightdash, and point Cursor at `{PUBLIC_URL}/semantic-layer/v1/mcp`. Free ngrok interstitials break Cursor’s post-callback Mozilla GET to PRM/AS (`Unexpected token 'Y', "You are ab"...`); the process still warns if `PUBLIC_URL` is `*.ngrok-free.app`.
- **OAuth broker CORS ≠ MCP Origin allowlist:** Empty `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` still blocks Origin reflection on persona MCP routes, but `/oauth/*` and discovery must reflect any `Origin` (`buildOAuthPublicCorsHeaders`) so Cursor’s loopback token exchange (`http://localhost:8787`) can read JSON. Validate redirect/PKCE before `takeCode` so bad probes do not burn one-time codes.
- **MCP package tests are CommonJS under `tsc`:** `packages/mcp/tsconfig.json` uses `"module": "commonjs"` and compiles `*.test.ts` into `dist/`. Do not use `import.meta` in MCP tests — it fails `pnpm --filter @lightdash-tools/mcp build`. Resolve the repo root with `process.cwd()` (Vitest runs from the monorepo root).
- **Stdio MCP smoke env:** `EnvContextProvider` calls `getClient()` at construct time, so `LIGHTDASH_URL` and `LIGHTDASH_API_KEY` must be set before the process starts. Dummy values are enough for initialize/tools/list; the Lightdash API is only hit on tool execution.
- **OpenAPI pin lives in `config/lightdash-openapi-ref.txt`:** `generate:types` fetches swagger from that commit SHA (not floating `main`). Bump the pin, regenerate, then fix breakages — never hand-edit `openapi-types.ts`.
- **`LightdashUser` / `AuthenticatedUser` avatar fields:** Upstream now requires `avatarUrl` and `avatarGradient` (`string | null`). Fixtures using `satisfies AuthenticatedUser` must include both after an OpenAPI sync.
- **MCP personas + shared tool registry (ADR-0006 / ADR-0008):** Shared tools live in `packages/mcp/src/tools/registry.ts`; personas under `packages/mcp/src/personas/<id>/` own `toolIds`, prompts, playbooks, and a fixed HTTP `path`. Shipped persona is `semantic-layer` only (`/semantic-layer/v1/mcp`, nine `ldt__*` tools via `registerToolSafe`). No process safety-mode / allowlist / dry-run on MCP. No `LIGHTDASH_TOOLS_MCP_PERSONA` / free-form `LIGHTDASH_TOOLS_MCP_PATH`. Stdio always uses the sole shipped persona. Broad admin ops stay on client/CLI. Runtime client + audit path live in `packages/mcp/src/config/runtime.ts`; audit helpers in `packages/mcp/src/audit/`. Package-level `src/prompts/` / `src/resources/` were removed — prompts/resources are persona-owned only.
- **Semantic-layer MCP UX:** Prompts (`lightdash_semantic_explore`, `lightdash_semantic_compose_compile`, `lightdash_semantic_compile_debug`) + playbook `lightdash://playbooks/semantic-layer` cite `ldt__*` names. `list_explores` returns summaries with optional `search`/`limit`; `list_dimensions` includes `fieldId` for `compile_query` and defaults to `table === explore.baseTable` (not always equal to explore id). Compile/discovery only — no run-query. Empty SELECT → `isError`. Optional project pin is HTTP-only via `X-Lightdash-Project` (ALS → `governance.pinnedProjectUuid`); mismatched tool `projectUuid` args are blocked and `list_projects` returns the pinned project only.
- **MCP Docker / Compose:** Build from repo root: `docker build -f packages/mcp/Dockerfile -t lightdash-mcp:local .`. Root `.dockerignore` → `packages/mcp/.dockerignore`. Compose: `docker compose -f docker-compose.dev.yml --profile semantic-layer up --build`. PAT/local: Cursor `url: http://localhost:8080/semantic-layer/v1/mcp`. Hosted OAuth: Cloudflare Tunnel on `:3100` + `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in `.env` (see [docs/cursor-lightdash-oauth-mcp.md](docs/cursor-lightdash-oauth-mcp.md)).

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
- Operation registry generator requires non-empty `mcp.toolName` and `cli.commandPath` only for `agentExposure: 'agent'`; `client-only` ops document banned MCP names but omit CLI paths.
- Per ADR-0004, irrecoverable ops such as `delete_member` stay off MCP and CLI; use `@lightdash-tools/client` directly for `users.members.delete`.
- **Slim ADRs:** Binding decisions live in nine thematic records under [`docs/adr`](docs/adr); see the old→new mapping in [`docs/adr/README.md`](docs/adr/README.md).
