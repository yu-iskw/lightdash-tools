# Changelog

## [0.18.0] - 2026-08-20

### Features

- content-reader executes saved dashboard SQL tiles via query/dashboard-sql-chart (standalone SQL charts remain disabled)

## [0.17.0] - 2026-08-20

### Features

- MCP HTTP OAuth advertises host-aware metadata on extra invoke origins (LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS)

### Bug Fixes

- Separate MCP-issued OAuth tokens from Lightdash credentials and canonicalize RFC 8707 resource audiences

## [0.16.1] - 2026-08-20

### Features

- MCP progressive-disclosure prompt context (compact default; compatible/embedded via LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT)

### Documentation

- Document MCP HTTP health probes (/health/live, /health/ready) in the package README and Cloud Run operator guide.

### Chores

- Sync OpenAPI types to Lightdash 1.109.1

## [0.14.0] - 2026-08-10

### Features

- MCP HTTP: optional LIGHTDASH_TOOLS_MCP_PROFILES allowlist to mount a subset of fixed profile paths.

### Bug Fixes

- Bump js-yaml to 4.3.1 and nanoid to 3.3.17 to remediate High SBOM findings (GHSA-5p4m-2wfm-xmqj, GHSA-2v37-7h3g-55p8).

## [0.13.2] - 2026-08-06

## [0.13.1] - 2026-08-06

## [0.13.0] - 2026-08-04

### Features

- MCP CLI: stdio/http --help lists profile mounts and tool ids from PROFILES.

### Bug Fixes

- MCP compile_query sets metricQuery.exploreName from exploreId; clarify semantic-layer playbooks for joins and compiledSql trust.
- MCP compile_query defaults missing tableCalculations to []; semantic-layer playbooks/prompts prioritize fieldIds and SELECT aliases.
- BREAKING: MCP stdio profile is CLI-only via `stdio --profile <id>`; no env-based profile selection.
- BREAKING: MCP stdio is transport-first — use `stdio --profile <id>`; remove profile subcommands and positional stdio args.

### Documentation

- Clarify MCP README for stdio --profile and http launchers.

### Refactors

- MCP mount membership uses literal per-profile tool tables in common for IDE-traceable SSOT.
- Replace operations catalog with profile-owned ToolModules; remove CLI schema introspection.

## [0.12.1] - 2026-08-04

### Features

- Honor Cloud Run PORT for MCP HTTP listen when LIGHTDASH_TOOLS_MCP_HTTP_PORT is unset
- BREAKING: MCP stdio no longer defaults to semantic-layer; use `stdio --profile <id>`.
- BREAKING: remove deprecated lightdash-mcp serve-http alias; use http.

## [0.12.0] - 2026-08-04

### Bug Fixes

- Remediate audit findings for hono and brace-expansion.

## [0.11.0] - 2026-08-04

### Features

- Add data-analyst MCP persona for unsaved Explore metric queries (run_metric_query).
- BREAKING: MCP packaging uses profile (not persona): catalog profiles are tool-membership SSOT; envelope context.profile; stdio profile subcommand; drop semantic-discovery/org-audit-readonly and granular CLI profile tags.

### Bug Fixes

- Content tool envelopes stamp the serving persona from bindServerPersona (no hard-coded content-reader label).

## [0.10.0] - 2026-08-03

### Features

- MCP dual-era protocol serving via SDK serveStdio and createMcpHandler; remove initialize caps process cache

### Documentation

- Reorganize docs into operators/personas audience taxonomy; archive Accepted RFCs; OAuth hub at docs/operators/mcp-oauth.md.
- Drop docs/archive, agent-context, security, and reference dirs; keep threat model and agent-context under operators; CLI AI-agents reference under personas/ai-agent-ops.

## [0.9.0] - 2026-08-03

### Features

- Breaking: MCP/CLI share LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS allowlist (renamed from ALLOWED_PROJECTS); removes PROJECT_UUID default and MCP_AVAILABLE_PROJECT_UUIDS — startup/CLI fail if legacy ALLOWED_PROJECTS or MCP_AVAILABLE still set; promote_dashboard also fails closed when upstream is outside the ceiling
- Make MCP HTTP stateless: drop Redis ephemeral store and transport sessions; use HMAC-signed preview tokens; keep in-memory OAuth broker only.
- content-developer prompts/playbooks require Design Spec approval before dashboard writes
- content-reader export_chart_image returns a single PNG snapshot (MCP ImageContent; SSRF-hardened download; SQL charts blocked)
- Emit Cloud Logging–parseable MCP/CLI audit JSON on stderr (channel=audit) with clientSessionId and personaId; document Cloud Run sink/retention.

### Bug Fixes

- MCP wrapTool maps uncaught Lightdash API failures to structured UPSTREAM and RATE_LIMITED tool errors; HttpClient rejects malformed success envelopes as ContractError

## [0.8.0] - 2026-08-02

### Features

- Add content-reader MCP persona for project-scoped saved-content reads and bounded semantic chart execution (ADR-0012).
- Add content-governance MCP persona with elicitation-gated soft-delete for charts and dashboards (ADR-0015).
- Add elicitation-gated dashboard promote (and read-only promoteDiff) on the content-governance MCP persona.
- Add pluggable MCP ephemeral store (memory/redis) and preview claim/apply/release state machine (ADR-0016).

