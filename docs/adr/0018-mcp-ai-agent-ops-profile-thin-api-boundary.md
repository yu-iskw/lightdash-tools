# 18. MCP ai-agent-ops profile thin API boundary

Date: 2026-08-03

## Status

Accepted

## Context

Coding agents need to inspect Lightdash AI agents, run product evaluations, and drive improvement loops. An earlier RFC draft placed offline datasets, scorers, runners, failure clustering, and promotion reports **inside** `@lightdash-tools/mcp`. That conflicts with:

- least-capability profiles ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md));
- host-orchestrated primitives, not mega-tools ([ADR-0010](0010-mcp-organization-audit-profile-read-only-boundary.md));
- the operation catalog as agent-surface SSOT ([ADR-0013](0013-operation-catalog-as-sole-agent-surface-ssot.md));
- existing GitOps AgentOps in `@lightdash-tools/common` / `client` / CLI (`agentops plan|apply|drift|evaluate-gate`).

Lightdash already exposes project AI-agent CRUD, threads, evaluation suites/runs, and readiness APIs. Client and CLI already wrap them. MCP exposure was reserved (`mcp.taskSupport.exposed: false`).

Combined MCP server+tool names must stay under ~60 characters on common clients.

## Decision

1. Ship a separate **`ai-agent-ops`** profile at fixed path `/ai-agent-ops/v1/mcp` whose tools are **thin Lightdash API wrappers only** (catalogued operations). Tool membership from catalog `profiles` via `listMcpToolNamesByProfile` ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md)). No Git dataset store, local scorers, custom runners, `analyze_*`, or `recommend_*` tools in `packages/mcp`.
2. **Loop engineering is distributed:** MCP playbooks/prompts guide the host; CLI/`agentops` owns bundles, drift, and promotion gates (`evaluateGatePolicy`); the coding host synthesizes failures and implements interventions (optionally via other MCP profiles such as `semantic-layer` / `content-reader`).
3. MCP server display name is **`lightdash-mcp-aops`**. Long catalog tool names may be shortened at the MCP `toolName` (e.g. `get_agent_eval_run_results`) to satisfy the ~60-character combined limit.
4. **v1 surface:** project agent list/get; readiness / suggestions / models / explore-access-summary; thread list/get; evaluation suite CRUD + run + run list/get. **Deferred on MCP:** agent create/update/delete, thread generate/continue, org admin mutations.
5. Project scope follows content-reader precedence: `X-Lightdash-Project` → tool `projectUuid` → `PROJECT_SCOPE_REQUIRED`. Optional ceiling: `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`.
6. Prefer project-scoped agent endpoints over org admin inventory + filter.
7. Truth labeling is mandatory in playbooks: readiness API ≠ evaluation run ≠ thread generation. Hosts must not silently substitute modes.
8. Thread/message and evaluation prompt text are conversation-class; redact message bodies by default on MCP ([ADR-0011](0011-mcp-tool-response-sensitivity-classes.md) patterns).
9. Stdio: `lightdash-mcp stdio --profile ai-agent-ops`. Catalog profile id: `ai-agent-ops`. Code: `packages/mcp/src/profiles/ai-agent-ops/`.
10. Inventory: [endpoint inventory](../profiles/ai-agent-ops/inventory.md); loop: [distributed loop](../profiles/ai-agent-ops/loop.md).

## Consequences

- Agents get MCP access to product evaluation runs without a second offline eval platform in the MCP process.
- Promotion decisions remain CLI/`agentops`-driven; MCP only fetches run results.
- Cross-domain readiness diagnosis requires the host to attach additional profiles or use CLI — this profile does not embed semantic/content tools.
- Catalog must expose only the v1 surface (`exposed: true`) and add discovery ops that previously lived client-only.
- Future agent mutation or thread generation on MCP requires a separate safety review (open-world cost, optimistic concurrency).
