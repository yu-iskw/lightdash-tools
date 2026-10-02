# Recovery: dashboard preview diff noise

URI: `lightdash://playbooks/content-developer/recovery/dashboard-diff`

## When

Interpreting `diff.removed` / `diff.added` on dashboard **update** previews before apply.

## Noise (safe to ignore)

Server-owned metadata often listed as removed when omitted from the proposal: `access`, `views`, `updatedAt`, `uuid`, `slug`, `organizationUuid`, and similar.

## Real omissions (do not apply)

If **`tiles`**, **`tabs`**, or **`filters`** appear in `diff.removed`, you omitted them from `changes`. Re-preview with the full intentional `tiles`/`tabs`/`filters` (copy layout from preview `current` when only editing name/description). Never ship a description-only body that drops the board.
