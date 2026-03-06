# 35. Environment variables prefix LIGHTDASH*TOOLS*

Date: 2026-03-06

## Status

Accepted

## Context

Official Lightdash variables (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`, `LIGHTDASH_PROXY_AUTHORIZATION`) are used by the upstream HTTP client. The lightdash-tools project introduced additional environment variables for guardrails and tooling (`LIGHTDASH_DRY_RUN`, `LIGHTDASH_AUDIT_LOG`, `LIGHTDASH_TOOL_SAFETY_MODE`), but these were not clearly namespaced. Users could not easily distinguish project-specific variables from official Lightdash ones.

## Decision

All lightdash-tools-specific environment variables must use the `LIGHTDASH_TOOLS_` prefix.

**Rename mapping:**

| Old                                | New                           |
| :--------------------------------- | :---------------------------- |
| `LIGHTDASH_DRY_RUN`                | `LIGHTDASH_TOOLS_DRY_RUN`     |
| `LIGHTDASH_AUDIT_LOG`              | `LIGHTDASH_TOOLS_AUDIT_LOG`   |
| `LIGHTDASH_TOOL_SAFETY_MODE`       | `LIGHTDASH_TOOLS_SAFETY_MODE` |
| `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` | (unchanged)                   |

**Do not rename** (upstream Lightdash): `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`, `LIGHTDASH_PROXY_AUTHORIZATION`.

## Consequences

- **Breaking change:** Existing configurations must be updated before upgrading.
- **Clarity:** Users can readily identify which variables are project-specific.
- **Consistency:** All lightdash-tools env vars follow a single naming convention.

## References

- [ADR-0031 Agent security guardrails](0031-agent-security-guardrails-project-allowlist-dry-run-audit-log.md)
- [ADR-0029 Hierarchical safety modes](0029-hierarchical-safety-modes-for-mcp-and-cli.md)
