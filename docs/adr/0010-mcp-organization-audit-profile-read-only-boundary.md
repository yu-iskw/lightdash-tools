# 10. MCP organization-audit profile read-only boundary

Date: 2026-07-31

## Status

Accepted

Amended by [11. MCP tool response sensitivity classes](0011-mcp-tool-response-sensitivity-classes.md)

## Context

Organization administrators need evidence-backed inventory of identities, access, content health, usage signals, and scheduled deliveries. Extending the `semantic-layer` profile would mix governance metadata with explore/compile tools and weaken least-capability isolation ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md)).

Lightdash APIs mix v1 and v2; some audit-useful reads (members, groups, projects, direct project access, user activity) remain v1-only in the pinned OpenAPI. Scheduler inventory is more efficient via project-scoped `GET /api/v1/schedulers/{projectUuid}/list` than per-chart/dashboard calls. There is no `unused-content` endpoint; usage evidence comes from user-activity and content `views`/`lastViewedAt`.

MCP clients often enforce a ~60-character combined server+tool name limit. `lightdash-mcp-organization-audit` plus `lightdash_*` tools exceeds that limit.

MCP [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) are model-controlled and servers should rate-limit invocations; org-wide multi-API crawls inside a single `tools/call` fight that model. [Prompts](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) and resources are the right place for multi-step audit procedures.

## Decision

1. Ship a separate **`organization-audit`** profile at fixed path `/organization-audit/v1/mcp`. Tool membership comes from catalog `profiles` via `listMcpToolNamesByProfile` ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md)): **read-only primitive** inventory/access/content/scheduler tools only. Multi-step audits are orchestrated by the host via prompts and the playbook resource — not via composed `audit_*` MCP tools.
2. MCP server display name is **`lightdash-mcp-org-audit`** (not derived from the full profile id) so wire names stay under typical client limits; tool short-ids are kept ≤ 27 characters.
3. **Read-only metadata only:** registration asserts `readOnlyHint`, GET-backed operations, no warehouse query execution, no row-level data, no user-activity CSV `POST` download.
4. Prefer v2 when semantically complete (content, roles, validation); retain v1 where required. Unsupported capabilities return coverage metadata, not silent empty success.
5. Direct project access is labeled `direct_only` and never claimed as complete effective access. Effective access is composed with an explicit `complete` flag.
6. Scheduler destinations are redacted by default; `revealDestinations` is opt-in. Broader response sensitivity classes (emails, connection secrets) are defined in [ADR-0011](0011-mcp-tool-response-sensitivity-classes.md).
7. Stdio selects the profile via `lightdash-mcp stdio --profile organization-audit`; bare `lightdash-mcp` fails closed ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md)).
8. Host-synthesized findings must carry policy assumptions and evidence; prompts must not claim compliance certification.
9. Shared tool implementations live under `packages/mcp/src/tools/` in scope folders (`organization/`, `project/`, `space/`, `semantic/`, plus `lib/` helpers). The profile owns path, optional `serverName`, prompts, and playbooks under `packages/mcp/src/profiles/organization-audit/`. Inventory: [docs/profiles/organization-audit/](../profiles/organization-audit/inventory.md).

## Consequences

- A second HTTP path and stdio subcommand are first-class; docs and Compose/Cursor configs must show both profiles.
- Org-audit tools register only when catalogued for this profile; hosts paginate and join primitives.
- Client gaps (user-activity GET, dashboard metadata GET) are filled under `@lightdash-tools/client`.
- Coverage honesty depends on `pagination.complete` and playbook caps, not a single mega-tool.
