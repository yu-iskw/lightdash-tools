# `@lightdash-tools/mcp-agent-developer`

## Purpose

An MCP server for **developer workflows** that combine:

- viewer baseline exploration tools
- curated idempotent/non-destructive writes (with guardrails)
- project-scoped AI agent CRUD (no destructive deletes)
- agent evaluation management (no destructive deletes)

## Exposed MCP tools (`ldt__*`)

Viewer baseline tools:

- `ldt__list_projects`, `ldt__get_project`, `ldt__get_validation_results`
- `ldt__list_charts`, `ldt__list_charts_as_code`
- `ldt__list_dashboards`
- `ldt__list_spaces`, `ldt__get_space`
- `ldt__search_content`
- `ldt__list_explores`, `ldt__get_explore`, `ldt__list_dimensions`, `ldt__get_field_lineage`
- `ldt__list_metrics`
- `ldt__list_tags`
- `ldt__compile_query`
- `ldt__list_schedulers`

Developer add-ons:

- Project validation + charts-as-code authoring
  - `ldt__validate_project`
  - `ldt__upsert_chart_as_code`
- AgentOps bundle plan/apply
  - `ldt__ai_agentops_plan`
  - `ldt__ai_agentops_apply`
- Project agent CRUD (no delete)
  - `ldt__list_project_agents`, `ldt__get_project_agent`
  - `ldt__create_project_agent`, `ldt__update_project_agent`
- Evaluations CRUD (no delete)
  - `ldt__list_agent_evaluations`, `ldt__get_agent_evaluation`
  - `ldt__list_agent_evaluation_runs`, `ldt__get_agent_evaluation_run_results`
  - `ldt__create_agent_evaluation`, `ldt__update_agent_evaluation`
  - `ldt__append_agent_evaluation_prompts`, `ldt__run_agent_evaluation`

## Recommended environment variables

```bash
LIGHTDASH_TOOLS_SAFETY_MODE=write-idempotent
LIGHTDASH_TOOLS_ALLOWED_PROJECTS=dev-project-uuid,staging-project-uuid
LIGHTDASH_TOOLS_DRY_RUN=1
LIGHTDASH_TOOLS_AUDIT_LOG=/var/log/lightdash-agent-developer.ndjson
```

## Security note

Developer tools are _still_ subject to runtime guardrails (safety mode, allowlists, dry-run, input validation, audit logging).
