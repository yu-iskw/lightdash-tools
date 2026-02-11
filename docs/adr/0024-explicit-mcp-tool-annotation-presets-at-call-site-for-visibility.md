# 24. Explicit MCP tool annotation presets at call site for visibility

Date: 2026-02-11

## Status

Accepted

## Context

ADR-0018 and ADR-0020 introduced MCP tool annotations and full default annotations in `packages/mcp/src/tools/shared.ts`. Tool hints (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) live in `DEFAULT_ANNOTATIONS`; tool files do not pass `annotations`, so behavior is opaque at the call site. One tool (`upsert_chart_as_code`) is a write and is currently mis-represented by read-only defaults.

## Decision

1. **Export named presets** from [packages/mcp/src/tools/shared.ts](../../packages/mcp/src/tools/shared.ts): `READ_ONLY_DEFAULT` (readOnlyHint true, openWorldHint false, destructiveHint false, idempotentHint true) and `WRITE_IDEMPOTENT` (readOnlyHint false, destructiveHint false, idempotentHint true, openWorldHint false).
2. **Require every `registerToolSafe` call** to pass `annotations: <preset>` so hints are visible at each tool definition.
3. **Keep `mergeAnnotations`** so presets remain the single source of truth; per-tool overrides (e.g. custom title) still possible.
4. **Use `WRITE_IDEMPOTENT`** only for `upsert_chart_as_code`; all other tools use `READ_ONLY_DEFAULT`.

## Consequences

- **Easier**: Visibility at call site; readers see each tool's hints without opening shared.ts; correct hints for the write tool; one place to tune presets.
- **Boilerplate**: Each tool registration gains one property (`annotations: READ_ONLY_DEFAULT` or `WRITE_IDEMPOTENT`).

## References

- OpenSpec: `docs/openspec/changes/mcp-tools-explicit-annotation-presets/`
- ADR-0018: MCP tool naming prefix and tool annotations
- ADR-0020: MCP tool full annotation defaults
