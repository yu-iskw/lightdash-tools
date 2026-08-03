# 15. MCP content-governance persona elicitation-required soft-delete boundary

Date: 2026-08-02

## Status

Accepted

Amends [4. Agent-safe exposure](0004-agent-safe-exposure-mcp-cli-vs-client-only.md), [6. MCP personas](0006-mcp-personas-shared-registry-fixed-paths.md), [14. MCP content-developer persona](0014-mcp-content-developer-persona-mutation-boundary.md)

Related to [8. MCP request scope and hardening](0008-mcp-request-scope-and-hardening.md), [13. Operation catalog SSOT](0013-operation-catalog-as-sole-agent-surface-ssot.md)

Amended by [17. MCP content-governance dashboard promote elicitation boundary](0017-mcp-content-governance-dashboard-promote-elicitation-boundary.md)

Amended by [19. MCP stateless protocol core without Redis ephemeral store](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)

## Context

Agents sometimes need to remove project-scoped charts and dashboards. Boolean tool arguments (`confirmed: true`) and chat “please confirm” are not trustworthy: the model can supply them without a human. Content-developer ([ADR-0014](0014-mcp-content-developer-persona-mutation-boundary.md)) deliberately excludes hard delete and forbids destructive mutability.

Lightdash exposes soft-delete (`DELETE /api/v2/projects/{projectUuid}/saved/{chartUuidOrSlug}` and the dashboard twin) plus restore and permanent purge under `/api/v2/content/...`. Soft-delete is reversible via restore; permanent purge is irrecoverable.

MCP 2026-07-28 multi-round-trip requests (MRTR) let a tool return `InputRequiredResult` with an embedded `elicitation/create` form; the client retries with `inputResponses` and opaque `requestState`. Form elicitation is the human-approval boundary.

## Decision

1. Ship a **`content-governance`** persona at fixed path `/content-governance/v1/mcp` with MCP server display name **`lightdash-mcp-gov`**. Stdio: `lightdash-mcp content-governance`.
2. **Soft-delete on MCP:** `delete_chart` and `delete_dashboard` via the v2 project saved-chart / dashboard DELETE endpoints. Permanent purge, space delete, and org-level deletes remain **client-only / never-expose**. Dashboard promote is also on this persona ([ADR-0017](0017-mcp-content-governance-dashboard-promote-elicitation-boundary.md)); it is not limited to soft-delete alone.
3. **Elicitation-required confirmation:** every destructive/release write uses a shared elicitation-gated mutation framework that:
   - fails closed when the client lacks form elicitation capability;
   - returns `inputRequired({ inputRequests: { …: inputRequired.elicit(...) }, requestState })` (not deprecated `elicitInput`);
   - binds approval to resource identity + precondition digest in signed `requestState` (`LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY`);
   - requires `action === accept`, an operation-specific `decision` enum, and typed resource name match;
   - revalidates the target immediately before the mutating API call;
   - returns a structured receipt (or declined/cancelled/blocked outcomes).
   - Does **not** use a server-side one-shot confirmation claim store ([ADR-0019](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)); TTL + principal binding + precondition re-fetch bound replay.
4. **Do not** expose soft-delete or promote on semantic-layer, organization-audit, content-reader, or content-developer.
5. Catalog SSOT ([ADR-0013](0013-operation-catalog-as-sole-agent-surface-ssot.md)): profile `content-governance`; annotations `WRITE_DESTRUCTIVE` with `destructiveHint: true` for mutating tools.
6. No bulk delete in v1 (one tool call → one resource → one elicitation → one API call).

## Consequences

- Fifth HTTP persona path; OAuth PRM stays persona-path-aware via `listPersonaPaths()`.
- Content-developer remains authoring-only; governance agents opt into soft-delete and (per ADR-0017) dashboard promote.
- Clients without form elicitation cannot delete or promote via MCP (safe refusal, not a weaker confirmation path).
- Requires widening `registerToolSafe` to pass through `InputRequiredResult` and threading `ServerContext` into destructive handlers.
- Soft-delete is classified as reversible destructive under ADR-0004 when gated by elicitation; permanent purge stays irrecoverable / client-only.

## References

- [MCP elicitation (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP MRTR / InputRequiredResult](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- Implementation: `packages/mcp/src/destructive/`, `packages/mcp/src/personas/content-governance/`, `packages/common/src/operations/content-governance.ts`
