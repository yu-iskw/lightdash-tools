# AI agent-ops — core

URI: `lightdash://playbooks/ai-agent-ops/core`

## Hard bans

Do not delete agents on this server, start or continue threads, mutate users/roles/semantic models/charts, run local offline scorers, write Git eval artifact stores via MCP, or claim a CLI promotion gate passed from MCP run results alone.

## Tool catalog (primitives only)

There are no `recommend_*`, `analyze_*`, or offline dataset MCP tools (no offline scorers). Chain:

- Inventory: `list_project_agents`, `get_project_agent`, `preview_create_agent`, `confirm_create_agent`, `create_project_agent` (form elicitation **or** preview-token path — human must accept), `update_project_agent`
- Readiness API: `evaluate_agent_readiness` (not an eval run)
- Scope helpers: `get_agent_suggestions`, `get_agent_models`, `get_explore_access_summary`
- Threads (read): `list_agent_threads`, `get_agent_thread` (`includeMessageText=true` to reveal bodies / firstMessage)
- Evaluations: `list_agent_evaluations`, `get_agent_evaluation`, `create_agent_evaluation`, `update_agent_evaluation`, `append_agent_evaluation_prompts`, `delete_agent_evaluation`, `run_agent_evaluation`, `list_agent_evaluation_runs`, `get_agent_eval_run_results` (`includePromptText=true` to reveal prompt text)
- Knowledge documents: `list_agent_documents`, `get_agent_document` (`includeDocumentContent=true` to reveal body), `create_agent_document`, `update_agent_document`, `delete_agent_document` (inline JSON, 20KB max; ADR-0035)

## Agent tags (explore allowlist)

Agent `tags` match dbt/Lightdash explore or field tags (OR). **Explore names are not tags.** Null/empty = all explores. Invented tags that match nothing → zero explores and `TAGS_MATCH_NO_EXPLORES` after create/update. Always call `get_explore_access_summary` with the same tag list before setting tags. Prefer `list_project_agents` and `update_project_agent` over create when an existing agent fits.

## Create confirmation (dual gate)

When the host supports MCP form elicitation, `create_project_agent` shows the permission matrix form (ADR-0033). When it does not (e.g. Cursor coding agents), use `preview_create_agent` → show `confirmationMessage` to the human → `confirm_create_agent` → `create_project_agent` with the same payload and `createConfirmToken` (ADR-0034). Do not skip confirm after preview.

## Secure agent defaults

MCP, CLI, and `agentops apply` create agents with **secure-by-default** permissions (more conservative than the Lightdash UI):

| Capability                                  | Default                       |
| ------------------------------------------- | ----------------------------- |
| Read rows behind chart (`enableDataAccess`) | off                           |
| Create/edit content (`enableContentTools`)  | off                           |
| SQL mode (`enableSqlMode`)                  | off                           |
| User context (`enableUserContext`)          | off                           |
| Visibility (`adminOnly`)                    | on — admins & developers only |

Elevation is **explicit opt-in**. The create form shows the full permission matrix; responses may include `ELEVATED_*` warning codes when capabilities or visibility exceed the baseline.

**Presets for clients:**

| Preset                 | Flags                                                                                    | Use when                           |
| ---------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| **Governed** (default) | all capabilities off, `adminOnly: true`                                                  | Setup, eval authoring, pre-release |
| **Analyst**            | `enableDataAccess: true`, scoped `tags`; widen visibility only after CLI `evaluate-gate` | Production Q&A                     |

Do not enable data access, content tools, SQL mode, user context, or public visibility unless the user explicitly requested elevation.

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
4. Optional other MCP profiles (`semantic-layer`, `content-reader`) for metadata/content fixes.
