# Proposal: Add agent skill for developing MCP servers in TypeScript

## Why

Enable agents and developers to build Model Context Protocol (MCP) servers in TypeScript reliably, using a single documented workflow instead of ad-hoc discovery. The official MCP docs and TypeScript SDK are the source of truth, but the repo has no in-repo skill that guides requirements discovery, transport choice, implementation patterns, and testing.

## What Changes

- **New skill**: Add `.claude/skills/develop-mcp-server-ts/` with:
  - **Workflow**: Requirements discovery (Tools, Resources, Prompts) → transport selection (Stdio vs Streamable HTTP) → implementation patterns (Zod for inputSchema, stderr-only logging for Stdio) → testing (MCP Inspector and/or Claude Desktop).
  - **References**: MCP specification summary (primitives, transports, lifecycle) and TypeScript SDK cheatsheet (McpServer, transports, registerTool with Zod, registerResource, logging rule).
  - **Optional assets**: Boilerplate (package.json, tsconfig.json) and templates (server-stdio.ts, server-http.ts).

**NON-BREAKING**: Additive only; no changes to existing packages or CLI.

## Capabilities

### New Capabilities

- **develop-mcp-server-ts**: The skill SHALL document how to choose and implement MCP primitives (Tools, Resources, Prompts), SHALL document Stdio vs Streamable HTTP transport, SHALL reference Zod for tool inputSchema, SHALL include testing with MCP Inspector and/or Claude Desktop, and SHALL link to the official MCP TypeScript SDK and specification.

## Impact

- **Code**: New directory `.claude/skills/develop-mcp-server-ts/` (SKILL.md, references/, assets/). No runtime MCP server code in the repo; the skill provides instructions and optional templates.
- **User Experience**: Agents and developers can invoke the skill when asked to build or extend an MCP server in TypeScript.
- **Developer Experience**: Single, repeatable path for MCP server development; easier to onboard and avoid common mistakes (e.g. stdout logging on Stdio).

## References

- ADR-0011: Add agent skill for developing MCP servers in TypeScript
- GitHub Issue: #19
- MCP docs: <https://modelcontextprotocol.io/docs/develop/build-server> (TypeScript), architecture, server-concepts
- TypeScript SDK: <https://github.com/modelcontextprotocol/typescript-sdk>
