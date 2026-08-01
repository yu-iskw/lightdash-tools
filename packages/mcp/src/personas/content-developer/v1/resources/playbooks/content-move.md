# Content-developer — content move

URI: `lightdash://playbooks/content-developer/content-move`

Move charts/dashboards into **existing** spaces. Never create, rename, or update spaces (Terraform / out-of-band).

## Steps

1. Discover with `list_spaces` / `get_space` / `search_content`. Confirm the **target space already exists**.
2. Preview with `preview_content_move`:
   - Required: `itemUuids`, `targetSpaceUuid` (null = project root if supported), `contentTypes` (same length/order as `itemUuids`).
   - Optional: `chartSources` (must match lengths of `itemUuids` and match apply exactly).
3. `confirm_preview` with `resourceKind: 'content-move'` and the preview's `resourceKey`.
4. Apply with `move_content` using the same payload hash fields.
5. Report moved item UUIDs and target space.
