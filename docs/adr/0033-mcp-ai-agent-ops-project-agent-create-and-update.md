# 33. MCP ai-agent-ops project agent create and update

Date: 2026-08-27

## Status

Accepted

Amends [18. MCP ai-agent-ops profile thin API boundary](0018-mcp-ai-agent-ops-profile-thin-api-boundary.md)

Related to [15. MCP content-governance elicitation](0015-mcp-content-governance-profile-elicitation-required-soft-delete-boundary.md) (form elicitation pattern reused for create only)

Amended by [34. MCP ai-agent-ops create preview-token confirmation for non-elicitation hosts](0034-mcp-ai-agent-ops-create-preview-token-confirmation-for-non-elicitation-hosts.md)

## Context

[ADR-0018](0018-mcp-ai-agent-ops-profile-thin-api-boundary.md) deferred agent create/update/delete on MCP so the profile stayed read-heavy and GitOps/CLI owned mutations. Hosts building agents for evaluation loops (discover explores → create agent → readiness → eval run → chat) had to leave MCP for `lightdash-tools agents create` even though the client already wraps project-scoped create/update APIs.

Delete remains higher risk (orphaned threads, irreversible config loss) and is not required for the improve loop. Thread generate stays on `ai-agent-chat` ([ADR-0029](0029-mcp-ai-agent-chat-profile-conversation-boundary.md)).

Agent `tags` are an explore/field allowlist in Lightdash ([data access](https://docs.lightdash.com/guides/ai-agents/data-access)), not free-form labels. Invented tags that match no explores yield a silent empty data model unless hosts are warned.

Boolean or chat “please confirm” is not a trustworthy create gate ([ADR-0015](0015-mcp-content-governance-profile-elicitation-required-soft-delete-boundary.md)).

## Decision

1. Add **`create_project_agent`** and **`update_project_agent`** to **`ai-agent-ops`** v1 only. Mount via shared [`agents.ts`](../../packages/mcp/src/tools/ai-agents/agents.ts) ToolModules; do **not** mount on `ai-agent-chat`.
2. **Annotations:** `WRITE_NONDESTRUCTIVE` ([ADR-0008](0008-mcp-request-scope-and-hardening.md)). Project scope unchanged: pin → tool `projectUuid` → allowlist ceiling.
3. **Schema:** flat host-friendly fields (name, instruction, access flags, tags, access lists, `mcpServerUuids`). Server builds full `CreateAiAgent` / partial `UpdateAiAgent` bodies via shared **`resolveSecureAgentCreateFlags`** in `@lightdash-tools/common` (MCP, CLI `agents create`, and `agentops apply`). **Secure create defaults** (more conservative than Lightdash UI): `enableDataAccess`, `enableContentTools`, `enableSqlMode`, and `enableUserContext` default **off**; `adminOnly` defaults **on** (admins & developers only). Elevation is explicit opt-in. **Out of MCP v1:** `integrations`, `imageUrl`, `modelConfig` — CLI `--file` / `agentops apply`.
4. **Create elicitation:** `create_project_agent` requires MCP form elicitation (`confirm_create` / `do_not_create`) with HMAC `requestState` bound to a create-payload digest (`LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY`). The confirm form shows the full permission matrix (UI-aligned labels). Fail closed with `ELICITATION_REQUIRED` when the client lacks form capability. **Update is not elicitation-gated.**
5. **Tag soft warnings:** after successful create (post-accept) or update that sets tags, if non-empty tags yield an empty `explore-access-summary`, attach `TAGS_MATCH_NO_EXPLORES` (mutation still succeeds). Summary failures attach `EXPLORE_ACCESS_SUMMARY_UNAVAILABLE`. Null/empty tags skip the check (all explores).
6. **Permission elevation warnings:** after create or update that sets elevated capabilities or visibility, attach `ELEVATED_*` codes (`ELEVATED_DATA_ACCESS`, `ELEVATED_CONTENT_TOOLS`, `ELEVATED_SQL_MODE`, `ELEVATED_USER_CONTEXT`, `ELEVATED_PUBLIC_VISIBILITY`, `ELEVATED_CONTENT_WITHOUT_DATA`). Mutation still succeeds.
7. **Still off MCP:** `deleteAgent`, thread create/generate, org admin agent settings. Delete stays CLI / GitOps.
8. Playbook invariant `no-agent-crud` becomes **`no-agent-delete`**. Add **`secure-agent-defaults`**. Loop engineering may use MCP patch before GitOps bundles.

## Consequences

- Hosts can stand up jaffle-style analysts (instruction + explicit `enableDataAccess: true`) without leaving `ai-agent-ops`, but **only after a human accepts the create form** showing the permission matrix.
- Minimal creates no longer inherit permissive Lightdash UI defaults for omitted capability flags.
- Clients without form elicitation cannot create agents via MCP (safe refusal).
- Duplicate create is not idempotent — hosts must not blind-retry after ambiguous failures.
- Invented agent tags no longer fail silently at eval time without a warning code.
- Advanced agent config still flows through CLI/GitOps; MCP surface stays bounded.
- Profile tool count rises by two; wire names remain under the 60-character limit.
- Stdio/HTTP with `ai-agent-ops` mounted requires `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` (same secret as preview/destructive).

## References

- [AI agent-ops inventory](../profiles/ai-agent-ops/inventory.md)
- [Client agents API](../../packages/client/src/api/v1/ai-agents/agents.ts)
- [Secure create defaults](../../packages/common/src/ai-agents/secure-create-defaults.ts)
- [Lightdash AI agent data access](https://docs.lightdash.com/guides/ai-agents/data-access)
