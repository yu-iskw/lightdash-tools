# Organization-audit core

URI: `lightdash://playbooks/organization-audit/core`

## Hard bans

- Do not mutate users, groups, roles, spaces, content, or schedulers.
- Do not execute warehouse, SQL, chart, or underlying-data queries.
- Do not download user-activity CSV (`POST .../download`).
- Do not treat `list_project_direct_access` as complete effective access (it is **direct grants only**; empty is common when access is via org role or groups).
- Do not recommend deletion solely because content has low or zero views.
- Do not claim SOC 2 / GDPR / ISO / HIPAA (or any) certification from these tools.
- Do not crawl the whole org in one pass — honor budgets below.
- Do not request warehouse/dbt secrets via MCP — credentials are never returned (ADR-0011).

## Default budgets (override only if the user expands scope)

| Resource                   | Default                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Member list pages          | `pageSize=50`, stop after **3 pages** or when `pagination.complete`                            |
| Groups pages               | `pageSize=50`, stop after **2 pages**                                                          |
| Projects in depth          | **3** non-preview projects (or only those in `projectUuids` / HTTP pin)                        |
| Content pages per project  | `pageSize=50`, **2** pages max per contentTypes pass                                           |
| `resolve_effective_access` | `maxPrincipals=50`; prefer with a `projectUuid` (and `spaceUuid` when investigating one space) |
| Schedulers pages           | `pageSize=50`, **2** pages                                                                     |

Always record when you stopped early (`pagination.complete=false`, budget hit, or user-capped project list).

## Coverage semantics (do not confuse)

- **`pagination.complete`**: this list response finished paging (or you stopped).
- **`coverage.complete`**: often **false** even when a single call succeeded — it means the _audit envelope_ is not a full org certification. **Do not** treat `coverage.complete=false` alone as “tool failed”.
- Prefer citing `pagination`, `warnings[]` codes (`REDACTED`, `INCOMPLETE_EFFECTIVE_ACCESS`, `TRUNCATED`, `V1_FALLBACK`), and `accessSemantics`.

## Tool catalog (`lightdash_*`)

**Org inventory:** `get_org_profile`, `list_org_members`, `get_org_member`, `list_org_groups`, `list_org_projects`

**Access:** `list_org_role_assignments`, `list_custom_roles`, `get_custom_role`, `list_project_roles`, `list_project_direct_access`, `list_space_access`, `resolve_effective_access`

**Content / health:** `list_content`, `get_dashboard_meta`, `list_validation_results`, `get_project_user_activity`

**Delivery:** `list_project_schedulers`, `get_scheduler`

## Phase 0 — Scope

1. Call `lightdash_get_org_profile`. Record `organizationUuid`, caller role, `auditVisibility`, and `capabilities`.
2. If `auditVisibility` is not `organization_admin`, downgrade org-wide claims and note inaccessible scopes.
3. Call `lightdash_list_org_projects` (`includePreviewProjects=false` unless asked).
4. **Project selection:**
   - Prefer the HTTP pin (`X-Lightdash-Project`) or user-supplied `projectUuids`.
   - Otherwise pick up to **3** `type=DEFAULT` projects.
   - Flag (or skip unless asked) names that look soft-deleted / temporary (e.g. contain `Deleted`, `Preview`, or have `upstreamProjectUuid` set for throwaway clones).
5. Convert prompt `allowedEmailDomains` comma-strings into **string arrays** for tools that accept `allowedEmailDomains`.

## Phase 5 — Report template

For each finding use:

```text
### [severity: high|medium|low|info] Title
- Fact: …
- Evidence: tool=lightdash_… ; resource UUIDs=… ; warning codes=…
- Inference (optional): …
- Gaps: pagination/budget/redaction/incomplete effective access
- Suggested review action: … (never auto-delete / never mutate)
```

End with: projects sampled, pages fetched, redaction state, and explicit non-certification statement.
