# AI agent-ops — core

URI: `lightdash://playbooks/ai-agent-ops/core`

## Hard bans

Do not create/update/delete agents on this server, start or continue threads, mutate users/roles/semantic models/charts, run local offline scorers, write Git eval artifact stores via MCP, or claim a CLI promotion gate passed from MCP run results alone.

## Tool catalog (primitives only)

There are no `recommend_*`, `analyze_*`, or offline dataset MCP tools (no offline scorers). Chain:

- Inventory: `list_project_agents`, `get_project_agent`
- Readiness API: `evaluate_agent_readiness` (not an eval run)
- Scope helpers: `get_agent_suggestions`, `get_agent_models`, `get_explore_access_summary`
- Threads (read): `list_agent_threads`, `get_agent_thread` (`includeMessageText=true` to reveal bodies / firstMessage)
- Evaluations: `list_agent_evaluations`, `get_agent_evaluation`, `create_agent_evaluation`, `update_agent_evaluation`, `append_agent_evaluation_prompts`, `delete_agent_evaluation`, `run_agent_evaluation`, `list_agent_evaluation_runs`, `get_agent_eval_run_results` (`includePromptText=true` to reveal prompt text)

## Project scope

Resolve via `X-Lightdash-Project` or tool `projectUuid`. Otherwise `PROJECT_SCOPE_REQUIRED`. Optional ceiling: `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`.

## Truth labels

| Signal               | Tool                                 | Means                        |
| -------------------- | ------------------------------------ | ---------------------------- |
| Readiness API        | `evaluate_agent_readiness`           | Product readiness score only |
| Evaluation run       | `run_agent_evaluation` + run getters | Product e2e suite            |
| Promotion gate       | CLI `agentops evaluate-gate`         | Policy against run results   |
| Static config review | Host over `get_project_agent`        | No MCP static scorer         |

Never silently substitute readiness for an evaluation run.

## Distributed loop

1. MCP for Lightdash API evidence and product eval runs.
2. Host synthesizes failures and chooses interventions.
3. CLI `agentops` for bundles, drift, and gates.
4. Optional other MCP personas (`semantic-layer`, `content-reader`) for metadata/content fixes.
