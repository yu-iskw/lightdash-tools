# Content-governance — charts

URI: `lightdash://playbooks/content-governance/charts`

Soft-delete a single saved chart after human form elicitation. Soft-delete hides the chart from normal lists and is restorable from trash until permanently purged (purge is not available on MCP).

## Soft-delete workflow

1. Resolve project scope (pin / `LIGHTDASH_TOOLS_PROJECT_UUID` / `projectUuid`).
2. Call `lightdash_delete_chart` with `chartUuidOrSlug` (UUID or slug).
3. If the response is blocked with `ELICITATION_REQUIRED`, stop — the client cannot approve deletes via MCP.
4. When the tool returns an elicitation form, the human must complete:
   - `decision`: `confirm_delete` to proceed, or `do_not_delete` to abort
   - `confirmationText`: exact chart **name** from the form message (not the UUID alone unless that is the displayed name)
5. On accept, the server re-fetches the chart and checks the precondition digest. If the chart changed (name, space, updatedAt, etc.), expect `RESOURCE_CHANGED` — call `lightdash_delete_chart` again for a fresh elicitation; do not invent confirmation.
6. On success, report the soft-delete receipt (identity, project, that it is restorable). Do not claim permanent purge.

## Confirmation form fields

| Field              | Required values                                      |
| ------------------ | ---------------------------------------------------- |
| `decision`         | `confirm_delete` or `do_not_delete`                  |
| `confirmationText` | Exact resource name shown in the elicitation message |

## Error codes

- `ELICITATION_REQUIRED` — client lacks form elicitation; fail closed (no weaker confirmation path).
- `RESOURCE_CHANGED` — target drifted after approval was bound; re-invoke the tool.
- Declined / cancelled elicitation — leave the chart in place; report that nothing was deleted.
