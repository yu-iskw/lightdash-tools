# 35. MCP ai-agent-ops agent knowledge document CRUD

Date: 2026-08-27

## Status

Accepted

Amends [18. MCP ai-agent-ops profile thin API boundary](0018-mcp-ai-agent-ops-profile-thin-api-boundary.md)

Related to [11. MCP tool response sensitivity classes](0011-mcp-tool-response-sensitivity-classes.md), [33. MCP ai-agent-ops project agent create and update](0033-mcp-ai-agent-ops-project-agent-create-and-update.md)

## Context

Lightdash AI agents support **knowledge documents** — inline glossaries, SOPs, and business context uploaded via JSON (`POST …/aiAgents/{agentUuid}/documents`), distinct from dbt `ai_hint` metadata and agent `instruction` strings. Product docs cap documents at **20KB** each and warn that content is visible to everyone who can use the agent ([knowledge documents](https://docs.lightdash.com/agents/effective-analytics-with-agents#knowledge-documents)).

The ai-agent-ops loop playbook already prioritizes “curate knowledge/verified examples” before instruction patches, but MCP exposed no document APIs — hosts had to use the Lightdash UI or raw REST.

Org-level `POST /api/v1/aiAgents/documents` is deprecated for scoping; the agent-scoped route is the supported path.

## Decision

1. Add **five thin tools** to **`ai-agent-ops`** v1 only (not `ai-agent-chat`):
   - `list_agent_documents` — `GET …/documents` (summaries)
   - `get_agent_document` — `GET …/documents/{uuid}/content`
   - `create_agent_document` — `POST …/documents`
   - `update_agent_document` — `PATCH …/content` and/or `PATCH …/documents/{uuid}` settings
   - `delete_agent_document` — `DELETE …/documents/{uuid}`
2. **Client:** `AiAgentsDocumentsClient` in `@lightdash-tools/client`; facade passthrough on `v1.aiAgents`.
3. **Annotations:** create/update = `WRITE_NONDESTRUCTIVE`; delete = `WRITE_DESTRUCTIVE` (reversible by re-upload).
4. **No preview/confirm gate** on v1 (unlike agent create, ADR-0034). Attach soft warnings instead:
   - `KNOWLEDGE_VISIBLE_TO_AGENT_USERS` on create/update
   - `DOCUMENT_ALWAYS_IN_CONTEXT` when `alwaysIncludeInContext === true`
5. **Sensitivity:** redact document `content` by default on `get_agent_document`; opt-in `includeDocumentContent=true` ([ADR-0011](0011-mcp-tool-response-sensitivity-classes.md)).
6. **Preflight:** reject content over 20KB before upstream call; allowed mime types `text/markdown`, `text/plain`. Host passes inline `content` — **no MCP server `filePath`**.
7. **Out of scope:** org-level document routes, multipart upload, CLI commands (client-only acceptable per [ADR-0004](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).

### Architecture

```mermaid
flowchart LR
  host[HostAgent] --> mcp[ai_agent_ops_MCP]
  mcp --> client["@lightdash-tools/client"]
  client --> api["Lightdash …/documents"]
```

## Consequences

- Hosts can complete the knowledge-curation step of the ai-agent-ops loop without leaving MCP.
- Profile tool count rises by five; wire names remain under the 60-character limit.
- Sensitive business prose may enter agent transcripts when hosts opt in to `includeDocumentContent`.
- GitOps bundles do not yet declare documents; MCP/REST is the v1 automation path.
- Implementation: [`documents.ts`](../../packages/mcp/src/tools/ai-agents/documents.ts), [`documents.ts` client](../../packages/client/src/api/v1/ai-agents/documents.ts).

## References

- [AI agent-ops inventory](../profiles/ai-agent-ops/inventory.md)
- [AI agent-ops loop](../profiles/ai-agent-ops/loop.md)
- [Lightdash knowledge documents](https://docs.lightdash.com/agents/effective-analytics-with-agents#knowledge-documents)
