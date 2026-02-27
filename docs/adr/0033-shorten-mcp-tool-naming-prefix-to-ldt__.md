# 33. Shorten MCP tool naming prefix to ldt\_\_

Date: 2026-02-27

## Status

Supersedes [18. MCP tool naming prefix and tool annotations](0018-mcp-tool-naming-prefix-and-tool-annotations.md)

## Context

The previous decision (ADR 0018) established the prefix `lightdash_tools__` (17 characters) for all MCP tools to ensure uniqueness. However, some MCP clients (notably Claude Desktop) impose a strict 60-character limit on the "combined server and tool name" (e.g., `lightdash-tools:lightdash_tools__update_ai_organization_settings`).

As a result, several longer tool names are being filtered out or rejected by the client because they exceed this limit. For example:

- Server name: `lightdash-tools` (15 chars) + `:` (1 char) = 16 chars
- Prefix: `lightdash_tools__` (17 chars)
- Tool name: `update_ai_organization_settings` (30 chars)
- Total: 16 + 17 + 30 = 63 chars (exceeds 60)

Shortening the prefix to `ldt__` (5 characters) saves 12 characters, bringing even the longest tool names safely under the 60-character limit without sacrificing the descriptiveness of the individual tools or the goal of disambiguation.

## Decision

1.  **Shorten naming prefix**: Change the `TOOL_PREFIX` constant from `lightdash_tools__` to `ldt__`.
2.  **Maintain disambiguation**: The prefix `ldt__` is still sufficiently unique within the context of common MCP servers to avoid collisions while being significantly more compact.

## Consequences

- **Robustness**: All current and future tools will have significantly more headroom within the 60-character limit imposed by some MCP clients.
- **Breaking**: Any client configurations or external scripts that explicitly call tools using the `lightdash_tools__` prefix must be updated to use the `ldt__` prefix (e.g., `ldt__list_projects`).
- **Consistency**: The "ldt" abbreviation aligns with the package name scope (`@lightdash-tools`) and provides a concise identifier.

## References

- ADR: [18. MCP tool naming prefix and tool annotations](0018-mcp-tool-naming-prefix-and-tool-annotations.md)
- Client Limit: Reported issue where tools like `update_ai_organization_settings` were filtered out.
