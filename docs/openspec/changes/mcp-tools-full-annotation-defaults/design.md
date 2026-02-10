# Design: MCP tool full annotation defaults

## Context

- [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) defines `DEFAULT_ANNOTATIONS` with `readOnlyHint: true` and `openWorldHint: false`. `mergeAnnotations` merges per-tool overrides with these defaults.
- MCP spec: [Available tool annotations](https://modelcontextprotocol.io/legacy/concepts/tools#available-tool-annotations) include destructiveHint (default true) and idempotentHint (default false). For read-only list/get tools, we want destructiveHint false and idempotentHint true.

## Goals

- Explicit defaults for all five annotations so clients get accurate hints without relying on spec defaults.
- No call-site or domain-module changes.

## Decisions

- **Extend DEFAULT_ANNOTATIONS**: Add `destructiveHint: false` and `idempotentHint: true` to the constant in shared.ts. Result: `{ readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true }`. No other code changes.

## Migration

- Update the constant; run build and tests; add changelog fragment.
