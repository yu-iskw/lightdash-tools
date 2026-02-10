# Proposal: MCP tool naming prefix and tool annotations

## Why

When multiple MCP servers are connected to a host (e.g. Claude Desktop), tool names can clash. The MCP specification recommends prefixing tool names for disambiguation. In addition, the spec supports optional tool annotations (title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint) so clients can show human-readable titles and approval cues. The Lightdash MCP server currently uses short names (e.g. `list_charts`) and no annotations.

## What Changes

- **Prefix**: Every MCP tool name SHALL use the server-side prefix `lightdash_tools__` (e.g. `list_charts` → `lightdash_tools__list_charts`). Registration accepts a short name; a shared helper builds the full name.
- **Annotations**: Tool definitions SHALL support optional `title` and `annotations`. Default annotations for current tools: read-only, non-destructive, closed-world. Per-tool overrides allowed.

## Capabilities

- **mcp-tools-prefix**: All tool names SHALL use the prefix `lightdash_tools__`; the shared registration helper SHALL accept a short name and build the full name.
- **mcp-tools-annotations**: Tool definitions SHALL support optional `title` and `annotations` (readOnlyHint, destructiveHint, idempotentHint, openWorldHint); defaults SHALL be applied in the shared helper with per-tool overrides.

## Impact

- **Code**: [packages/mcp/src/tools/shared.ts](../../../../packages/mcp/src/tools/shared.ts) gains `TOOL_PREFIX`, extended `ToolOptions`, and updated `registerToolSafe(server, shortName, options, handler)`. All six domain modules pass short names and optional title/annotations.
- **Behavior**: Tool names visible to clients change to prefixed form; annotations appear in `tools/list` responses. Clients that invoke tools by name must use the new prefixed names.

## References

- ADR-0018: MCP tool naming prefix and tool annotations
- GitHub Issue: #41 (parent), #42 (ADR/OpenSpec), #43 (Implementation), #44 (Changelog)
