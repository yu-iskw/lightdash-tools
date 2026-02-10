# Design: MCP tool prefix and annotations

## Context

- [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) currently exports `registerToolSafe(server, name, options, handler)` with `ToolOptions = { description, inputSchema }`. Domain modules pass the full tool name and no annotations.
- MCP spec: tool names 1–128 chars; optional `title` and `annotations` on tool definitions. See [Tool annotations](https://modelcontextprotocol.io/legacy/concepts/tools#tool-annotations).

## Goals

- Single source of truth for the prefix; call sites pass short names only.
- All tools get default annotations (read-only, closed-world); per-tool overrides supported.
- Each tool has a human-readable `title` for client display.

## Decisions

### Decision 1: Prefix and shared helper

- **TOOL_PREFIX**: Export constant `TOOL_PREFIX = 'lightdash_tools__'` from shared.ts.
- **registerToolSafe**: Signature becomes `(server, shortName, options, handler)`. Build `name = TOOL_PREFIX + shortName`. Pass to SDK `registerTool(name, { description, inputSchema, title, annotations }, handler)`.
- **ToolOptions**: Extend with optional `title?: string` and `annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }`.
- **Defaults**: `DEFAULT_ANNOTATIONS = { readOnlyHint: true, openWorldHint: false }`. Merge with `options.annotations` (per-tool wins).

### Decision 2: Tool list and titles

| Short name                | Title                     |
| ------------------------- | ------------------------- |
| list_projects             | List projects             |
| get_project               | Get project               |
| list_charts               | List charts               |
| list_dashboards           | List dashboards           |
| list_spaces               | List spaces               |
| get_space                 | Get space                 |
| list_organization_members | List organization members |
| get_member                | Get member                |
| list_groups               | List groups               |
| get_group                 | Get group                 |

All current tools keep default annotations (readOnlyHint true, openWorldHint false). No destructive or idempotent overrides needed.

### Decision 3: Domain modules

- Each call to `registerToolSafe(server, 'short_name', { description, inputSchema, title: 'Human Title' }, handler)` — title required for display; annotations optional (defaults applied).

## Migration

- Update shared.ts (prefix, ToolOptions, merge logic); update all six domain files to pass short name and title; run build and tests; add changelog fragment.
