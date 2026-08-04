# Architecture Decision Records

Slim thematic set of **binding** architecture decisions for this monorepo.

Format follows [Michael Nygard's ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Context / Decision / Status / Consequences). Manage with [adr-tools](https://github.com/npryce/adr-tools) under `docs/adr`.

**One-time rewrite (2026-08-04):** Binding Decision text was rewritten for agent clarity (profile packaging, catalog membership, stateless HTTP). Going forward, accepted ADRs are immutable — supersede with a new ADR ([ADR-0001](0001-record-architecture-decisions.md)).

## Keep criteria

Include an ADR only if **all** are true:

1. Architecturally significant (structure, interfaces, safety, package boundaries).
2. Still **binding** in current code (or explicitly CLI-only / MCP-only).
3. Non-obvious trade-off a future maintainer would ask "why?"
4. One decision (not a feature changelog, skill note, or phase implementation log).

Feature "support X API" notes, superseded-only history, and process/skill records are **not** ADRs.

Vocabulary: living product term is **profile**. The MCP protocol uses Host / Client / Server and Tools / Prompts / Resources — it does not define “persona” or “profile.” Mount membership is each profile’s `tools: ToolModule[]` imports ([ADR-0022](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)).

## Table of contents

1. [Record architecture decisions](0001-record-architecture-decisions.md)
2. [Monorepo packages: client, common, CLI, MCP](0002-monorepo-packages-client-common-cli-mcp.md)
3. [Shared types and API version namespaces](0003-shared-types-and-api-version-namespaces.md)
4. [Agent-safe exposure: MCP/CLI vs client-only](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)
5. [CLI safety stack](0005-cli-safety-stack.md)
6. [MCP profiles, shared registry, fixed paths](0006-mcp-profiles-shared-registry-fixed-paths.md)
7. [MCP HTTP transport, OAuth broker, SDK v2](0007-mcp-http-transport-auth-modes-sdk-v2.md)
8. [MCP request scope and hardening](0008-mcp-request-scope-and-hardening.md)
9. [Cross-cutting conventions](0009-cross-cutting-conventions.md)
10. [MCP organization-audit profile read-only boundary](0010-mcp-organization-audit-profile-read-only-boundary.md)
11. [MCP tool response sensitivity classes](0011-mcp-tool-response-sensitivity-classes.md)
12. [MCP content-reader profile saved-content execution boundary](0012-mcp-content-reader-profile-saved-content-execution-boundary.md)
13. [Operation catalog as sole agent-surface SSOT](0013-operation-catalog-as-sole-agent-surface-ssot.md)
14. [MCP content-developer profile mutation boundary](0014-mcp-content-developer-profile-mutation-boundary.md)
15. [MCP content-governance profile elicitation-required soft-delete boundary](0015-mcp-content-governance-profile-elicitation-required-soft-delete-boundary.md)
16. [MCP content-governance dashboard promote elicitation boundary](0017-mcp-content-governance-dashboard-promote-elicitation-boundary.md)
17. [MCP ai-agent-ops profile thin API boundary](0018-mcp-ai-agent-ops-profile-thin-api-boundary.md)
18. [MCP stateless protocol core without Redis ephemeral store](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)
19. [MCP data-analyst profile ad-hoc metric-query boundary](0020-mcp-data-analyst-profile-ad-hoc-metric-query-boundary.md)
20. [MCP mount membership via literal profile tables](0021-mcp-mount-membership-via-literal-profile-tables.md) (superseded by 0022)
21. [MCP profile-owned ToolModules replace operations catalog](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)

Number **16** is unused in the binding set (former pluggable Redis/ephemeral store; superseded by 0019).
