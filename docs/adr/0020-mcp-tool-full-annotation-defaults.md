# 20. MCP tool full annotation defaults

Date: 2026-02-11

## Status

Accepted

## Context

ADR-0018 introduced MCP tool annotations and set default annotations in `packages/mcp` (`readOnlyHint: true`, `openWorldHint: false`). The MCP specification defines five tool annotations; we omitted `destructiveHint` and `idempotentHint`. When omitted, clients may assume spec defaults (destructiveHint true, idempotentHint false), which is inaccurate for our read-only list/get tools.

## Decision

Set full defaults in `DEFAULT_ANNOTATIONS` in [packages/mcp/src/tools/shared.ts](../../packages/mcp/src/tools/shared.ts): add `destructiveHint: false` and `idempotentHint: true` in addition to the existing `readOnlyHint: true` and `openWorldHint: false`. All current tools are read-only and idempotent (same arguments yield same result). Single source of truth; future read-only tools get correct hints by default.

## Consequences

- **Easier**: Clients receive explicit, accurate hints for display and approval; no reliance on spec defaults for these two fields.
- **No behavior change**: Tool logic unchanged; only metadata in `tools/list` responses.

## References

- GitHub: Issue #46 (parent), sub-issues #47 (ADR/OpenSpec), #48 (Implementation), #49 (Changelog)
- OpenSpec: `docs/openspec/changes/mcp-tools-full-annotation-defaults/`
- ADR-0018: MCP tool naming prefix and tool annotations
