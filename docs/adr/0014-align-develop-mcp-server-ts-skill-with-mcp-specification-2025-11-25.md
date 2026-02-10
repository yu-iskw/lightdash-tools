# 14. Align develop-mcp-server-ts skill with MCP specification 2025-11-25

Date: 2026-02-11

## Status

Accepted

## Context

The develop-mcp-server-ts skill (ADR-0011) references generic MCP documentation. The MCP specification 2025-11-25 adds server utilities (completion, logging, pagination), clarifies tool names and the distinction between tool execution errors and protocol errors, and defines many spec sections (basic, client, server, server utilities) that implementers should be able to discover from the skill.

## Decision

We update the skill as follows:

1. **Pin to spec version 2025-11-25** and add a single reference file that indexes all relevant spec pages (basic, client, server, server utilities).
2. **Update references/mcp-specification.md** with lifecycle, transports, authorization, and server utilities (completion, logging, pagination); optionally basic utilities and client features.
3. **Update references/typescript-sdk-cheatsheet.md** with tool names (1–128 chars, allowed characters), tool execution errors (result with `isError: true`) vs protocol errors, optional tool fields (title, icons, outputSchema, annotations), cursor-based pagination, and protocol logging (logging capability and `notifications/message`).
4. **Update SKILL.md** to link the spec index and mention 2025-11-25 in success criteria and references.

## Consequences

### Positive

- **Alignment**: The skill stays aligned with the current MCP spec; implementers get correct guidance on tool semantics and server utilities.
- **Discoverability**: A single spec index makes it easy to find lifecycle, transports, tools, resources, prompts, and server utilities (completion, logging, pagination) in the official spec.

### Negative

- **Maintenance**: Future spec revisions (e.g. 2026-xx-xx) may require another skill update to re-pin and refresh references.

### Risks

- **Drift**: If the spec evolves and the skill is not updated, references may become outdated; mitigated by linking to the versioned spec (2025-11-25) and the changelog.

## References

- ADR-0011: Add agent skill for developing MCP servers in TypeScript
- OpenSpec: `docs/openspec/changes/develop-mcp-server-ts-skill-spec-2025-11-25/`
- GitHub: Issue #31 (Update develop-mcp-server-ts skill for MCP spec 2025-11-25)
- MCP specification: <https://modelcontextprotocol.io/specification/2025-11-25>
