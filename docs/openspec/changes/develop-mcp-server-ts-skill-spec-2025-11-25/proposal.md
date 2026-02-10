# Proposal: Update develop-mcp-server-ts skill for MCP spec 2025-11-25

## Why

Keep the develop-mcp-server-ts skill aligned with the MCP specification 2025-11-25 and improve discoverability of spec sections. The 2025-11-25 spec adds server utilities (completion, logging, pagination), clarifies tool names and the distinction between tool execution errors and protocol errors, and defines many sections (basic, client, server, server utilities) that implementers should be able to find from the skill.

## What Changes

- **Spec index**: Add a single reference file that indexes all relevant MCP spec 2025-11-25 pages (basic, client, server, server utilities) with direct links.
- **Pin version**: Pin all spec links in the skill to 2025-11-25 (changelog, architecture, lifecycle, transports, authorization, tools, resources, prompts, server utilities).
- **references/mcp-specification.md**: State alignment with 2025-11-25; add short subsections with links for lifecycle, transports, authorization, server utilities (completion, logging, pagination); optionally basic utilities and client features; replace generic official links with 2025-11-25 where applicable.
- **references/typescript-sdk-cheatsheet.md**: Add tool names (1–128 chars, allowed characters), tool execution errors (result with `isError: true`) vs protocol errors, optional tool fields (title, icons, outputSchema, annotations), cursor-based pagination for list operations, and protocol logging (logging capability, `notifications/message`); add links to 2025-11-25 server/tools and server/utilities.
- **SKILL.md**: Link the spec index in References; add one line in success criteria or purpose about following MCP specification 2025-11-25 for tools, resources, prompts, and server utilities (logging, completion, pagination); ensure generic spec/versioning links point to 2025-11-25 where appropriate.

**NON-BREAKING**: Additive and editorial only; no changes to existing packages or CLI.

## Capabilities

### Updated Capabilities

- **develop-mcp-server-ts**: The skill SHALL provide a spec index (2025-11-25) linking to basic, client, server, and server utilities; SHALL document server utilities (completion, logging, pagination) and tool semantics (names, execution vs protocol errors, optional fields, pagination); SKILL.md SHALL reference 2025-11-25 and the spec index.

## Impact

- **Code**: New file `.claude/skills/develop-mcp-server-ts/references/spec-2025-11-25-index.md`; edits to `references/mcp-specification.md`, `references/typescript-sdk-cheatsheet.md`, and `SKILL.md`. No new scripts or assets beyond markdown/links.
- **User Experience**: Implementers can discover all relevant 2025-11-25 spec sections from one index and get correct guidance on tool names, errors, and server utilities.
- **Developer Experience**: Single version pin (2025-11-25) reduces confusion; future spec revisions can be handled by a follow-up skill update.

## References

- ADR-0014: Align develop-mcp-server-ts skill with MCP specification 2025-11-25
- GitHub Issue: #31
- MCP specification 2025-11-25: <https://modelcontextprotocol.io/specification/2025-11-25> (changelog, architecture, server/tools, server/utilities/\*)
