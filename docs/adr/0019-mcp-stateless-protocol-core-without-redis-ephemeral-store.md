# 19. MCP stateless protocol core without Redis ephemeral store

Date: 2026-08-03

## Status

Accepted

Supercedes [16. MCP pluggable ephemeral store for HTTP preview sessions and OAuth](0016-mcp-pluggable-ephemeral-store-for-http-preview-sessions-and-oauth.md)

Amends [7. MCP HTTP transport, OAuth broker, SDK v2](0007-mcp-http-transport-auth-modes-sdk-v2.md), [12. MCP content-reader persona](0012-mcp-content-reader-persona-saved-content-execution-boundary.md), [14. MCP content-developer persona](0014-mcp-content-developer-persona-mutation-boundary.md), [15. MCP content-governance soft-delete](0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md), [17. MCP content-governance promote](0017-mcp-content-governance-dashboard-promote-elicitation-boundary.md)

## Context

MCP [2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) is a request/response **stateless protocol**: `initialize` / `Mcp-Session-Id` are retired; any request may land on any replica behind a plain load balancer ([statelessness](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#statelessness)). Cross-call application state must use **explicit client-carried handles** (tool args), not transport sessions. MRTR `requestState` is the designed mid-call opaque blob with HMAC/AEAD integrity ([MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)).

ADR-0016 introduced `LIGHTDASH_TOOLS_MCP_STORE=memory|redis` so multi-instance HTTP could share preview ledger, OAuth pending, and a session index. That recreated sticky/shared-store operational cost the protocol revision removes. Handles must not be treated as authentication; bind them to the authenticated principal ([state handle hijacking](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices#state-handle-hijacking)).

OAuth authorization codes remain an AS concern ([RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html)), not MCP transport state. Building multi-instance OAuth without a store is a separate change (signed state / CIMD).

## Decision

1. **No Redis / no pluggable ephemeral store.** Remove `LIGHTDASH_TOOLS_MCP_STORE`, `LIGHTDASH_TOOLS_MCP_REDIS_URL`, the `redis` dependency, and all Redis adapters. ADR-0016 is superseded.
2. **Sessionless Streamable HTTP.** Do not keep a process `SessionStore` or `Mcp-Session-Id` affinity for correctness. Each MCP HTTP request is self-contained (SDK sessionless / per-request transport).
3. **Content-developer preview gate = HMAC-signed `previewToken`.** Mint with SDK `createRequestStateCodec` (same key pattern as destructive `requestState`). Token carries subject, project, resource bindings, `contentHash` of `{proposed,baseline}`, and `draft`|`validated` — **not** the full proposed payload. `confirm_preview` returns a new validated token (no server write). Apply tools require the validated token + the same proposed body (hash match) + baseline re-check. No server ledger, no CAS/`applying`/`reconciliation_required`.
4. **Destructive one-shot claims.** Keep MRTR + HMAC `requestState`. Drop server-side confirmation-claim store; accept TTL-bounded replay mitigated by precondition re-fetch (`RESOURCE_CHANGED`).
5. **Query handles.** Lightdash `queryUuid` is the handle. Drop transport-session ownership of the query ledger. Per-process query budget remains best-effort.
6. **OAuth broker.** Keep **in-memory** pending/codes/DCR only. MCP persona paths scale horizontally; `/oauth/*` may need a single replica or sticky routing until a later signed-state/CIMD change.

## Consequences

- Operators can run multi-replica MCP behind round-robin without Redis or sticky MCP sessions for preview/`requestState` (client-carried HMAC handles).
- Preview/apply works across replicas because state is in the signed token + tool args.
- Promote/soft-delete may be replayed within `requestState` TTL; upstream revalidation is the primary guard.
- Content-governance **form elicitation capability** from `initialize` is remembered in a principal-scoped **process-local** cache and seeded onto each fresh `McpServer` (2025-era SDK shim needs connection-scoped caps). Same-replica HTTP works after `initialize` → `tools/call`; multi-replica without sticky routing should send per-request `_meta[io.modelcontextprotocol/clientCapabilities]` or pin content-governance to one replica.
- OAuth authorize→callback→token remains process-local (document sticky `/oauth/*` or single instance).
- Breaking: remove Redis env vars; rename preview handle to `previewToken`; clients must re-send proposed on apply (already the case for write tool args).

## References

- [MCP 2026-07-28 blog](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP statelessness](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#statelessness)
- [MCP MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- Implementation: `packages/mcp/src/policy/preview-ledger.ts`, `packages/mcp/src/transports/streamable-http.ts`, `packages/mcp/src/auth/oauth-broker/`
