# Design: Develop MCP Server (TypeScript) agent skill

## Context

- The repo uses `.claude/skills/` for agent skills (e.g. `lightdash-api-discovery` and `manage-adr`). Skills have a SKILL.md with YAML frontmatter (name, description), workflow or checklist, and optional references/ and assets/.
- MCP (Model Context Protocol) servers expose Tools, Resources, and Prompts; they can use Stdio (local) or Streamable HTTP (remote) transport. The official TypeScript SDK is `@modelcontextprotocol/sdk` with Zod for schemas.
- There is no in-repo skill today that guides building an MCP server in TypeScript end-to-end.

## Goals / Non-Goals

**Goals:**

- Provide one standardized workflow: requirements discovery → transport choice → implementation patterns → testing.
- Document MCP primitives and transports; reference Zod for tool inputSchema; document stderr-only logging for Stdio.
- Link to official MCP TypeScript SDK and specification.
- Optionally provide boilerplate (package.json, tsconfig.json) and minimal server templates (stdio, HTTP).

**Non-Goals:**

- Implementing a runnable MCP server in this repo (the skill is guidance and optional templates only).
- Supporting other languages or SDKs (TypeScript only for this skill).

## Decisions

### Decision 1: Skill layout

**Choice:** Single skill directory `.claude/skills/develop-mcp-server-ts/` with:

- **SKILL.md**: YAML frontmatter (name, description), workflow sections (Requirements discovery → Project init → Implementation patterns → Testing), relative links to references. Style aligned with lightdash-api-discovery (checklist + detailed instructions).
- **references/**: At least two files:
  - **mcp-specification.md**: Short summary of MCP concepts (primitives, transports, lifecycle) and links to modelcontextprotocol.io.
  - **typescript-sdk-cheatsheet.md**: Code snippets for McpServer, StdioServerTransport / StreamableHTTPServerTransport, registerTool with Zod, registerResource pattern, logging rule (stderr for Stdio).
- **assets/** (optional): Boilerplate and templates:
  - **boilerplate/package.json**: Dependencies @modelcontextprotocol/sdk and zod.
  - **boilerplate/tsconfig.json**: ESM/Node16 compatible.
  - **templates/server-stdio.ts**: Minimal Stdio server example.
  - **templates/server-http.ts**: Minimal Streamable HTTP server example (if useful and concise).

**Rationale:** Keeps the skill self-contained; references avoid duplicating large docs; optional assets speed up scaffolding without forcing a specific structure.

### Decision 2: Workflow steps in SKILL.md

**Choice:** Four main steps:

1. **Requirements discovery**: Identify which primitives (Tools, Resources, Prompts) the server needs; decide transport (Stdio vs Streamable HTTP).
2. **Project initialization**: Init package, install SDK and Zod, configure TypeScript for ESM/Node16.
3. **Implementation patterns**: Register tools with Zod inputSchema; register resources if needed; use console.error (or stderr) for logging when using Stdio.
4. **Testing**: Use MCP Inspector and/or Claude Desktop; document config (e.g. claude_desktop_config.json) and logging caveat.

**Rationale:** Matches the recommended “Standardized Workflow” from the plan; easy to follow and validate.

### Decision 3: No runtime code in repo

**Choice:** The skill does not add any runnable MCP server under packages/. Only markdown, optional JSON/TS in .claude/skills/develop-mcp-server-ts/ (references and assets) are added.

**Rationale:** The skill is for building MCP servers elsewhere or in future work; the repo stays focused on Lightdash client/CLI.

## File summary

| Path                                                                         | Purpose                         |
| ---------------------------------------------------------------------------- | ------------------------------- |
| .claude/skills/develop-mcp-server-ts/SKILL.md                                | Entry point; workflow and links |
| .claude/skills/develop-mcp-server-ts/references/mcp-specification.md         | MCP concepts and spec links     |
| .claude/skills/develop-mcp-server-ts/references/typescript-sdk-cheatsheet.md | SDK snippets and logging rule   |
| .claude/skills/develop-mcp-server-ts/assets/boilerplate/package.json         | Optional                        |
| .claude/skills/develop-mcp-server-ts/assets/boilerplate/tsconfig.json        | Optional                        |
| .claude/skills/develop-mcp-server-ts/assets/templates/server-stdio.ts        | Optional                        |
| .claude/skills/develop-mcp-server-ts/assets/templates/server-http.ts         | Optional                        |

## Risks / Trade-offs

- **SDK churn**: TypeScript SDK may change (e.g. v2); cheatsheet and links should be kept minimal and point to official docs so that version details are read from the source.
- **Scope creep**: Keeping assets optional avoids maintaining many template variants.

## References

- ADR-0011: Add agent skill for developing MCP servers in TypeScript
- OpenSpec: docs/openspec/changes/develop-mcp-server-ts-skill/
- GitHub: Issue #19
- MCP TypeScript SDK: <https://github.com/modelcontextprotocol/typescript-sdk>
- MCP docs: <https://modelcontextprotocol.io/docs/develop/build-server>
