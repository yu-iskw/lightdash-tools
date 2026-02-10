# 11. Add agent skill for developing MCP servers in TypeScript

Date: 2026-02-10

## Status

Accepted

## Context

We need a repeatable, documented workflow for building MCP (Model Context Protocol) servers with the TypeScript SDK so that agents and developers can add tools, resources, and prompts without ad-hoc discovery. The official MCP docs and TypeScript SDK are the source of truth, but there is no in-repo skill that guides the end-to-end process (requirements → transport → implementation → testing).

## Decision

We add a single agent skill under `.claude/skills/develop-mcp-server-ts/` that:

1. Follows a **standardized workflow**: requirements discovery (Tools, Resources, Prompts) → transport choice (Stdio vs Streamable HTTP) → implementation patterns (Zod for inputSchema, stderr-only logging for Stdio) → testing (MCP Inspector and/or Claude Desktop).
2. References the official MCP documentation and TypeScript SDK; includes reference files (e.g. MCP specification summary, TypeScript SDK cheatsheet) and optional boilerplate/templates (package.json, tsconfig.json, server-stdio and server-http templates).

The skill does not implement runtime MCP server code in the repo; it provides instructions and assets for use when building MCP servers elsewhere or in future work.

## Consequences

### Positive

- **Consistency**: MCP server development follows one documented path; fewer ad-hoc or incorrect implementations.
- **Discoverability**: Agents and developers can invoke the skill when asked to build or extend an MCP server in TypeScript.

### Negative

- **Maintenance**: One more skill to keep in sync with MCP spec and SDK changes.

### Risks

- **Drift**: If the MCP TypeScript SDK or spec changes, the skill may become outdated; mitigated by linking to official docs and keeping references concise.

## References

- OpenSpec: `docs/openspec/changes/develop-mcp-server-ts-skill/`
- GitHub: Issue #19 (Add agent skill: Develop MCP Server in TypeScript)
