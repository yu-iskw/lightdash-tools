# Content-governance — dashboards

URI: `lightdash://playbooks/content-governance/dashboards`

Soft-delete a single dashboard after human form elicitation, or promote a dashboard to its configured upstream project after form elicitation. Soft-delete hides the dashboard from normal lists and is restorable from trash until permanently purged (purge is not available on MCP). Promote copies the dashboard and its nested charts (and may create spaces / data-app tiles) into the upstream project — see [How to promote content](https://docs.lightdash.com/guides/how-to-promote-content).

## Soft-delete workflow

1. Resolve project scope (`X-Lightdash-Project` pin or `projectUuid`).
2. Call `lightdash_delete_dashboard` with `dashboardUuidOrSlug` (UUID or slug).
3. If the response is blocked with `ELICITATION_REQUIRED`, stop — the client cannot approve deletes via MCP.
4. When the tool returns an elicitation form, the human must complete:
   - `decision`: `confirm_delete` to proceed, or `do_not_delete` to abort
   - `confirmationText`: exact dashboard **name** from the form message (not the UUID alone unless that is the displayed name)
5. On accept, the server re-fetches the dashboard and checks the precondition digest. If the dashboard changed, expect `RESOURCE_CHANGED` — call `lightdash_delete_dashboard` again for a fresh elicitation; do not invent confirmation.
6. On success, report the soft-delete receipt (identity, project, that it is restorable). Do not claim permanent purge or space deletion.

## Promote workflow

1. Resolve project scope.
2. Optionally call `lightdash_get_dashboard_promote_diff` to inspect `PromotionChanges` (charts/dashboards/spaces/sqlCharts/dataApps actions).
3. Call `lightdash_promote_dashboard` with `dashboardUuidOrSlug`.
4. If blocked with `ELICITATION_REQUIRED`, stop — no weaker confirmation path.
5. Human form fields:
   - `decision`: `confirm_promote` or `do_not_promote`
   - `confirmationText`: exact dashboard name from the elicitation message
6. On accept, server re-fetches dashboard + promoteDiff. Drift → `RESOURCE_CHANGED` — re-invoke for a fresh elicitation.
7. On success, report the promotion receipt. Do not claim chart-only or SQL-chart promote (not available on MCP). Upstream project is configured in Data Ops, not chosen via tool args.

## Soft-delete confirmation form fields

| Field              | Required values                                      |
| ------------------ | ---------------------------------------------------- |
| `decision`         | `confirm_delete` or `do_not_delete`                  |
| `confirmationText` | Exact resource name shown in the elicitation message |

## Promote confirmation form fields

| Field              | Required values                                       |
| ------------------ | ----------------------------------------------------- |
| `decision`         | `confirm_promote` or `do_not_promote`                 |
| `confirmationText` | Exact dashboard name shown in the elicitation message |

## Error codes

- `ELICITATION_REQUIRED` — client lacks form elicitation; fail closed (no weaker confirmation path).
- `RESOURCE_CHANGED` — target or promoteDiff drifted after approval was bound; re-invoke the tool.
- Declined / cancelled elicitation — leave the dashboard / upstream unchanged; report that nothing was mutated.
