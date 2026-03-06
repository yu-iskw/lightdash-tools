# Lightdash Tools — Agent Context

Guidance for AI agents using the Lightdash CLI (`lightdash-ai`) or MCP tools (`ldt__*`). These invariants are not obvious from `--help`; agents need them made explicit.

## Safety and Guardrails

- **Always use `--dry-run` for mutating operations when testing.** Set `LIGHTDASH_TOOLS_DRY_RUN=1` or pass `--dry-run` to simulate writes without executing them.
- **Validate project UUIDs against the allowlist before running.** Set `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` or `--projects` to restrict which projects the agent can access. Empty allowlist = all projects permitted.
- **Safety modes:** `read-only` (default), `write-idempotent`, `write-destructive`. Use `--safety-mode` or `LIGHTDASH_TOOLS_SAFETY_MODE` to control which operations are allowed.

## Context Window Discipline

- **Add `--fields` or field masks to list calls when supported.** Lightdash API responses can be large. Limit response size to protect the agent's context window.
- Prefer list operations that return minimal fields when only identifiers are needed.

## Schema Introspection

- Run `lightdash-ai schema list` to see available resources.
- Run `lightdash-ai schema get <resource>` (e.g. `charts.list`, `ai-agents.settings.get`) for machine-readable path, method, and params.

## Input Validation

- Resource IDs (projectUuid, slug) must not contain `?`, `#`, `%`, or path traversal (`..`). Invalid IDs are rejected before any API call.
- The agent is not a trusted operator. All inputs are validated.

## Secrets and Credentials

- Prefer env vars from the parent process (CI, shell, systemd). The tools do not load `.env` files.
- Avoid plaintext `.env` when AI has file access—secrets on disk can be read by agents.
- If using `.env`, use [dotenvx](https://dotenvx.com/) for encryption and run via `dotenvx run -- lightdash-ai ...` or `dotenvx run -- lightdash-mcp ...`.
- See [docs/secrets-and-credentials.md](../secrets-and-credentials.md) for details.
