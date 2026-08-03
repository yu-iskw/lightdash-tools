# Content-developer core

URI: `lightdash://playbooks/content-developer/core`

## Hard bans

- Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
- Do not author or upsert SQL charts.
- Do not hard-delete, rollback, or promote content on this persona. For dashboard promote with form elicitation, use the **content-governance** persona (`lightdash-mcp content-governance` / `/content-governance/v1/mcp`) — see [How to promote content](https://docs.lightdash.com/guides/how-to-promote-content).
- Do not perform organization administration.
- Do not create or update spaces — spaces are managed outside this agent (e.g. Terraform). Use existing spaces only.
- Do not treat a standalone chart create/update as a finished publish unit. New charts must be attached as dashboard tiles in the same workflow (dashboard is the promotion unit).
- Do not apply a write tool without a validated, unexpired HMAC-signed `previewToken` from the matching `preview_*` tool (then `confirm_preview`).
- Do not reuse a draft token after confirm (confirm returns a new validated token) or after the underlying resource / proposed payload has drifted (`PREVIEW_STALE`).
- Every write (create, update, duplicate, tile ops, content-move) must be unlocked with `confirm_preview`, passing the exact `resourceKind`/`resourceKey` the preview was created with — never a different resource's preview.
- `validate_chart` / `validate_dashboard` are optional health checks on a **saved** UUID only; they do not unlock apply (upstream has no unsaved-payload validator).
- Do not reveal secrets, warehouse credentials, or hidden SQL.

## Tools

Use only these `lightdash_*` tools:

- `get_project`
- `search_content`
- `list_spaces`
- `get_space`
- `get_dashboard`
- `get_chart`
- `preview_chart_changes`
- `preview_dashboard_changes`
- `preview_content_move` (`itemUuids` + `targetSpaceUuid` + required `contentTypes`)
- `validate_chart`
- `validate_dashboard`
- `confirm_preview`
- `compare_chart_versions`
- `compare_dashboard_versions`
- `create_chart`
- `update_chart`
- `duplicate_chart`
- `create_dashboard`
- `update_dashboard`
- `duplicate_dashboard`
- `add_dashboard_tile`
- `move_dashboard_tile`
- `remove_dashboard_tile`
- `resize_dashboard_tile`
- `move_content`

## Phase 0 — Resolve project

1. Call `lightdash_get_project` (pin or explicit `projectUuid`).
2. Record project UUID, pin, and `developerCapabilities`.
3. Stop when project scope is unresolved (`PROJECT_SCOPE_REQUIRED`).
4. Never enumerate organization projects.

## Preview → confirm → apply

1. Call the matching `preview_*` tool; record `previewToken`, diff, expiry, `resourceKey` (and optional `previewId` for logs).
2. Unlock with `confirm_preview` using that `previewToken` and the exact `resourceKind`/`resourceKey` from the preview; use the **new** validated `previewToken` it returns.
3. Apply with the write tool, the validated `previewToken`, and the same proposed payload. Stale baseline/hash → `PREVIEW_STALE` (re-preview → confirm). Tokens are client-carried (no server ledger).
4. Optionally run `validate_chart` / `validate_dashboard` on saved UUIDs as a health check (does not unlock).
5. Report UUIDs touched and outcomes; do not claim success without a successful apply response.
