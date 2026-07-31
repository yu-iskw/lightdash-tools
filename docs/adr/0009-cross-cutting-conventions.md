# 9. Cross-cutting conventions

Date: 2026-07-31

## Status

Accepted

## Context

Project-specific configuration must not be confused with official Lightdash client variables. CLI and MCP should prefer current Lightdash APIs while `packages/client` may still expose deprecated methods for transition.

## Decision

1. **Environment prefix** — All lightdash-tools-specific variables use `LIGHTDASH_TOOLS_` (MCP HTTP: `LIGHTDASH_TOOLS_MCP_*`). Do **not** rename upstream `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`, or `LIGHTDASH_PROXY_AUTHORIZATION`.
2. **Deprecated API avoidance** — Client methods that wrap deprecated Lightdash endpoints are marked `@deprecated`. `@typescript-eslint/no-deprecated` is an **error** in `packages/cli` and `packages/mcp`, and is not enforced the same way on `packages/client` (or tests) so the client can retain transitional wrappers.

## Consequences

- Operators can tell tooling knobs from official Lightdash credentials.
- CI blocks new deprecated API usage in agent-facing packages; marking a client method `@deprecated` is enough to forbid it in CLI/MCP.
- When Lightdash deprecates further endpoints, audit the client and migrate CLI/MCP callers.
