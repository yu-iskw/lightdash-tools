# AI agent-ops distributed loop

Companion to ADR-0018 and [endpoint inventory](inventory.md).

## Surfaces

| Layer                                                                    | Role                                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| MCP `ai-agent-ops` (`/ai-agent-ops/v1/mcp`, server `lightdash-mcp-aops`) | Thin Lightdash AI-agent APIs: inventory, **create/update**, knowledge documents, readiness, threads (read), evaluation suite/run |
| CLI `agents`                                                             | Same APIs from the shell (including agent delete and thread generate)                                                            |
| CLI `agentops`                                                           | GitOps bundles + promotion gates                                                                                                 |
| Host coding agent                                                        | Failure synthesis, intervention choice, iteration budget                                                                         |
| Optional MCP `semantic-layer` / `content-reader`                         | Metadata / content diagnosis                                                                                                     |

## CLI agentops commands

```bash
lightdash-tools agentops plan --file bundle.yaml
lightdash-tools agentops apply --file bundle.yaml
lightdash-tools agentops drift --file bundle.yaml
lightdash-tools agentops evaluate-gate --file gate.yaml --run-uuid <uuid>
lightdash-tools agentops bundle-schema
lightdash-tools agentops gate-schema
```

Bundles use `apiVersion: lightdash.ai/v1alpha1` / `kind: LightdashAiAgentBundle`.
Gates use `kind: LightdashAiEvaluationGate` and `evaluateGatePolicy()` in `@lightdash-tools/common`.

## Recommended host sequence

1. MCP: `list_project_agents` → prefer `update_project_agent` when an existing agent fits; otherwise draft create args
   1b. MCP (`content-reader`): `list_spaces` / `get_space` to discover space UUIDs when scoping saved content; never invent UUIDs. `spaceAccess: []` or omit = all project spaces; non-empty = agent content boundary ([content tools](https://docs.lightdash.com/guides/ai-agents/content-tools))
2. MCP: `get_explore_access_summary` with proposed tags (null/empty = all explores) before create/update
3. MCP: create when needed — **form elicitation** when the host supports it, otherwise `preview_create_agent` → human approval of permission + space scope summary → `confirm_create_agent` → `create_project_agent` with `createConfirmToken` and identical payload ([ADR-0034](../../adr/0034-mcp-ai-agent-ops-create-preview-token-confirmation-for-non-elicitation-hosts.md)); or `update_project_agent` without a create gate. Heed `TAGS_MATCH_NO_EXPLORES`, `SPACES_NOT_IN_PROJECT`, `SPACE_LIST_UNAVAILABLE`, and `ELEVATED_*`. Enable `enableDataAccess` only when eval runs need warehouse rows; pair with `enableContentTools` when the agent must create/edit dashboards in scoped spaces.
4. MCP: optional `evaluate_agent_readiness` → ensure suite (`list/get/create/update` evaluation) → `run_agent_evaluation` → poll runs → `get_agent_eval_run_results`
5. MCP (when failures need business context): `list_agent_documents` → `create_agent_document` / `update_agent_document` for glossaries and SOPs ([ADR-0035](../../adr/0035-mcp-ai-agent-ops-agent-knowledge-document-crud.md)); prefer semantic `ai_hint` fixes via other profiles when the issue is field metadata
6. CLI: `agentops evaluate-gate` against the completed run
7. Host: cluster failures; prefer semantic/metadata fixes (other profiles) before knowledge/instruction changes
8. MCP: re-run evaluation; repeat until gate passes or budget exhausted

## Truth labels

- `evaluate_agent_readiness` ≠ evaluation run
- MCP run results ≠ promotion decision (use `agentops evaluate-gate`)
- No offline scorers or `recommend_*` tools on MCP
- Agent `tags` = explore/field tag allowlist ([Lightdash data access](https://docs.lightdash.com/guides/ai-agents/data-access)), **not** explore names — verify with `get_explore_access_summary` before setting tags
- Agent `spaceAccess` = saved content space allowlist ([Lightdash content tools](https://docs.lightdash.com/guides/ai-agents/content-tools)), **not** semantic data — discover UUIDs with `content-reader` `list_spaces`; empty = all spaces
