# Organization-audit — content and health

URI: `lightdash://playbooks/organization-audit/content`

## Phase 3 — Content and health (per sampled project)

Always pass **`projectUuids: [that project]`** (do not run org-wide content without an explicit ask).

1. **`lightdash_list_content`**
   - Prefer two passes when useful: `contentTypes: ["dashboard"]` and `["chart"]` (spaces optional).
   - Sort intentionally: `sortBy=views` + `sortDirection=desc` for popularity; `sortBy=last_updated_at` for staleness.
   - Stay within core page budgets. Record `source` (`dbt_explore` vs `sql`) when relevant.
2. **`lightdash_list_validation_results`** — empty list means no current validation failures observed, not “perfect catalog forever”.
3. **`lightdash_get_project_user_activity`** — treat as **activity evidence**, not an unused-content API (`V1_FALLBACK` / `usageSemantics: activity_evidence`).
   - **Summarize** for the report: `numberUsers` / role counts, `numberWeeklyQueryingUsers`, top `dashboardViews` / `chartViews`, `userMostViewedDashboards`.
   - **Do not** paste entire `chartWeeklyQueryingUsers` / `chartWeeklyAverageQueries` series into the user reply.
4. **`lightdash_get_dashboard_meta`** only when you need dashboard structure without executing tiles.

Host-join validation + views + ownership into findings. **Zero or low views ⇒ review signal only — never a deletion recommendation.**
