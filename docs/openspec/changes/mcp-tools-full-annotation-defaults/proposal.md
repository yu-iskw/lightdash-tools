# Proposal: MCP tool full annotation defaults

## Why

ADR-0018 set default annotations for read-only tools (`readOnlyHint: true`, `openWorldHint: false`) but did not set `destructiveHint` or `idempotentHint`. The MCP specification defines five annotations; when omitted, clients may use spec defaults (destructiveHint true, idempotentHint false), which is inaccurate for our read-only list/get tools. Setting full defaults aligns with the spec and gives clients explicit, accurate hints.

## What Changes

- Extend `DEFAULT_ANNOTATIONS` in [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) with `destructiveHint: false` and `idempotentHint: true`. No changes to domain modules or tool names.

## Capabilities

- **mcp-tools-full-annotation-defaults**: Default annotations for read-only tools SHALL include all five MCP annotation hints where applicable: readOnlyHint true, openWorldHint false, destructiveHint false, idempotentHint true (and title per-tool at call sites).

## Impact

- **Code**: One constant in [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) only.
- **Behavior**: `tools/list` responses include explicit destructiveHint and idempotentHint; no change to tool invocation.

## References

- ADR-0020: MCP tool full annotation defaults
- GitHub Issue: #46 (parent), #47 (ADR/OpenSpec), #48 (Implementation), #49 (Changelog)
