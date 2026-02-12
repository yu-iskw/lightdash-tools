# 18. MCP tool naming prefix and tool annotations

Date: 2026-02-11

## Status

Amended by [24. Explicit MCP tool annotation presets at call site for visibility](0024-explicit-mcp-tool-annotation-presets-at-call-site-for-visibility.md)

## Context

Multiple MCP servers can be connected to a single host (e.g. Claude Desktop); tool names must be disambiguated to avoid clashes. The MCP specification recommends prefixing tool names (e.g. with a server or user-defined name) and supports optional tool annotations (title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint) so clients can show human-readable titles and approval hints. The Lightdash MCP server in `packages/mcp` currently registers tools with short names (e.g. `list_charts`, `get_project`) and no annotations.

## Decision

1. **Naming prefix**: Use a server-side prefix `lightdash_tools__` for every MCP tool name. Registration accepts a short name (e.g. `list_charts`); the shared helper builds the full name as `TOOL_PREFIX + shortName`. This ensures unique tool names when the Lightdash server is used alongside other MCP servers.

2. **Tool annotations**: Add optional `title` and `annotations` to the tool registration options. The shared registration helper merges per-tool options with defaults: `readOnlyHint: true`, `openWorldHint: false` (all current tools are read-only and talk only to the configured Lightdash backend). Per-tool overrides win. Each tool gets a human-readable `title` for client display (e.g. "List charts", "Get project").

## Consequences

- **Easier**: Unique tool names when combined with other servers; clients get clear titles and approval hints; one place for prefix and default annotations; new tools get the prefix and defaults by default.
- **Breaking**: Clients or tests that call tools by the previous short names must use the prefixed names (e.g. `lightdash_tools__list_charts`). Discovery via `tools/list` is unchanged; only the reported names change.

## References

- GitHub: Issue #41 (parent), sub-issues #42 (ADR/OpenSpec), #43 (Implementation), #44 (Changelog)
- OpenSpec: `docs/openspec/changes/mcp-tools-prefix-and-annotations/`
