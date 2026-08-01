# Content-governance core

URI: `lightdash://playbooks/content-governance/core`

## Hard bans

- Do not permanently purge soft-deleted content (client-only / never on MCP).
- Do not delete spaces, bulk-delete, or call org-level deletes.
- Do not soft-delete without **form elicitation** — never invent `confirmed: true` or treat chat "please confirm" as approval.
- Do not bypass the elicitation gate when the client lacks form elicitation (`ELICITATION_REQUIRED`).
- Do not restore, author, promote, compile queries, or execute warehouse SQL from this persona.
- Do not reveal secrets, warehouse credentials, or hidden SQL.

## Tools

Use only these `lightdash_*` tools:

- `delete_chart`
- `delete_dashboard`

One tool call → one resource → one elicitation → one API soft-delete. No bulk delete in v1.

## Phase 0 — Resolve project

1. Require a resolved project: HTTP `X-Lightdash-Project` pin, `LIGHTDASH_TOOLS_PROJECT_UUID`, or explicit `projectUuid` on the delete tool.
2. Stop when project scope is unresolved (`PROJECT_SCOPE_REQUIRED`).
3. Never enumerate organization projects from this persona (no `list_projects`).

## Elicitation SOP

1. Call `lightdash_delete_chart` or `lightdash_delete_dashboard` with the target UUID/slug (and `projectUuid` when not pinned).
2. The tool fails closed with `ELICITATION_REQUIRED` if the client cannot do form elicitation.
3. Otherwise the tool returns `inputRequired` with a confirmation form. Humans must set:
   - `decision`: `confirm_delete` (or `do_not_delete` to keep the resource)
   - `confirmationText`: the **exact** resource name shown in the elicitation message
4. After accept, the server revalidates the target. Drift → `RESOURCE_CHANGED`; re-run the tool (do not reuse stale approval).
5. Report the deletion receipt (or declined/cancelled/blocked). Soft-delete is restorable from trash until permanently purged outside MCP.
