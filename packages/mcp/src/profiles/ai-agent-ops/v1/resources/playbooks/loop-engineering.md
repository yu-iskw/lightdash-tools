# AI agent-ops — loop engineering

URI: `lightdash://playbooks/ai-agent-ops/loop-engineering`

## Loop (host-owned)

1. Snapshot intent: record agent UUID + version from `get_project_agent`
2. Baseline: product evaluation run via MCP
3. Analyze failures in the host (instruction vs tags vs semantic metadata vs access)
4. Intervene outside this profile:
   - Semantic / AI hints → optional `semantic-layer` MCP or out-of-band
   - Content → optional `content-reader` / developer workflows
   - Agent instruction/flags → prefer `update_project_agent`; create only after `list_project_agents`. **Form hosts:** `create_project_agent` (human form). **Non-form hosts:** `preview_create_agent` → human approves permission + space scope summary → `confirm_create_agent` → `create_project_agent` with `createConfirmToken` (verify tags via `get_explore_access_summary`; discover `spaceAccess` UUIDs via `content-reader` `list_spaces` first). Default create is governed (all capabilities off, adminOnly on) — enable `enableDataAccess` only when eval runs need warehouse rows
   - Agent config bundles as Git → CLI `agentops plan|apply`
5. Regress with focused then full evaluation runs
6. Gate with CLI `agentops evaluate-gate`
7. Stop after gates pass, no safe intervention remains, or 3 iterations

## Priority of interventions

```text
correct semantic fact
→ improve metadata/AI hints
→ adjust tags/scope (verify with get_explore_access_summary; heed TAGS_MATCH_NO_EXPLORES)
→ adjust spaceAccess (discover UUIDs with content-reader list_spaces; heed SPACES_NOT_IN_PROJECT)
→ curate knowledge via `list_agent_documents` / `create_agent_document` / `update_agent_document` (inline JSON, 20KB max; not warehouse data)
→ curate verified examples
→ revise instruction via update_project_agent / agentops/CLI
```

Do not recommend prompt patches when semantic metadata is demonstrably wrong.
Do not invent agent tags that are not present on explores — empty scope looks like “no explores configured” at eval time.
Do not invent space UUIDs — copy from `content-reader` `list_spaces` / `get_space` or an existing agent via `get_project_agent`.
