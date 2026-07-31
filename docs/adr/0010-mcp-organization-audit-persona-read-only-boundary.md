# 10. MCP organization-audit persona read-only boundary

Date: 2026-07-31

## Status

Accepted

## Context

Organization administrators need evidence-backed inventory of identities, access, content health, usage signals, and scheduled deliveries. Extending the `semantic-layer` persona would mix governance metadata with explore/compile tools and weaken least-capability isolation ([ADR-0006](0006-mcp-personas-shared-registry-fixed-paths.md)).

Lightdash APIs mix v1 and v2; some audit-useful reads (members, groups, projects, direct project access, user activity) remain v1-only in the pinned OpenAPI. Scheduler inventory is more efficient via project-scoped `GET /api/v1/schedulers/{projectUuid}/list` than per-chart/dashboard calls. There is no `unused-content` endpoint; usage evidence comes from user-activity and content `views`/`lastViewedAt`.

MCP clients often enforce a ~60-character combined server+tool name limit. `lightdash-mcp-organization-audit` plus `lightdash_*` tools exceeds that limit.

## Decision

1. Ship a separate **`organization-audit`** persona at fixed path `/organization-audit/v1/mcp` with an explicit tool allowlist (hybrid primitives + composed audits).
2. MCP server display name is **`lightdash-mcp-org-audit`** (not derived from the full persona id) so wire names stay under typical client limits; tool short-ids are kept ≤ 27 characters.
3. **Read-only metadata only:** registration asserts `readOnlyHint`, GET-backed operations, no warehouse query execution, no row-level data, no user-activity CSV `POST` download.
4. Prefer v2 when semantically complete (content, roles, validation); retain v1 where required. Unsupported capabilities return coverage metadata, not silent empty success.
5. Direct project access is labeled `direct_only` and never claimed as complete effective access. Effective access is composed with an explicit `complete` flag.
6. Scheduler destinations are redacted by default; `revealDestinations` is opt-in.
7. Stdio selects the persona via explicit subcommand (`lightdash-mcp organization-audit`); bare `lightdash-mcp` remains `semantic-layer` ([ADR-0006](0006-mcp-personas-shared-registry-fixed-paths.md) amendment).
8. Findings carry policy assumptions and evidence; prompts must not claim compliance certification.

## Consequences

- A second HTTP path and stdio subcommand are first-class; docs and Compose/Cursor configs must show both personas.
- Org-audit tools live in the shared registry but only register on this persona’s allowlist.
- Client gaps (user-activity GET, dashboard metadata GET) are filled under `@lightdash-tools/client`.
- Composed audits increase implementation cost but keep pagination/joins deterministic and testable.