### Bug Fixes

- Redact MCP emails on direct access and omit project connection secrets by default (ADR-0011).

## [0.7.0] - 2026-08-01

### Features

- Add semantic-layer HTTP authMode=none with PAT for local Compose profile docker-compose.dev.yml.
- Add read-only organization-audit MCP persona at /organization-audit/v1/mcp with 18 inventory/access/content/scheduler primitives (playbook-orchestrated; no composed audit_* tools).
- Host MCP OAuth with server-held Lightdash client credentials and a shared /oauth/callback broker; infer auth from credentials and keep PAT secondary
- Add @lightdash-tools/semantic-layer-mcp with three semantic-layer prompts and a static playbook resource (lightdash://playbooks/semantic-layer)
- Allow optional project pin via X-Lightdash-Project (HTTP) or LIGHTDASH_TOOLS_PINNED_PROJECT / --pin-project (stdio) on semantic-layer-mcp
- Register compile/discovery MCP tools on @lightdash-tools/semantic-layer-mcp (projects, explores, metrics, compile_query) with thin registerTool helpers
- Add stdio Docker image for semantic-layer-mcp (Cursor envFile + docker run -i)
- Migrate @lightdash-tools/mcp to MCP TypeScript SDK v2 (@modelcontextprotocol/server and @modelcontextprotocol/node at 2.0.0) while preserving legacy-era stdio and stateful Streamable HTTP behavior
- Add OAuth-backed Streamable HTTP mode with per-user Lightdash bearer auth, protected-resource metadata, and session token binding

### Bug Fixes

- Slim list_dimensions, type explore helpers, collapse prompts onto playbook, keep explore errors/warnings, and resolve lineage fieldIds in the client.
- Flag empty-SELECT compile_query results as errors; default list_dimensions to base-table only.
- Filter list_dimensions by explore.baseTable and restore HTTP X-Lightdash-Project pin on @lightdash-tools/mcp
- OAuth broker: bind DCR redirects, forward Proxy-Authorization, omit unsupported refresh tokens
- Improve semantic-layer-mcp playbook/prompts and slim list_explores summaries with search/limit plus fieldId on list_dimensions for compile_query

### Documentation

- Clarify semantic-layer MCP playbook/prompts: always-search, explore disambiguation, catalog vs explore metrics, lineage id retry, shortlist-only answers.
- Document silent empty-SELECT compiles, base-table dimensions, and get_metric tableName=explore id in semantic-layer MCP playbook/prompts.
- Clarify semantic-layer playbook/prompts for catalog vs explore-local metrics, dimension shortlists, and multi-insight composition
- Generalize semantic-layer MCP playbook and prompts: portable tool invariants only, no org/warehouse-specific tokens.
- Clarify portable semantic-layer playbook rules: project vs warehouse scope, prefer explore-local metrics, compile may add related metrics.
- Fix broken links to deleted docs/compatibility/mcp-clients.md in MCP README and RFC-0041.

### Refactors

- Restructure @lightdash-tools/mcp around a shared tool registry and semantic-layer persona at /semantic-layer/v1/mcp (ldt__* tools); deprecate @lightdash-tools/semantic-layer-mcp
- MCP HTTP config rejects unused LIGHTDASH_TOOLS_MCP_PATH and unenforceable oauth scope env vars; docs list mode matrices and persona path /semantic-layer/v1/mcp
- Remove @lightdash-tools/semantic-layer-mcp; use @lightdash-tools/mcp at /semantic-layer/v1/mcp
- Remove orphaned pre-persona MCP modules (package-level prompts/resources/completion/tasks/ai-agents tools) and fold runtime config + audit helpers under config/ and audit/
- Reorganize MCP src namespaces: auth providers/resource-server seams, server/ and governance/ modules
- Rename MCP tool wire prefix from `ldt__` to `lightdash_` (breaking for clients that hardcode tool names).
- Reorganize MCP tools into organization/project/space/semantic scope folders with lib/ helpers; remove composed lightdash_audit_* tools.
- Remove unused LIGHTDASH_TOOLS_PINNED_PROJECT / ALLOWED_PROJECTS and CLI flags from semantic-layer-mcp; keep HTTP X-Lightdash-Project pin only
- Slim semantic-layer-mcp governance (package-is-allowlist, optional project fence) and add Streamable HTTP lightdash-oauth for remote hosts; OAuth client secrets stay on the MCP client

### Chores

- Remove LIGHTDASH_TOOLS_MCP_INSECURE_DEV; gate local unauthenticated MCP HTTP on NODE_ENV=development only

## [0.6.0] - 2026-03-09

## [0.5.0] - 2026-03-06

## [0.4.0] - 2026-02-27

## [0.3.2] - 2026-02-27

## [0.3.1] - 2026-02-27

## [0.2.6] - 2026-02-13

## [0.2.5] - 2026-02-13

## [0.2.4] - 2026-02-13

## [0.2.3] - 2026-02-13

## [0.2.2] - 2026-02-13

## [0.2.0] - 2026-02-13

## [0.1.2] - 2026-02-13

## [0.1.0] - 2026-02-12

## [v0.1.0] - 2026-02-11
