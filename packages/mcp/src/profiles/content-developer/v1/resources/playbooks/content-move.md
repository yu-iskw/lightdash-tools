# Content-developer — content move

URI: `lightdash://playbooks/content-developer/content-move`

Move charts/dashboards into **existing** spaces. Never create, rename, or update spaces (Terraform / out-of-band).

## Steps

1. Discover with `list_spaces` / `get_space` / `search_content`. Confirm the **target space already exists** (`targetSpaceUuid`).
2. Resolve each item to a **UUID** (not only a name). Prefer `search_content` short tokens or space inventory.
3. Preview with `preview_content_move`:
   - Required: `itemUuids`, `targetSpaceUuid` (null = project root if supported), `contentTypes` (same length/order as `itemUuids`).
   - Optional: `chartSources` (must match lengths and match apply exactly).
4. `confirm_preview` with `resourceKind: 'content-move'` and the preview's exact `resourceKey` → use the **new** validated `previewToken`.
5. Apply with `move_content` using the same payload hash fields.
6. Report moved item UUIDs and target space. Re-`get_space` if you need confirmation.

## Pitfalls

- Wrong `contentTypes` length/order vs `itemUuids` fails closed.
- Do not invent space UUIDs — copy from `list_spaces` / `get_space`.
- Moving does not replace promote; cross-project promote stays on content-governance.
