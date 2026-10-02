# 36. MCP content-developer rename instruction

Date: 2026-10-02

## Status

Accepted

Amends [14. MCP content-developer profile mutation boundary](0014-mcp-content-developer-profile-mutation-boundary.md)

Related to [19. MCP stateless protocol core without Redis ephemeral store](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md), [22. MCP profile-owned ToolModules replace operations catalog](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)

## Context

The Lightdash Validator "Fix" modal renames a missing dimension or model through `POST /api/v1/projects/{projectUuid}/rename/...`. One field rename rewrites both the dimension and the sort when they share the field id. The chart-as-code upsert body is a different payload. A `previewToken` binds the hash of `{ proposed, baseline }`, so `update_chart` cannot apply a rename preview.

A `fixAll` flag on the chart tool would mix one chart write with a project-wide job. The project rename runs as an async job and returns `jobId`. This repo has no job client.

## Decision

1. Content-developer previews a `RenameInstruction` under preview kind `rename`. Scopes are `chart`, `dashboard-filter`, and `project`. There is no `fixAll` flag.
2. `preview_rename` mints a draft HMAC `previewToken` ([ADR-0019](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)). `confirm_preview` with `resourceKind` `rename` returns the validated token. No server state holds the preview.
3. The apply tools are `rename_chart`, `rename_dashboard_filter`, and `rename_project`. Each one rebuilds the instruction from its own arguments. A token unlocks only the rename it previewed. New write tools use `WRITE_NONDESTRUCTIVE`.
4. Chart and dashboard previews bind the instruction and the saved resource `updatedAt`. They do not call `POST /rename/preview`. Apply reads the resource again and returns `PREVIEW_STALE` when `updatedAt` changed.
5. Project preview calls `POST /rename/preview` with `dryRun: true`. The token baseline holds the sorted uuid lists of charts, dashboards, alerts, and dashboard schedulers. Apply previews again. A different list returns `PREVIEW_STALE` and does not post. A matching list posts `POST /rename` and returns `jobId` without polling.
6. A field rename's `to` must be an id from `list_rename_fields`, including joined tables. Chart and dashboard model renames skip the field list. A project field rename requires full field ids and `model` set to the explore name. The tools reject an empty `from` or `to` and an unchanged rename before they mint a token.
7. Apply tools reject `dryRun: true`. A dry run belongs on `preview_rename`.
8. After a project rename, the playbook tells the agent to run `lightdash download` when charts or dashboards as code live in git, then validate again.

## Consequences

- `update_chart` rejects a rename token with `PREVIEW_STALE` because its `resourceKind` is `rename`.
- A project token carries the uuid lists, so its size grows with the number of affected resources.
- Upstream `lightdash rename` remains the tool when `from` and `to` are already known. This repo does not add a second CLI.
- Field listing and the project rename need project `update`. One chart rename needs saved-chart `update`.
- Implementation is in [`developer-rename.ts`](../../packages/mcp/src/tools/project/developer-rename.ts) and the [`rename.ts` client](../../packages/client/src/api/v1/rename.ts). Endpoint map is in the [content-developer inventory](../profiles/content-developer/inventory.md).
