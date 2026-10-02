# 18. MCP content-developer rename instruction

Date: 2026-10-02

## Status

Accepted

Amends [14. MCP content-developer persona mutation boundary](0014-mcp-content-developer-persona-mutation-boundary.md)

## Context

Lightdash's Validator "Fix" modal renames a missing dimension or model through `POST /api/v1/projects/{projectUuid}/rename/...`. One field rename rewrites both the dimension and the sort when they share the field id. The chart-as-code upsert body is a different payload, so `update_chart` cannot consume a rename preview: the ledger hashes `{ proposed, baseline }`.

A `fixAll` flag on the chart tool would mix one chart write with a project-wide job. Project rename is asynchronous and returns `jobId`. This repo has no job client.

## Decision

1. Content-developer stores a `RenameInstruction` under preview kind `rename`. Scopes are `chart`, `dashboard-filter`, and `project`. There is no `fixAll` boolean.
2. Chart and dashboard previews store the instruction and the resource `updatedAt`. They do not call `POST /rename/preview`.
3. Project preview calls `POST /rename/preview` and stores the uuid lists on the baseline. Apply previews again. A different list is `PREVIEW_STALE` and does not post. A matching list posts `POST /rename` and returns `jobId` without polling.
4. Apply stays claim, mutate, mark applied. New write tools use `WRITE_NONDESTRUCTIVE`. `confirm_preview` checks session, kind, and key. It does not recompute the hash.
5. After a project rename, the playbook tells the agent to run `lightdash download` when charts or dashboards as code live in git, then validate again.
6. A field rename's `to` must be an id from the field dropdown, including joined tables. Chart and dashboard model previews do not call the field-list endpoint. A project field rename requires `model` (the explore name) and full field ids. Empty `from` or `to` is rejected before the ledger write.

## Consequences

- `update_chart` rejects a rename `previewId` because `resourceKind` is `rename`.
- Upstream `lightdash rename` remains the tool when `from` and `to` are already known. This repo does not add a second CLI.
- Field listing and project rename need project `update`. One chart rename needs saved-chart `update`.
