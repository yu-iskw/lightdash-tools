# AI agent-ops — evaluation

URI: `lightdash://playbooks/ai-agent-ops/evaluation`

## Phase 1 — Inspect agent

1. `list_project_agents` / `get_project_agent`
2. Optionally `get_agent_models`, `get_agent_suggestions`, `get_explore_access_summary`
3. Optionally `evaluate_agent_readiness` — label as readiness API, not e2e

## Phase 2 — Ensure suite

1. `list_agent_evaluations` / `get_agent_evaluation`
2. Create or update via `create_agent_evaluation` / `update_agent_evaluation` / `append_agent_evaluation_prompts` when needed
3. Prefer deterministic expected responses when the product supports them

## Phase 3 — Run

1. `run_agent_evaluation` — open-world; budget runs
2. Poll `list_agent_evaluation_runs` until terminal
3. `get_agent_eval_run_results` for per-prompt evidence

## Phase 4 — Do not invent scores on the server

Cluster failures and score in the host conversation. Promotion policy is CLI `agentops evaluate-gate` (see release-gate topic).
