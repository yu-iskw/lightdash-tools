# Lightdash Tools — Agent Context

Guidance for AI agents using the Lightdash CLI (`lightdash-ai`) or MCP tools (`lightdash_*`). These invariants are not obvious from `--help`; agents need them made explicit.

## Safety and Guardrails

- **Always use `--dry-run` for mutating operations when testing.** Set `LIGHTDASH_TOOLS_DRY_RUN=1` or pass `--dry-run` to simulate writes without executing them.
- **Validate project UUIDs against the allowlist before running.** Set `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` or `--projects` to restrict which projects the agent can access. Empty allowlist = all projects permitted.
- **Safety modes:** `read-only` (default), `write-idempotent`, `write-destructive`. Use `--safety-mode` or `LIGHTDASH_TOOLS_SAFETY_MODE` to control which operations are allowed.

## Agent-safe surface

MCP and CLI expose the same **agent-safe** tier — not the full `@lightdash-tools/client` API. See [ADR-0004](../adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md).

| Class                        | MCP/CLI                                                   | Example                              |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------ |
| Irrecoverable                | **Not exposed** — use the typed client                    | `delete_member` / org member removal |
| Reversible destructive       | Exposed with `WRITE_DESTRUCTIVE` + safety modes / dry-run | `delete_group`, revoke space access  |
| Read / non-destructive write | Exposed                                                   | `list_groups`, `create_group`        |

Safety modes gate **reversible** destructive ops at runtime. They do **not** replace banning irrecoverable operations from the surface.

## Context Window Discipline

- **Add `--fields` or field masks to list calls when supported.** Lightdash API responses can be large. Limit response size to protect the agent's context window.
- Prefer list operations that return minimal fields when only identifiers are needed.

## Surface Discovery

- CLI: use Commander `--help` on the relevant command group (e.g. `lightdash-ai agents --help`).
- MCP: connect a serving profile and call `tools/list` ([ADR-0022](../adr/0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)).

## Input Validation

- Resource IDs (projectUuid, slug) must not contain `?`, `#`, `%`, or path traversal (`..`). Invalid IDs are rejected before any API call.
- The agent is not a trusted operator. All inputs are validated.

## Secrets and Credentials

- Prefer env vars from the parent process (CI, shell, systemd). The tools do not load `.env` files.
- Details (dotenvx, MCP OAuth secrets): [secrets.md](secrets.md).
