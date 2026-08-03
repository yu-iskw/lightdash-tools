# Organization-audit — scheduled deliveries

URI: `lightdash://playbooks/organization-audit/deliveries`

## Phase 4 — Deliveries (per sampled project)

1. **`lightdash_list_project_schedulers`** with required `projectUuid`. Destinations stay redacted unless the user asks for `revealDestinations=true`.
2. Pass `allowedEmailDomains` (array) when classifying external email destinations after reveal.
3. Note `enabled`, `format` (e.g. `gsheets`, email), `cron`, linked `savedChartUuid` / `dashboardUuid`, and creator UUIDs.
4. **`enabled: false`** is still inventory — report as disabled schedule, not as “safe / ignore”.
5. Use **`lightdash_get_scheduler`** (`projectUuid` + `schedulerUuid`) for one schedule when list rows are insufficient.
6. Cross-link chart/dashboard UUIDs to `list_content` names when helpful.

Never create, edit, run, enable, disable, or delete schedules. External destinations (when revealed) are **review signals**, not automatic policy violations.
