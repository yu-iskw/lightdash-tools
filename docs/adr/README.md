# Architecture Decision Records

Slim thematic set of binding architecture decisions for this monorepo.

Format follows [Michael Nygard's ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Context / Decision / Status / Consequences). Manage with [adr-tools](https://github.com/npryce/adr-tools) under `docs/adr`.

## Keep criteria

Include an ADR only if **all** are true:

1. Architecturally significant (structure, interfaces, safety, package boundaries).
2. Still **binding** in current code (or explicitly CLI-only / MCP-only).
3. Non-obvious trade-off a future maintainer would ask "why?"
4. One decision (not a feature changelog, skill note, or phase implementation log).

Feature "support X API" notes, superseded-only history, and process/skill records are **not** ADRs.

Vocabulary: living product term is **profile** ([ADR-0021](0021-mcp-profile-packaging-catalog-tool-membership-ssot.md)). Older ADR titles may still say "persona"; treat those bodies as historical and follow ADR-0021 for current packaging rules. A repo-wide `grep` for `persona` will still match historical ADR titles/bodies; that is expected. Stdio selection is `LIGHTDASH_TOOLS_MCP_STDIO_PROFILE` or a `lightdash-mcp <profile>` subcommand only — any older persona-named stdio env is ignored (not fail-closed).

## Table of contents

1. [Record architecture decisions](0001-record-architecture-decisions.md)
2. [Monorepo packages: client, common, CLI, MCP](0002-monorepo-packages-client-common-cli-mcp.md)
3. [Shared types and API version namespaces](0003-shared-types-and-api-version-namespaces.md)
4. [Agent-safe exposure: MCP/CLI vs client-only](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)
5. [CLI safety stack](0005-cli-safety-stack.md)
6. [MCP personas, shared registry, fixed paths](0006-mcp-personas-shared-registry-fixed-paths.md)
7. [MCP HTTP transport, OAuth broker, SDK v2](0007-mcp-http-transport-auth-modes-sdk-v2.md)
8. [MCP request scope and hardening](0008-mcp-request-scope-and-hardening.md)
9. [Cross-cutting conventions](0009-cross-cutting-conventions.md)
10. [MCP organization-audit persona read-only boundary](0010-mcp-organization-audit-persona-read-only-boundary.md)
11. [MCP tool response sensitivity classes](0011-mcp-tool-response-sensitivity-classes.md)
12. [MCP content-reader persona saved-content execution boundary](0012-mcp-content-reader-persona-saved-content-execution-boundary.md)
13. [Operation catalog as sole agent-surface SSOT](0013-operation-catalog-as-sole-agent-surface-ssot.md)
14. [MCP content-developer persona mutation boundary](0014-mcp-content-developer-persona-mutation-boundary.md)
15. [MCP content-governance persona elicitation-required soft-delete boundary](0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md)
16. [MCP pluggable ephemeral store for HTTP preview sessions and OAuth](0016-mcp-pluggable-ephemeral-store-for-http-preview-sessions-and-oauth.md) (superseded by 0019)
17. [MCP content-governance dashboard promote elicitation boundary](0017-mcp-content-governance-dashboard-promote-elicitation-boundary.md)
18. [MCP ai-agent-ops persona thin API boundary](0018-mcp-ai-agent-ops-persona-thin-api-boundary.md)
19. [MCP stateless protocol core without Redis ephemeral store](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)
20. [MCP data-analyst persona ad-hoc metric-query boundary](0020-mcp-data-analyst-persona-ad-hoc-metric-query-boundary.md)
21. [MCP profile packaging; catalog tool-membership SSOT](0021-mcp-profile-packaging-catalog-tool-membership-ssot.md)

## Old → new mapping

|                                                Old | Maps to                  |
| -------------------------------------------------: | ------------------------ |
|                                               0001 | 0001                     |
|                                               0002 | 0002                     |
|                         0003–0004, 0006–0009, 0028 | 0003                     |
|                                         0005, 0012 | 0002                     |
| 0010, 0011, 0014, 0016, 0019–0024, 0026–0027, 0030 | Not an ADR               |
|                                               0013 | 0006, 0007               |
|                             0015, 0018, 0033, 0042 | 0006                     |
|                                   0017, 0040, 0041 | 0007                     |
|                                         0025, 0037 | 0004                     |
|                                   0029, 0031, 0032 | 0005 (CLI); MCP → 0008   |
|                                               0034 | 0008 (also CLI via 0005) |
|                                         0035, 0036 | 0009                     |
|                                               0043 | 0008                     |
