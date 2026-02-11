# Proposal: MCP tool explicit annotation presets at call site

## Why

ADR-0018 and ADR-0020 set default annotations in `shared.ts`; tool files do not pass `annotations`, so hints are invisible at the call site and readability is reduced. One tool (`upsert_chart_as_code`) is a write and is currently mis-represented by read-only defaults. Explicit presets at every registration improve transparency and correctness.

## What Changes

- Export named presets from [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts): `READ_ONLY_DEFAULT` and `WRITE_IDEMPOTENT`.
- Add `annotations: READ_ONLY_DEFAULT` or `annotations: WRITE_IDEMPOTENT` to every `registerToolSafe` call in all nine tool modules (charts, explores, query, users, groups, dashboards, spaces, projects).
- Only `upsert_chart_as_code` uses `WRITE_IDEMPOTENT`; all others use `READ_ONLY_DEFAULT`.

## Capabilities

- **mcp-tools-explicit-annotation-presets**: Every MCP tool registration SHALL pass an explicit `annotations` preset (READ_ONLY_DEFAULT or WRITE_IDEMPOTENT) so hints are visible at the call site; shared.ts SHALL export these presets; mergeAnnotations SHALL continue to merge preset with optional overrides.

## Impact

- **Code**: [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) (export presets); [packages/mcp/src/tools/charts.ts](../../../../packages/mcp/src/tools/charts.ts), explores.ts, query.ts, users.ts, groups.ts, dashboards.ts, spaces.ts, projects.ts (add annotations to each registerToolSafe call).
- **Behavior**: No change to tool invocation; `tools/list` continues to return correct annotations, with write tool correctly marked via WRITE_IDEMPOTENT.

## References

- ADR-0024: Explicit MCP tool annotation presets at call site for visibility
- ADR-0018, ADR-0020
