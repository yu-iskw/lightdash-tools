# Spec: Update develop-mcp-server-ts skill for MCP spec 2025-11-25

## ADDED Requirements

### Requirement: Spec index for 2025-11-25

The skill SHALL provide a reference file that links to the MCP specification 2025-11-25, covering basic, client, server, and server utilities sections.

#### Scenario: Spec index present and linked

- **GIVEN** the develop-mcp-server-ts skill is installed
- **WHEN** a user or agent looks for the official spec version
- **THEN** the skill SHALL provide a reference (e.g. `references/spec-2025-11-25-index.md`) that links to spec 2025-11-25
- **AND** the index SHALL include links to basic (overview, lifecycle, transports, authorization, utilities), client (roots, sampling, elicitation), server (overview, prompts, resources, tools), and server utilities (completion, logging, pagination)

#### Scenario: SKILL.md links to spec index

- **GIVEN** the user opens SKILL.md
- **WHEN** the user reads the References section
- **THEN** SKILL.md SHALL contain a bullet or link to the spec index (2025-11-25)
- **AND** SHALL mention 2025-11-25 in success criteria or purpose for tools, resources, prompts, and server utilities (logging, completion, pagination)

### Requirement: references/mcp-specification.md mentions server utilities and version

The skill’s MCP specification reference SHALL state alignment with spec 2025-11-25 and SHALL mention completion, logging, and pagination (server utilities).

#### Scenario: Version and server utilities in mcp-specification

- **GIVEN** the user reads `references/mcp-specification.md`
- **WHEN** the user looks for protocol version or server capabilities
- **THEN** the file SHALL state alignment with spec 2025-11-25 and link to the spec index (or changelog/architecture)
- **AND** SHALL include short subsections or links for lifecycle, transports, authorization, and server utilities (completion, logging, pagination)

### Requirement: references/typescript-sdk-cheatsheet.md covers tool semantics and logging

The TypeScript SDK cheatsheet SHALL mention tool names (1–128 chars, allowed characters), tool execution errors (`isError: true`) vs protocol errors, optional tool fields, cursor pagination, and protocol logging.

#### Scenario: Tool names and errors in cheatsheet

- **GIVEN** the user reads `references/typescript-sdk-cheatsheet.md`
- **WHEN** the user implements or registers tools
- **THEN** the cheatsheet SHALL state tool name rules (1–128 chars, case-sensitive, allowed: letters, digits, `_`, `-`, `.`; no spaces/commas)
- **AND** SHALL distinguish tool execution errors (result with `isError: true`) from protocol errors (unknown tool, malformed request)

#### Scenario: Optional tool fields and pagination in cheatsheet

- **GIVEN** the user reads the cheatsheet for tool or list behavior
- **WHEN** the user implements tools or list operations
- **THEN** the cheatsheet SHALL mention optional tool fields per spec (e.g. `title`, `icons`, `outputSchema`, `annotations`)
- **AND** SHALL note that list operations (e.g. `tools/list`) may support cursor-based pagination (`cursor`, `nextCursor`); cursors are opaque

#### Scenario: Logging in cheatsheet

- **GIVEN** the user reads the cheatsheet for logging
- **WHEN** the user implements a server
- **THEN** the cheatsheet SHALL keep the Stdio stderr rule (no stdout for Stdio transport)
- **AND** SHALL add that the protocol defines a logging capability and `notifications/message` (level, logger, data), with a link to spec server/utilities/logging

### Requirement: All spec links use 2025-11-25 where applicable

Links in SKILL.md and reference files that point to the MCP specification SHALL use the 2025-11-25 versioned URLs (or the spec index) where applicable; relative links within the skill remain unchanged.

#### Scenario: No generic unversioned spec links for core content

- **GIVEN** the skill and its references are updated
- **WHEN** a link targets the official MCP specification (modelcontextprotocol.io/specification/...)
- **THEN** the link SHALL point to 2025-11-25 (e.g. .../specification/2025-11-25/...) or to the spec index, except where a generic “latest” or “versioning” page is intentionally referenced

## References

- ADR-0014: Align develop-mcp-server-ts skill with MCP specification 2025-11-25
- OpenSpec: docs/openspec/changes/develop-mcp-server-ts-skill-spec-2025-11-25/
- GitHub: Issue #31
- MCP specification 2025-11-25: <https://modelcontextprotocol.io/specification/2025-11-25>
