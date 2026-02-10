# Spec: Develop MCP Server (TypeScript) agent skill

## ADDED Requirements

### Requirement: Document MCP primitives and transport choice

The skill SHALL document the three MCP server primitives (Tools, Resources, Prompts) and SHALL document when to use Stdio transport vs Streamable HTTP transport.

#### Scenario: Primitives documented

- **GIVEN** a user or agent invokes the develop-mcp-server-ts skill
- **WHEN** the user follows the workflow
- **THEN** the skill SHALL describe Tools (callable by the LLM), Resources (read-only context), and Prompts (reusable templates)
- **AND** SHALL direct the user to choose the appropriate primitive(s) for the server

#### Scenario: Transport choice documented

- **GIVEN** the user is implementing an MCP server
- **WHEN** the user follows the skill
- **THEN** the skill SHALL explain Stdio (local, process-based) vs Streamable HTTP (remote, web-based)
- **AND** SHALL reference the corresponding transport types (e.g. StdioServerTransport, StreamableHTTPServerTransport)

### Requirement: Reference Zod for tool inputSchema

The skill SHALL reference or demonstrate the use of Zod for defining tool inputSchema when registering tools with the TypeScript SDK.

#### Scenario: Zod for inputSchema

- **GIVEN** the skill describes how to register a tool
- **WHEN** the user reads the implementation patterns or cheatsheet
- **THEN** the skill SHALL show or link to inputSchema defined with Zod (e.g. z.object({ ... }))
- **AND** SHALL state that the SDK requires Zod (or equivalent) for schema validation

### Requirement: Include testing with MCP Inspector and/or Claude Desktop

The skill SHALL include steps or references for testing the server with MCP Inspector and/or Claude Desktop (or equivalent clients).

#### Scenario: Testing steps

- **GIVEN** the user has implemented an MCP server
- **WHEN** the user follows the skill’s testing section
- **THEN** the skill SHALL describe or link to testing with MCP Inspector (e.g. npx @modelcontextprotocol/inspector) and/or configuring Claude Desktop (e.g. claude_desktop_config.json)
- **AND** SHALL mention the logging rule for Stdio (e.g. use stderr, not stdout)

### Requirement: Link to official MCP TypeScript SDK and specification

The skill SHALL link to the official MCP TypeScript SDK repository and the MCP specification (or versioning) so that users can verify SDK and protocol versions.

#### Scenario: Official links

- **GIVEN** the user opens the skill or its references
- **WHEN** the user looks for SDK or protocol documentation
- **THEN** the skill or its reference files SHALL contain links to the official TypeScript SDK (e.g. github.com/modelcontextprotocol/typescript-sdk)
- **AND** SHALL contain links to the MCP specification or versioning (e.g. modelcontextprotocol.io/specification/versioning or /docs/learn/architecture)

### Requirement: Skill structure (SKILL.md, references, optional assets)

The skill SHALL consist of a SKILL.md with workflow steps and SHALL include reference file(s). The skill MAY include optional assets (boilerplate or templates).

#### Scenario: SKILL.md workflow

- **GIVEN** the skill is installed under .claude/skills/develop-mcp-server-ts/
- **WHEN** a user or agent reads SKILL.md
- **THEN** SKILL.md SHALL contain a workflow that includes requirements discovery, project/transport choice, implementation patterns, and testing
- **AND** SHALL use relative links to references (e.g. references/mcp-specification.md, references/typescript-sdk-cheatsheet.md)

#### Scenario: References present

- **GIVEN** the skill directory exists
- **WHEN** the workflow references MCP concepts or SDK usage
- **THEN** the skill SHALL provide at least one reference file (e.g. mcp-specification summary or typescript-sdk-cheatsheet)
- **AND** references SHALL be linked from SKILL.md with relative paths

## References

- ADR-0011: Add agent skill for developing MCP servers in TypeScript
- OpenSpec: docs/openspec/changes/develop-mcp-server-ts-skill/
- GitHub: Issue #19
