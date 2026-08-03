# Organization-audit — access governance

URI: `lightdash://playbooks/organization-audit/access`

## Phase 1 — Identity

1. `lightdash_list_org_members` with budgets from core (`pageSize=50`, ≤3 pages). Note `pagination.totalResults` when present (large orgs are normal).
2. Emails are **redacted by default**. Pass `includeEmail=true` only when the user needs full addresses. Use `allowedEmailDomains` so `isExternalDomain` classification is meaningful while redacted.
3. Optionally `lightdash_list_org_groups` (≤2 pages). Prefer group **names/UUIDs** over expanding every member unless investigating one group.
4. `lightdash_list_org_role_assignments` and `lightdash_list_custom_roles` for org-level / role catalog context. Use `lightdash_get_custom_role` / `lightdash_get_org_member` for spot checks only.

## Phase 2 — Projects and access (per sampled project)

Run in this order — **group project roles matter more than empty direct grants**:

1. **`lightdash_list_project_roles`** (v2 assignments: users **and** groups). This is usually the primary project ACL signal.
2. **`lightdash_list_project_direct_access`** — returns **explicit user grants only** (`accessSemantics: direct_only`). **Empty data is expected** when everyone reaches the project via org admin or groups. Always surface the `INCOMPLETE_EFFECTIVE_ACCESS` warning; never conclude “nobody has access” from an empty list.
3. **`lightdash_list_space_access`** — composed space list/get; includes inheritance (`inheritedFrom`: organization / group / parent_space). Nested spaces can explode row counts; summarize by space UUID + notable direct grants.
4. **`lightdash_resolve_effective_access`** — best-effort composition. With only `projectUuid`, results may still be org-role heavy and hit `maxPrincipals` truncation (`TRUNCATED`). Prefer it to **cross-check** a principal or space (`spaceUuid`), not as a full dump of the org.

State assumptions: role precedence across conflicting paths is **not** invented by the server; honor `complete=false` on individual principal rows and envelope warnings.
