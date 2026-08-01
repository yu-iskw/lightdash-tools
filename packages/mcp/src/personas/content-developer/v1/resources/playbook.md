# Content-developer playbook

URI: `lightdash://playbooks/content-developer`

## Hard bans

- Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
- Do not author or upsert SQL charts.
- Do not hard-delete, rollback, or promote content.
- Do not perform organization administration.
- Do not apply a write tool without a validated, unexpired, session-owned `previewId` from the matching `preview_*` tool.
- Do not reuse a `previewId` after it has been consumed by `apply` (single-use) or after the underlying resource has drifted (`PREVIEW_STALE`).
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
- `preview_space_changes`
- `validate_chart`
- `validate_dashboard`
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
- `create_space`
- `update_space`
- `move_content`

## Phase 0 — Resolve project

1. Call `lightdash_get_project` (pin / `LIGHTDASH_TOOLS_PROJECT_UUID` / explicit UUID).
2. Record project UUID, pin, and `developerCapabilities`.
3. Stop when project scope is unresolved (`PROJECT_SCOPE_REQUIRED`).
4. Never enumerate organization projects.

## Phase 1 — Discover before authoring

Use `search_content`, `list_spaces`, `get_space`, `get_dashboard`, `get_chart` to understand existing structure before creating or changing content. Avoid duplicating existing charts/dashboards/spaces.

## Phase 2 — Preview (mandatory gate)

Every mutation is gated by a preview:

1. Call the matching `preview_*` tool with the proposed changes.
2. Record the returned `previewId` and its diff summary and expiry.
3. Never skip this step, even for "small" edits.

## Phase 3 — Validate

1. Call `validate_chart` / `validate_dashboard` against the previewed target when fields, dimensions, or metrics changed.
2. Resolve validation errors before applying.
3. Use `compare_chart_versions` / `compare_dashboard_versions` when investigating regressions from a prior version.

## Phase 4 — Apply

1. Call the write tool (`create_chart`, `update_chart`, `duplicate_chart`, `create_dashboard`, `update_dashboard`, `duplicate_dashboard`, `add_dashboard_tile`, `move_dashboard_tile`, `remove_dashboard_tile`, `resize_dashboard_tile`, `create_space`, `update_space`, `move_content`) with the validated `previewId`.
2. A stale or already-consumed `previewId` is rejected (`PREVIEW_STALE`); re-run preview → validate before retrying.
3. Report the resulting UUID/slug, what changed, and any validation warnings.

## Phase 5 — Report

Report the content UUIDs touched, preview/validate outcomes, and a summary of the applied diff. Do not claim a change was applied without a successful apply response.
