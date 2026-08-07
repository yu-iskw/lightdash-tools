# Content-reader — discover

URI: `lightdash://playbooks/content-reader/discover`

## Classify intent

Map the user request to: find / explain / retrieve values / summarize dashboard / compare / investigate. Discovery-only intents **must not** execute.

## Verified content first

When the user asks for trusted / canonical / verified content, or the prompt sets `verifiedOnly=true`:

1. Call `list_verified_content` **before** keyword `search_content`.
2. Prefer verified matches as an absolute trump ([verified content](https://docs.lightdash.com/guides/verified-content)).
3. If the list is empty, fall back to search — verification is often absent in real orgs; do not stall.

## Search strategy

1. Prefer **short, high-signal tokens** that appear in titles (product names, Japanese KPI words). Multi-word English phrases often return **zero** hits even when related content exists.
2. If the first query is empty, try: alternate language tokens, a single keyword, `spaceUuids` / `parentSpaceUuid`, or browse with `sortBy=views` + `sortDirection=desc` (optional empty/`query` omitted) and then refine.
3. Always set `pageSize` (≤25). Prefer `contentTypes` when the user asked for charts vs dashboards.
4. Read `source` on chart hits: `dbt_explore` (or similar semantic) vs `sql`. Treat `sql` as **not executable** on this profile.
5. Ranking heuristics when relevance ties (after verified preference above):
   - Higher `views` / pinned (`pinnedList` non-null)
   - Richer description / clearer name match
   - Prefer non-deleted / non-sandbox space names when obvious

`search_content` does **not** filter by verification — use `list_verified_content` for that.

## Spaces

- `list_spaces` without `parentSpaceUuid` returns **top-level** spaces only.
- Drill with `parentSpaceUuid` or `get_space` (`includeChildren` / `includeContent`) for one space at a time (budget ≤3).
- `get_space` content summaries are name/uuid only — follow with `search_content` or `get_*` for detail.

## Deliverable (find)

Return **≤5** candidates:

```text
- name (type) — uuid/slug — space — views/pinned — verified? — source(if chart) — why relevant — warnings
```

Do not execute unless the user asked for values or analysis.
