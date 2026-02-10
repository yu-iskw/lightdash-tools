# Design: Update develop-mcp-server-ts skill for MCP spec 2025-11-25

## Context

- The develop-mcp-server-ts skill (ADR-0011) lives under `.claude/skills/develop-mcp-server-ts/` with SKILL.md, references (mcp-specification.md, typescript-sdk-cheatsheet.md), and optional assets.
- The MCP specification 2025-11-25 adds server utilities (completion, logging, pagination), clarifies tool names and tool execution vs protocol errors, and defines many versioned spec pages. The skill currently references generic or unversioned spec links.
- Aligning the skill with 2025-11-25 improves correctness and discoverability without changing runtime behavior of any package.

## Goals / Non-Goals

**Goals:**

- Add a single spec index file that links to all relevant 2025-11-25 spec sections (basic, client, server, server utilities).
- Pin spec references to 2025-11-25 in mcp-specification.md and SKILL.md.
- Extend mcp-specification.md with lifecycle, transports, authorization, and server utilities (completion, logging, pagination).
- Extend typescript-sdk-cheatsheet.md with tool names, tool execution errors, optional tool fields, cursor pagination, and protocol logging.
- Update SKILL.md to link the spec index and mention 2025-11-25 in success criteria or purpose.

**Non-Goals:**

- Changing the skill’s workflow steps or adding new scripts or binary assets.
- Supporting multiple spec versions in the same skill (one version pin only).

## Decisions

### Decision 1: New reference file — spec index

**Choice:** Add `.claude/skills/develop-mcp-server-ts/references/spec-2025-11-25-index.md` as a single markdown file with sections and links to 2025-11-25:

- Spec version: changelog, architecture.
- Basic: overview, lifecycle, transports, authorization; utilities (cancellation, ping, progress, tasks).
- Client: roots, sampling, elicitation.
- Server: overview, prompts, resources, tools; utilities (completion, logging, pagination).

All URLs use the form `https://modelcontextprotocol.io/specification/2025-11-25/...` (exact paths as in the official 2025-11-25 spec).

**Rationale:** One place to discover every relevant spec section; avoids scattering versioned URLs across multiple files.

### Decision 2: Edits to references/mcp-specification.md

**Choice:**

1. State alignment with spec **2025-11-25** and link to `references/spec-2025-11-25-index.md`.
2. In “Protocol and versioning”, use 2025-11-25 and link to changelog and architecture.
3. Add short subsections with links: Lifecycle (basic/lifecycle), Transports (basic/transports), Authorization (basic/authorization), Server utilities (completion, logging, pagination).
4. Optionally: Basic utilities (cancellation, ping, progress, tasks), Client features (roots, sampling, elicitation).
5. Replace generic “Official links” with 2025-11-25 URLs where applicable.

**Rationale:** Keeps one MCP concept file while pinning version and surfacing server utilities and core protocol areas.

### Decision 3: Edits to references/typescript-sdk-cheatsheet.md

**Choice:**

1. **Tool names**: Add note (2025-11-25) — 1–128 chars, case-sensitive, allowed: letters, digits, `_`, `-`, `.`; no spaces/commas.
2. **Tool result**: Add that input validation and business logic errors use **tool execution errors** (result with `isError: true`); protocol errors for unknown tool or malformed request.
3. **Optional tool fields**: Mention `title`, `icons`, `outputSchema`, `annotations` per spec.
4. **Pagination**: Note that list operations (e.g. `tools/list`) may support cursor-based pagination (`cursor`, `nextCursor`); cursors opaque.
5. **Logging**: Keep Stdio stderr rule; add that the protocol defines a logging capability and `notifications/message` (level, logger, data); link to spec server/utilities/logging.
6. Add links to 2025-11-25 server/tools and server/utilities (completion, logging, pagination).

**Rationale:** Cheatsheet remains the implementation-focused reference; new content matches 2025-11-25 without duplicating the full spec.

### Decision 4: Edits to SKILL.md

**Choice:**

1. In “References”, add bullet: Spec index (2025-11-25): `references/spec-2025-11-25-index.md`.
2. In “Success criteria” or “Purpose”, add one line: follow MCP specification 2025-11-25 for tools, resources, prompts, and server utilities (logging, completion, pagination).
3. Ensure any generic “specification” or “versioning” links point to 2025-11-25 (e.g. changelog or index) where appropriate.

**Rationale:** Entry point clearly directs users to the versioned spec index and states alignment.

## File summary

| Path                                                                         | Purpose                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| .claude/skills/develop-mcp-server-ts/references/spec-2025-11-25-index.md     | NEW: Index of 2025-11-25 spec sections with links                                         |
| .claude/skills/develop-mcp-server-ts/references/mcp-specification.md         | EDIT: Version pin, lifecycle, transports, authorization, server utilities, official links |
| .claude/skills/develop-mcp-server-ts/references/typescript-sdk-cheatsheet.md | EDIT: Tool names, execution errors, optional fields, pagination, logging, spec links      |
| .claude/skills/develop-mcp-server-ts/SKILL.md                                | EDIT: Spec index link, 2025-11-25 in success criteria/purpose, versioned links            |

No new scripts or assets beyond markdown/links.

## Validation

- All links in SKILL.md and references are relative (within skill) or valid 2025-11-25 URLs.
- OpenSpec spec scenarios (spec index present, mcp-specification server utilities, cheatsheet tool semantics and logging, versioned links) are satisfied by the updated content.

## References

- ADR-0014: Align develop-mcp-server-ts skill with MCP specification 2025-11-25
- OpenSpec: docs/openspec/changes/develop-mcp-server-ts-skill-spec-2025-11-25/
- GitHub: Issue #31
- MCP specification 2025-11-25: <https://modelcontextprotocol.io/specification/2025-11-25>
