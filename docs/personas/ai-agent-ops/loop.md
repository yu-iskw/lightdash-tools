# AI agent-ops distributed loop

Companion to [ADR-0018](../../adr/0018-mcp-ai-agent-ops-persona-thin-api-boundary.md) and [endpoint inventory](inventory.md).

## Surfaces

| Layer                                                                    | Role                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| MCP `ai-agent-ops` (`/ai-agent-ops/v1/mcp`, server `lightdash-mcp-aops`) | Thin Lightdash AI-agent APIs: inventory, readiness, threads (read), evaluation suite/run |
| CLI `agents`                                                             | Same APIs from the shell (including agent CRUD and thread generate)                      |
| CLI `agentops`                                                           | GitOps bundles + promotion gates                                                         |
| Host coding agent                                                        | Failure synthesis, intervention choice, iteration budget                                 |
| Optional MCP `semantic-layer` / `content-reader`                         | Metadata / content diagnosis                                                             |

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

1. MCP: `list_project_agents` → `get_project_agent` → optional `evaluate_agent_readiness`
2. MCP: ensure suite (`list/get/create/update` evaluation) → `run_agent_evaluation` → poll runs → `get_agent_eval_run_results`
3. CLI: `agentops evaluate-gate` against the completed run
4. Host: cluster failures; prefer semantic/metadata fixes (other personas) before instruction changes
5. CLI: `agentops plan|apply` when changing agent config via Git
6. MCP: re-run evaluation; repeat until gate passes or budget exhausted

## Truth labels

- `evaluate_agent_readiness` ≠ evaluation run
- MCP run results ≠ promotion decision (use `agentops evaluate-gate`)
- No offline scorers or `recommend_*` tools on MCP
