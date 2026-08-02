# Organization-audit — access governance

URI: `lightdash://playbooks/organization-audit/access`

## Phase 1 — Identity

Call `list_org_members` (paginate while `pagination.complete` is false, or stop after a small page budget). Optionally `list_org_groups`, `list_org_role_assignments`, `list_custom_roles`, `get_org_member` for spot checks.

## Phase 2 — Projects and access

Call `list_org_projects`, then for a capped set of projects: `list_project_roles`, `list_project_direct_access`, `list_space_access`, and `resolve_effective_access`. Treat `list_project_direct_access` as direct grants only; emails are masked by default — pass `includeEmail=true` only when required. Pass `allowedEmailDomains` when classifying external direct-access principals. Honor incomplete flags and truncation warnings.

Do not treat `list_project_direct_access` as complete effective access. State assumptions and coverage gaps.
