# Organization-audit core

URI: `lightdash://playbooks/organization-audit/core`

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

## Phase 0 — Scope

1. Call `lightdash_get_org_profile`.
2. Record organization UUID, project pin (`X-Lightdash-Project`), thresholds, and `auditVisibility`.
3. Downgrade organization-wide claims when visibility is `partial`.

## Phase 5 — Report

Synthesize findings from tool evidence in the conversation. Always include coverage gaps, assumptions, truncation, and resource UUIDs. Never claim the inventory was exhaustive when `pagination.complete` is false. Distinguish facts, inferred risks, assumptions, inaccessible areas, and truncation. Cite every finding with `lightdash_*` tool names and resource UUIDs. Do not claim formal compliance certification.
