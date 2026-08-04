# 22. MCP profile-owned ToolModules replace operations catalog

Date: 2026-08-04

## Status

Accepted

Supercedes [13. Operation catalog as sole agent-surface SSOT](0013-operation-catalog-as-sole-agent-surface-ssot.md)

Supercedes [21. MCP mount membership via literal profile tables](0021-mcp-mount-membership-via-literal-profile-tables.md)

## Context

The shared `packages/common/src/operations/` catalog plus `profile-membership.ts` string tables created multiple sources of truth for the same MCP capability: catalog descriptors, membership arrays, `ProfileDefinition.mcpToolNames`, and the MCP `toolRegistry` / handlers (which already owned title, description, annotations, and Zod schemas via `registerToolSafe`). Sync was enforced with load-time validators and tests. That tax did not buy runtime behavior—handlers and profiles did.

MCP Spec 2026-07-28 and TypeScript SDK v2 define tools via `tools/list` / `tools/call` and `server.registerTool(...)`. Profile membership is an application concern, not a protocol concept. Annotations are hints only.

## Decision

1. **Delete the operations catalog** (`packages/common/src/operations/`). No `defineOperation`, operation ids, or catalog-backed CLI `schema` command.
2. **Profiles own mounts.** Each `ProfileDefinition` has `tools: readonly ToolModule[]` importing shared modules. Array order is `tools/list` order (deterministic).
3. **ToolModule is minimal:** `{ id, register }` only. Metadata (description, Zod, annotations) stays inside the handler’s `registerToolSafe` call—do not recreate a catalog.
4. **Shared handlers stay in domain modules.** Export `defineTool(...)` next to each `register*` in the handler file; profiles import those ToolModules directly. Profile-specific registration (e.g. scoped `get_project` capability envelopes) uses `defineToolVariant` with the same wire `id` — not registration-time profile branching.
5. **Discovery:** MCP agents use `tools/list`; CLI agents use Commander `--help`. Keep `PROFILE_IDS` / `ProfileId` in common for audit typing; keep a static `IRRECOVERABLE_TOOL_DENYLIST`.
6. **Orchestration only in `registerTools`.** Denylist enforcement lives in `tools/registry.ts`; that file must not re-export every ToolModule.
7. **`requireServerProfile` at registration** is allowed only to stamp audit/`context.profile` or identical shared handlers (e.g. `registerContentReaderTool` for discovery tools mounted on both content-reader and content-developer). Capability-envelope differences must be separate ToolModules (`defineToolVariant`), not a profile→config map inside one register function.

## Consequences

- Adding a tool: implement handler → export `ToolModule` → append to profile `tools` arrays. No membership file or client-coverage map.
- CLI loses catalog `schema list/get`; OpenAPI drift CI no longer regenerates an operation registry.
- Older ADRs that cite `listMcpToolNamesByProfile` or catalog SSOT are historical; membership is profile `tools` imports ([ADR-0022](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)).
