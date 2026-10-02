# 21. MCP mount membership via literal profile tables

Date: 2026-08-04

## Status

Amends [6. MCP profiles, shared registry, fixed paths](0006-mcp-profiles-shared-registry-fixed-paths.md) (mount membership direction only)

Amends [13. Operation catalog as sole agent-surface SSOT](0013-operation-catalog-as-sole-agent-surface-ssot.md) (membership storage, not catalog role)

Superceded by [22. MCP profile-owned ToolModules replace operations catalog](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)

## Context

MCP has no “profile” primitive ([architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture); [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)). We package one fixed URL path / `serverInfo.name` / tool subset per product profile ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md)).

Mount membership previously lived as `OperationDescriptor.profiles[]` tags, indexed into `listMcpToolNamesByProfile`. That is drift-resistant but not IDE-traceable: Go to Definition from a profile entrypoint lands on a function signature, not the tool list. Re-exporting `listMcpToolNamesByProfile(id)` on `ProfileDefinition.mcpToolNames` did not fix navigability.

Hand-maintained allowlists in the MCP package (rejected by ADR-0006) must not return. Membership must stay a single write SSOT.

## Decision

1. **Literal profile tables in common are mount-membership SSOT.** Named `as const` arrays live in `packages/common/src/operations/profile-membership.ts` (`ORGANIZATION_AUDIT_MCP_TOOLS`, …, `MCP_TOOLS_BY_PROFILE`).
2. **Catalog ops define tool metadata only** (http, safety, `mcp` / `cli`). They do **not** carry a `profiles` field.
3. **`listMcpToolNamesByProfile` / registration read the tables.** Registry fails closed if a listed name is not an exposed MCP tool, if an exposed tool is unmounted, or if a table has duplicates.
4. **MCP profile entrypoints bind the named export** (`mcpToolNames: ORGANIZATION_AUDIT_MCP_TOOLS`) so Go to Definition shows the literal list. Profile folders must not invent a second allowlist.
5. **CLI schema** derives `profiles` for an op via `listProfilesForMcpToolName(toolName)`.

Packaging from ADR-0006 (one package, fixed paths, shared tools registry, stdio/http selection) remains in force.

## Consequences

- Adding a tool to a mount = catalog op (if new) + add the tool name to the profile array(s).
- Shared tools appear in multiple arrays explicitly (e.g. `get_project`).
- IDE/agents can navigate profile → literal tool names without grepping op tags.
- ADR-0006 decision “membership via `profiles` tags on ops” is replaced by this decision; other ADR-0006 packaging rules stay.
