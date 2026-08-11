# Recovery: PREVIEW_STALE

URI: `lightdash://playbooks/content-developer/recovery/preview-stale`

## When

Tool error `PREVIEW_STALE` — content hash mismatch, baseline `updatedAt` drift, create race, or resourceKey/kind mismatch.

## Recover

1. Stop applying. Do **not** retry the same validated token with a tweaked body.
2. Re-`preview_*` with the **intended full proposed payload** (same nested `chart`/`dashboard`/`changes` you will apply).
3. `confirm_preview` with the new draft token + exact `resourceKind` / `resourceKey` + `projectUuid` (required without HTTP pin).
4. Apply using the **returned** validated token and the **identical** proposed body — no description/name/SQL/tiles tidy between confirm and apply.
5. Cap retries at **≤2** per resource after `PREVIEW_STALE`.

## Common causes

- Edited proposed fields after preview (hash mismatch).
- Resource changed under you (`updatedAt` / create appeared).
- Create-chart preview omitted top-level `slug` → `resourceKey` mismatch at apply.
