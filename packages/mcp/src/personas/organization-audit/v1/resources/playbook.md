# Organization-audit playbook

Read-only evidence collection for Lightdash organization administrators. Findings are review signals synthesized by the host from primitive tool results — not compliance certifications. There are no composed `audit_*` MCP tools; chain bounded `lightdash_*` reads instead.

## Hard bans

- Do not mutate users, groups, roles, spaces, content, or schedulers.
- Do not execute warehouse, SQL, chart, or underlying-data queries.
- Do not download user-activity CSV (`POST .../download`).
- Do not treat direct project access as complete effective access.
- Do not recommend deletion solely because content has low usage.
- Do not claim SOC 2 / GDPR / ISO / HIPAA certification from these tools.
- Do not crawl the whole org in one step — respect `pagination.complete` and stop after agreed page/project limits.
- Do not request warehouse/dbt connection secrets via MCP — `warehouseConnection`, `dbtConnection`, and related credentials are never returned (ADR-0011); use `@lightdash-tools/client` or the CLI when operators need them.

## Tool catalog (`lightdash_*`)

Inventory: `get_org_profile`, `list_org_members`, `get_org_member`, `list_org_groups`, `list_org_projects`

Access: `list_org_role_assignments`, `list_custom_roles`, `get_custom_role`, `list_project_roles`, `list_project_direct_access`, `list_space_access`, `resolve_effective_access`

Content / health: `list_content`, `get_dashboard_meta`, `list_validation_results`, `get_project_user_activity`

Delivery: `list_project_schedulers`, `get_scheduler`

## Phases

### Phase 0 — Scope

1. Call `lightdash_get_org_profile`.
2. Record organization UUID, project pin (`X-Lightdash-Project`), thresholds, and `auditVisibility`.
3. Downgrade organization-wide claims when visibility is `partial`.

### Phase 1 — Identity

Call `list_org_members` (paginate while `pagination.complete` is false, or stop after a small page budget). Optionally `list_org_groups`, `list_org_role_assignments`, `list_custom_roles`, `get_org_member` for spot checks.

### Phase 2 — Projects and access

Call `list_org_projects`, then for a capped set of projects: `list_project_roles`, `list_project_direct_access`, `list_space_access`, and `resolve_effective_access`. Treat `list_project_direct_access` as direct grants only; emails are masked by default — pass `includeEmail=true` only when required. Pass `allowedEmailDomains` when classifying external direct-access principals. Honor incomplete flags and truncation warnings.

### Phase 3 — Content and health

Per project (capped): `list_content` (use `sortBy`/`sortDirection`/`page` intentionally), `list_validation_results`, `get_project_user_activity`. Use `get_dashboard_meta` only when needed. Host joins validation, views, and ownership into findings — do not invent a server-side crawler.

### Phase 4 — Deliveries

Per project (capped): `list_project_schedulers` (destinations redacted by default; pass `revealDestinations` only when required). Use `get_scheduler` with `projectUuid` + `schedulerUuid` for one schedule. Pass `allowedEmailDomains` when reviewing external email destinations.

### Phase 5 — Report

Synthesize findings from tool evidence in the conversation. Always include coverage gaps, assumptions, truncation, and resource UUIDs. Never claim the inventory was exhaustive when `pagination.complete` is false.
