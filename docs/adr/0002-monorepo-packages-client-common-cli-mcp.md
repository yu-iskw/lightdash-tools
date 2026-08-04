# 2. Monorepo packages: client, common, CLI, MCP

Date: 2026-07-31

## Status

Accepted

## Context

Consumers need typed Lightdash API access, a human/agent CLI, and an MCP server without duplicating auth, transport, or domain types. The npm scope should read as tooling for Lightdash, not as the Lightdash product itself.

## Decision

We structure the monorepo as pnpm workspace packages under the `@lightdash-tools` scope:

1. **`@lightdash-tools/common`** — Shared domain types (from OpenAPI), profile ids, audit helpers, safety helpers, and other cross-cutting libraries. Must not depend on `client`.
2. **`@lightdash-tools/client`** — Typed HTTP client for the Lightdash API (`api-key` / bearer). Sole API transport for CLI and MCP.
3. **`@lightdash-tools/cli`** — Commander.js CLI with a single entrypoint and modular commands; wraps actions with safety guardrails (see [ADR-0005](0005-cli-safety-stack.md)).
4. **`@lightdash-tools/mcp`** — MCP server with a shared tool registry and **profile** mounts (see [ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md)).

Workspace package names match `@lightdash-tools/<dirname>`. CLI and MCP depend on `client` and `common`; they do not call Lightdash HTTP directly.

## Consequences

- One place for API contracts and auth; CLI/MCP stay thin.
- Broad admin automation can use `client` without exposing every method on MCP/CLI ([ADR-0004](0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).
- Only the `@lightdash-tools` scope is used in-repo.
