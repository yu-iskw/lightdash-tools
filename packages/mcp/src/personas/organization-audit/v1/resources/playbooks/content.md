# Organization-audit — content and health

URI: `lightdash://playbooks/organization-audit/content`

## Phase 3 — Content and health

Per project (capped): `list_content` (use `sortBy`/`sortDirection`/`page` intentionally), `list_validation_results`, `get_project_user_activity`. Use `get_dashboard_meta` only when needed. Host joins validation, views, and ownership into findings — do not invent a server-side crawler.

Do not recommend deletion solely because content is unused. Join results in the conversation — do not assume a server-side audit tool.
