# Organization-audit playbook

Read-only evidence collection for Lightdash organization administrators. Findings are review signals, not compliance certifications.

## Hard bans

- Do not mutate users, groups, roles, spaces, content, or schedulers.
- Do not execute warehouse, SQL, chart, or underlying-data queries.
- Do not download user-activity CSV (`POST .../download`).
- Do not treat direct project access as complete effective access.
- Do not recommend deletion solely because content has low usage.
- Do not claim SOC 2 / GDPR / ISO / HIPAA certification from these tools.

## Tool catalog (`lightdash_*`)

Inventory: `get_org_profile`, `list_org_members`, `get_org_member`, `list_org_groups`, `list_org_projects`

Access: `list_org_role_assignments`, `list_custom_roles`, `get_custom_role`, `list_project_roles`, `list_project_direct_access`, `list_space_access`, `resolve_effective_access`

Content / health: `list_content`, `get_dashboard_meta`, `list_validation_results`, `get_project_user_activity`

Delivery: `list_project_schedulers`, `get_scheduler`

Composed: `audit_identity_access`, `audit_content_health`, `audit_scheduled_deliveries`, `audit_org_summary`

## Phases

### Phase 0 — Scope

1. Call `lightdash_get_org_profile`.
2. Record organization UUID, project pin (`X-Lightdash-Project`), thresholds, and `auditVisibility`.
3. Downgrade organization-wide claims when visibility is `partial`.

### Phase 1 — Identity

Call `list_org_members`, `list_org_groups`, `list_org_role_assignments`, `list_custom_roles`.

### Phase 2 — Projects and access

Call `list_org_projects`, then per project `list_project_roles`, `list_project_direct_access`, `list_space_access`, and `resolve_effective_access`.

### Phase 3 — Content and health

Call `list_content`, `list_validation_results`, `get_project_user_activity`, then `audit_content_health`.

### Phase 4 — Deliveries

Call `list_project_schedulers` (destinations redacted by default) and `audit_scheduled_deliveries`.

### Phase 5 — Report

Prefer `audit_org_summary` for a bounded full pass, or focused audit tools. Always include coverage, assumptions, and evidence UUIDs.
