# Recovery: PREVIEW_REQUIRED

URI: `lightdash://playbooks/content-developer/recovery/preview-required`

## When

Tool error `PREVIEW_REQUIRED` — missing, invalid, or expired preview token (“invalid or expired”). There is no separate `PREVIEW_EXPIRED` code (~10 min TTL).

## Recover

1. Run the matching `preview_*` again for this write (new draft token).
2. `confirm_preview` with that draft + exact `resourceKind` / `resourceKey` + `projectUuid` when there is no HTTP pin.
3. Apply with the **new** validated token from confirm — never reuse a draft token after confirm.
4. If confirm returned `PREVIEW_NOT_VALIDATED` / `PREVIEW_NOT_OWNED`, fix kind/key/ownership and re-preview; do not treat `validate_*` as an unlock.
