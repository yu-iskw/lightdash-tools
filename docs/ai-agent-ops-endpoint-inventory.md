# AI Agent Ops MCP — endpoint inventory

Persona: `ai-agent-ops` · Path: `/ai-agent-ops/v1/mcp` · Server: `lightdash-mcp-aops`
See [RFC](rfc-ai-agent-ops-mcp-persona.md) and [ADR-0018](adr/0018-mcp-ai-agent-ops-persona-thin-api-boundary.md).

| MCP tool (`lightdash_` + id)      | HTTP                                                      | Notes                                     |
| --------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| `list_project_agents`             | `GET /api/v1/projects/{projectUuid}/aiAgents`             | Project-scoped                            |
| `get_project_agent`               | `GET /api/v1/projects/{projectUuid}/aiAgents/{agentUuid}` |                                           |
| `evaluate_agent_readiness`        | `POST …/{agentUuid}/evaluateReadiness`                    | Not an eval run                           |
| `get_agent_suggestions`           | `GET …/{agentUuid}/suggestions`                           |                                           |
| `get_agent_models`                | `GET …/{agentUuid}/models`                                |                                           |
| `get_explore_access_summary`      | `POST …/explore-access-summary`                           | Body: tags (project-scoped; no agentUuid) |
| `list_agent_threads`              | `GET …/{agentUuid}/threads`                               | Summaries                                 |
| `get_agent_thread`                | `GET …/threads/{threadUuid}`                              | Message bodies redacted by default        |
| `list_agent_evaluations`          | `GET …/{agentUuid}/evaluations`                           |                                           |
| `get_agent_evaluation`            | `GET …/evaluations/{evalUuid}`                            |                                           |
| `create_agent_evaluation`         | `POST …/evaluations`                                      |                                           |
| `update_agent_evaluation`         | `PATCH …/evaluations/{evalUuid}`                          |                                           |
| `append_agent_evaluation_prompts` | `POST …/evaluations/{evalUuid}/append`                    |                                           |
| `delete_agent_evaluation`         | `DELETE …/evaluations/{evalUuid}`                         | Destructive                               |
| `run_agent_evaluation`            | `POST …/evaluations/{evalUuid}/run`                       | Open-world                                |
| `list_agent_evaluation_runs`      | `GET …/evaluations/{evalUuid}/runs`                       | Paginated                                 |
| `get_agent_eval_run_results`      | `GET …/runs/{runUuid}`                                    | Short MCP id for 60-char limit            |

## Not on MCP v1

| Capability                       | Surface                         |
| -------------------------------- | ------------------------------- |
| Agent create/update/delete       | CLI `agents` / `agentops apply` |
| Thread start/continue            | CLI `agents threads`            |
| Org admin agents/settings        | CLI `ai-agents`                 |
| Promotion gate                   | CLI `agentops evaluate-gate`    |
| Bundle plan/drift                | CLI `agentops`                  |
| Offline scorers / local datasets | Host / consumer Git — not MCP   |
