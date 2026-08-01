# Content-developer core

URI: `lightdash://playbooks/content-developer/core`

## Hard bans

- Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
- Do not author or upsert SQL charts.
- Do not hard-delete, rollback, or promote content (promotion is UI-only; prefer **dashboard** promote so charts travel with the board — see [How to promote content](https://docs.lightdash.com/guides/how-to-promote-content)).
- Do not perform organization administration.
- Do not create or update spaces — spaces are managed outside this agent (e.g. Terraform). Use existing spaces only.
- Do not treat a standalone chart create/update as a finished publish unit. New charts must be attached as dashboard tiles in the same workflow (dashboard is the promotion unit).
- Do not apply a write tool without a validated, unexpired, session-owned `previewId` from the matching `preview_*` tool.
- Do not reuse a `previewId` after it has been consumed by `apply` (single-use) or after the underlying resource has drifted (`PREVIEW_STALE`).
- Updates to an existing chart/dashboard must be validated with `validate_chart` / `validate_dashboard` (upstream validator) — never with `confirm_preview`.
- Creates, duplicates, tile ops, and content-move previews (no existing uuid to validate against) must be validated with `confirm_preview`, passing the exact `resourceKind`/`resourceKey` the preview was created with — never a different resource's preview.
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

1. Call `lightdash_get_project` (pin / `LIGHTDASH_TOOLS_PROJECT_UUID` / explicit UUID).
2. Record project UUID, pin, and `developerCapabilities`.
3. Stop when project scope is unresolved (`PROJECT_SCOPE_REQUIRED`).
4. Never enumerate organization projects.

## Preview → validate/confirm → apply

1. Call the matching `preview_*` tool; record `previewId`, diff, expiry.
2. Existing chart/dashboard: `validate_chart` / `validate_dashboard` with that UUID + `previewId`.
3. Creates, duplicates, tiles, content moves: `confirm_preview` with exact `resourceKind`/`resourceKey`.
4. Apply with the write tool and the validated `previewId`. Stale/consumed → `PREVIEW_STALE`; re-preview.
5. Report UUIDs touched and outcomes; do not claim success without a successful apply response.
