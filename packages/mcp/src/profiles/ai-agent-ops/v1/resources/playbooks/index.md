# AI agent-ops playbooks

URI: `lightdash://playbooks/ai-agent-ops`

Workflow-scoped playbooks. Prompts always embed **core**; topic prompts also embed one topic:

| Topic                      | URI                                                   |
| -------------------------- | ----------------------------------------------------- |
| Core (bans & truth labels) | `lightdash://playbooks/ai-agent-ops/core`             |
| Evaluation                 | `lightdash://playbooks/ai-agent-ops/evaluation`       |
| Loop engineering           | `lightdash://playbooks/ai-agent-ops/loop-engineering` |
| Release gate               | `lightdash://playbooks/ai-agent-ops/release-gate`     |

Thin Lightdash AI-agent API surface. Loop engineering is distributed across MCP primitives, the host agent, and CLI `agentops` — there are no offline scorer or `recommend_*` MCP tools.
