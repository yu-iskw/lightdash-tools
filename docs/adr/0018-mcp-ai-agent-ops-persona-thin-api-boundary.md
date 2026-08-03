# 18. MCP ai-agent-ops persona thin API boundary

Date: 2026-08-03

## Status

Accepted

## Context

Coding agents need to inspect Lightdash AI agents, run product evaluations, and drive improvement loops. An earlier RFC draft placed offline datasets, scorers, runners, failure clustering, and promotion reports **inside** `@lightdash-tools/mcp`. That conflicts with:

- least-capability personas ([ADR-0006](0006-mcp-personas-shared-registry-fixed-paths.md));
- host-orchestrated primitives, not mega-tools ([ADR-0010](0010-mcp-organization-audit-persona-read-only-boundary.md));
- the operation catalog as agent-surface SSOT ([ADR-0013](0013-operation-catalog-as-sole-agent-surface-ssot.md));
- existing GitOps AgentOps in `@lightdash-tools/common` / `client` / CLI (`agentops plan|apply|drift|evaluate-gate`).

Lightdash already exposes project AI-agent CRUD, threads, evaluation suites/runs, and readiness APIs. Client and CLI already wrap them. MCP exposure was reserved (`mcp.taskSupport.exposed: false`).

Combined MCP server+tool names must stay under ~60 characters on common clients.

## Decision

1. Ship a separate **`ai-agent-ops`** persona at fixed path `/ai-agent-ops/v1/mcp` whose tools are **thin Lightdash API wrappers only** (catalogued operations). No Git dataset store, local scorers, custom runners, `analyze_*`, or `recommend_*` tools in `packages/mcp`.
2. **Loop engineering is distributed:** MCP playbooks/prompts guide the host; CLI/`agentops` owns bundles, drift, and promotion gates (`evaluateGatePolicy`); the coding host synthesizes failures and implements interventions (optionally via other MCP personas such as `semantic-layer` / `content-reader`).
3. MCP server display name is **`lightdash-mcp-aops`**. Long catalog tool names may be shortened at the MCP `toolName` (e.g. `get_agent_eval_run_results`) to satisfy the ~60-character combined limit.
4. **v1 allowlist:** project agent list/get; readiness / suggestions / models / explore-access-summary; thread list/get; evaluation suite CRUD + run + run list/get. **Deferred on MCP:** agent create/update/delete, thread generate/continue, org admin mutations.
5. Project scope follows content-reader precedence: `X-Lightdash-Project` → `LIGHTDASH_TOOLS_PROJECT_UUID` → tool `projectUuid` → `PROJECT_SCOPE_REQUIRED`.
6. Prefer project-scoped agent endpoints over org admin inventory + filter.
7. Truth labeling is mandatory in playbooks: readiness API ≠ evaluation run ≠ thread generation. Hosts must not silently substitute modes.
8. Thread/message and evaluation prompt text are conversation-class; redact message bodies by default on MCP (ADR-0011 patterns).
9. Stdio: `lightdash-mcp ai-agent-ops`. Catalog profile: `ai-agent-ops` for persona parity tests.
10. Design detail: [RFC](../rfc-ai-agent-ops-mcp-persona.md); inventory: [endpoint inventory](../ai-agent-ops-endpoint-inventory.md).

## Consequences

- Agents get MCP access to product evaluation runs without a second offline eval platform in the MCP process.
- Promotion decisions remain CLI/`agentops`-driven; MCP only fetches run results.
- Cross-domain readiness diagnosis requires the host to attach additional personas or use CLI — this persona does not embed semantic/content tools.
- Catalog must expose only the v1 allowlist (`exposed: true`) and add discovery ops that previously lived client-only.
- Future agent mutation or thread generation on MCP requires a separate safety review (open-world cost, optimistic concurrency).
