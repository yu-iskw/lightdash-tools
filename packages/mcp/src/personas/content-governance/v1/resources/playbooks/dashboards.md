# Content-governance — dashboards

URI: `lightdash://playbooks/content-governance/dashboards`

Soft-delete a single dashboard after human form elicitation. Soft-delete hides the dashboard from normal lists and is restorable from trash until permanently purged (purge is not available on MCP). Does not delete spaces or nested charts as a bulk operation.

## Soft-delete workflow

1. Resolve project scope (pin / `LIGHTDASH_TOOLS_PROJECT_UUID` / `projectUuid`).
2. Call `lightdash_delete_dashboard` with `dashboardUuidOrSlug` (UUID or slug).
3. If the response is blocked with `ELICITATION_REQUIRED`, stop — the client cannot approve deletes via MCP.
4. When the tool returns an elicitation form, the human must complete:
   - `decision`: `confirm_delete` to proceed, or `do_not_delete` to abort
   - `confirmationText`: exact dashboard **name** from the form message (not the UUID alone unless that is the displayed name)
5. On accept, the server re-fetches the dashboard and checks the precondition digest. If the dashboard changed, expect `RESOURCE_CHANGED` — call `lightdash_delete_dashboard` again for a fresh elicitation; do not invent confirmation.
6. On success, report the soft-delete receipt (identity, project, that it is restorable). Do not claim permanent purge or space deletion.

## Confirmation form fields

| Field              | Required values                                      |
| ------------------ | ---------------------------------------------------- |
| `decision`         | `confirm_delete` or `do_not_delete`                  |
| `confirmationText` | Exact resource name shown in the elicitation message |

## Error codes

- `ELICITATION_REQUIRED` — client lacks form elicitation; fail closed (no weaker confirmation path).
- `RESOURCE_CHANGED` — target drifted after approval was bound; re-invoke the tool.
- Declined / cancelled elicitation — leave the dashboard in place; report that nothing was deleted.
