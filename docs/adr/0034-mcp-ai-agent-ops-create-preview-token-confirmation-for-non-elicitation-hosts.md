# 34. MCP ai-agent-ops create preview-token confirmation for non-elicitation hosts

Date: 2026-08-27

## Status

Accepted

Amends [33. MCP ai-agent-ops project agent create and update](0033-mcp-ai-agent-ops-project-agent-create-and-update.md)

Related to [14. MCP content-developer profile mutation boundary](0014-mcp-content-developer-profile-mutation-boundary.md), [15. MCP content-governance elicitation](0015-mcp-content-governance-profile-elicitation-required-soft-delete-boundary.md), [19. MCP stateless protocol core without Redis ephemeral store](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)

## Context

[ADR-0033](0033-mcp-ai-agent-ops-project-agent-create-and-update.md) gated `create_project_agent` on MCP form elicitation (MRTR `InputRequiredResult` + HMAC `requestState`), mirroring content-governance deletes. Coding-agent hosts such as Cursor declare no `elicitation.form` capability, so the gate returned `ELICITATION_REQUIRED` before any confirmation UI — blocking the ai-agent-ops loop (discover explores → create agent → eval) entirely over MCP.

Content-developer ([ADR-0014](0014-mcp-content-developer-profile-mutation-boundary.md)) already supports non-elicitation hosts via client-carried HMAC preview tokens (`preview_*` → `confirm_preview` → apply). That pattern binds human approval to a payload digest and principal; it is not a chat boolean (`confirmed: true`), which ADR-0015 rejects.

Agent create is write-nondestructive (not destructive delete), but still requires explicit human review of the permission matrix before elevation.

## Decision

1. **Dual-gate create:** `create_project_agent` accepts confirmation via **either**:
   - **Form elicitation** when `supportsFormElicitation()` is true (unchanged ADR-0033 path), **or**
   - **Preview-token path** when form elicitation is absent: `preview_create_agent` → `confirm_create_agent` → `create_project_agent` with validated `createConfirmToken`.
2. **New tools** on `ai-agent-ops` v1 only:
   - `preview_create_agent` — mints draft `createPreviewToken`, returns permission summary + explore tag preview + elevation preview warnings (no upstream write).
   - `confirm_create_agent` — upgrades draft token to validated `createConfirmToken` (no upstream write).
3. **Token binding:** HMAC-signed claims bind `subject`, `projectUuid`, agent `name`, and `payloadDigest` from shared `digestCreateAgentPayload` ([`create-elicitation.ts`](../../packages/mcp/src/tools/ai-agents/create-elicitation.ts)). Apply verifies token status `validated` and digest match; mismatch → `CREATE_PREVIEW_STALE`. Same signing key as other MCP signed state ([ADR-0019](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)).
4. **Fail closed without token:** when form elicitation is absent and `createConfirmToken` is missing or invalid, return `PREVIEW_REQUIRED` (not `ELICITATION_REQUIRED`) with guidance to call `preview_create_agent` first.
5. **Update unchanged:** `update_project_agent` remains ungated. Agent delete stays CLI-only.
6. **Security parity:** preview-token path is not a weaker chat confirm — the agent must not call `confirm_create_agent` until the human approves the preview summary shown out-of-band (host chat/UI).

## Consequences

- Cursor and other non-elicitation MCP hosts can complete agent create over MCP without CLI fallback.
- Form-elicitation-capable clients keep the existing MRTR UX; no regression.
- Profile tool count rises by two (`preview_create_agent`, `confirm_create_agent`).
- Hosts must follow preview → confirm → create ordering; skipping confirm is blocked at apply.
- Duplicate create remains non-idempotent; ambiguous failures must not blind-retry.
- Implementation: [`create-agent-preview.ts`](../../packages/mcp/src/policy/create-agent-preview.ts), [`gate-create-project-agent.ts`](../../packages/mcp/src/tools/ai-agents/gate-create-project-agent.ts).

## References

- [AI agent-ops inventory](../profiles/ai-agent-ops/inventory.md)
- [AI agent-ops loop](../profiles/ai-agent-ops/loop.md)
- [Content-developer preview ledger](../../packages/mcp/src/policy/preview-ledger.ts)
