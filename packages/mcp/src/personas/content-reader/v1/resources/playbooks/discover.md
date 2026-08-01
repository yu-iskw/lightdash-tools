# Content-reader — discover

URI: `lightdash://playbooks/content-reader/discover`

## Phase 1 — Classify intent

Classify as find / explain / retrieve value / summarize dashboard / compare / investigate.

## Phase 2 — Discover

Use `search_content`, `list_spaces`, `get_space`. Prefer verified content when equally relevant.

Return at most five candidates with name/type, UUID, space path, verification, relevance, and warnings. Do not execute content unless values or analysis are requested.
