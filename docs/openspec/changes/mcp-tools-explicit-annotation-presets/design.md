# Design: MCP tool explicit annotation presets at call site

## Context

- [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) defines `DEFAULT_ANNOTATIONS` and `mergeAnnotations`. Tool modules call `registerToolSafe(server, shortName, { title, description, inputSchema }, handler)` without passing `annotations`.
- Goal: visibility of hints at each tool definition; correctness for the single write tool (`upsert_chart_as_code`).

## Preset names and types

- **READ_ONLY_DEFAULT**: `ToolAnnotations` with readOnlyHint true, openWorldHint false, destructiveHint false, idempotentHint true. Same shape as current DEFAULT_ANNOTATIONS; exported for use at call site.
- **WRITE_IDEMPOTENT**: `ToolAnnotations` with readOnlyHint false, destructiveHint false, idempotentHint true, openWorldHint false. Used for create/update tools that are idempotent (e.g. upsert by slug).

## Decisions

- Export `READ_ONLY_DEFAULT` and `WRITE_IDEMPOTENT` from shared.ts. Keep `mergeAnnotations(options.annotations)` so passing a preset (or partial override) works.
- Every `registerToolSafe` call receives `annotations: READ_ONLY_DEFAULT` or `annotations: WRITE_IDEMPOTENT`. Tool modules import presets from `./shared.js`.
- JSDoc on registerToolSafe or ToolOptions: recommend passing annotations explicitly (preset or override).

## Migration

- Add exports and JSDoc in shared.ts; add annotations to each registerToolSafe call in charts, explores, query, users, groups, dashboards, spaces, projects; run build and tests; add changelog fragment.
