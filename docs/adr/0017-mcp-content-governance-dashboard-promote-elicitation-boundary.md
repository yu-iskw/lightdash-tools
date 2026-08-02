# 17. MCP content-governance dashboard promote elicitation boundary

Date: 2026-08-02

## Status

Accepted

Amends [4. Agent-safe exposure](0004-agent-safe-exposure-mcp-cli-vs-client-only.md), [14. MCP content-developer persona](0014-mcp-content-developer-persona-mutation-boundary.md), [15. MCP content-governance persona](0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md)

Related to [6. MCP personas](0006-mcp-personas-shared-registry-fixed-paths.md), [8. MCP request scope and hardening](0008-mcp-request-scope-and-hardening.md), [13. Operation catalog SSOT](0013-operation-catalog-as-sole-agent-surface-ssot.md), [16. Pluggable ephemeral store](0016-mcp-pluggable-ephemeral-store-for-http-preview-sessions-and-oauth.md)

## Context

Agents author content on `content-developer` ([ADR-0014](0014-mcp-content-developer-persona-mutation-boundary.md)) but that persona excludes promote. Operators still need a trustworthy way to release a dashboard from a development/preview project to its configured upstream project ([How to promote content](https://docs.lightdash.com/guides/how-to-promote-content)).

Lightdash exposes `GET /api/v1/dashboards/{dashboardUuidOrSlug}/promoteDiff` and `POST …/promote`. Dashboard promote also creates/updates nested charts, optional spaces, and data-app tiles — high blast radius. Boolean tool arguments and chat “please confirm” are not trustworthy (same rationale as soft-delete in [ADR-0015](0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md)).

MCP form elicitation via multi-round-trip requests ([elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation), [MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)) remains the human-approval boundary.

## Decision

1. Expose dashboard promote on the existing **`content-governance`** persona (not `content-developer`, not a new release persona in v1).
2. **v1 tools:**
   - `get_dashboard_promote_diff` — read-only `promoteDiff`
   - `promote_dashboard` — elicitation-gated `promote`
3. **Dashboard-first only.** Chart-only and SQL-chart promote stay off MCP in v1.
4. **Elicitation-required apply:** `promote_dashboard` reuses the shared elicitation-gated mutation framework (generalized from soft-delete):
   - fails closed without form elicitation;
   - returns `inputRequired` with form fields `decision: confirm_promote | do_not_promote` and typed dashboard name;
   - message summarizes `PromotionChanges` (`create` / `update` / `no changes` counts) and upstream-overwrite consequences;
   - binds HMAC `requestState` to identity + digest of dashboard metadata **and** promoteDiff material;
   - re-fetches dashboard + promoteDiff on accept; digest mismatch → `RESOURCE_CHANGED`;
   - no free-form upstream project UUID (API uses the project’s configured upstream).
5. Catalog SSOT ([ADR-0013](0013-operation-catalog-as-sole-agent-surface-ssot.md)): profile `content-governance`; promote annotated `WRITE_DESTRUCTIVE` with `destructiveHint: true`.
6. One tool call → one dashboard → one elicitation → one promote API call (no bulk).

## Consequences

- Governance agents can inspect promote diffs and release dashboards with a human form gate.
- Content-developer remains authoring-only; playbooks point release work at content-governance.
- Clients without form elicitation cannot promote via MCP (same fail-closed policy as soft-delete).
- Soft-delete and promote share the elicitation framework; operation-specific form schemas and audit statuses stay distinct (`deletion_*` vs `promotion_*`).

## References

- [How to promote content](https://docs.lightdash.com/guides/how-to-promote-content)
- [Promote dashboard API](https://docs.lightdash.com/api-reference/dashboards/promote-dashboard)
- [Get dashboard promotion diff](https://docs.lightdash.com/api-reference/dashboards/get-dashboard-promotion-diff)
- [MCP elicitation (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- Implementation: `packages/mcp/src/destructive/`, `packages/common/src/operations/content-governance.ts`
