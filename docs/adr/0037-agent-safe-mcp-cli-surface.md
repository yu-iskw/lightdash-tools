# 37. Agent-safe MCP and CLI surface

Date: 2026-06-12

## Status

Accepted

Supersedes the agent-surface exposure decision in [ADR-0025](0025-mcp-write-destructive-preset-and-delete-member-for-dangerous-operations.md) (the `WRITE_DESTRUCTIVE` preset and reversible-destructive tooling remain).

## Context

MCP and CLI are automation surfaces for AI agents and scripted workflows. They should expose the same **agent-safe** operations, not the full `@lightdash-tools/client` API.

ADR-0025 exposed `delete_member` on MCP with `destructiveHint` and human-confirmation guidance. That is insufficient for **irrecoverable** operations: safety modes and confirmation prompts still make the tool discoverable and callable when misconfigured.

We already have:

- Hierarchical safety modes ([ADR-0029](0029-hierarchical-safety-modes-for-mcp-and-cli.md))
- Project allowlist, dry-run, and audit logging ([ADR-0031](0031-agent-security-guardrails-project-allowlist-dry-run-audit-log.md))
- A typed operation registry in `packages/common/src/operations/` (ai-agents today)

We need a policy for **which** operations belong on MCP/CLI at all, separate from **how** reversible destructive ops are guarded at runtime.

## Decision

### Agent exposure

Add `agentExposure` to each operation in the shared registry:

- **`agent`** — May appear on MCP (when `mcp.taskSupport.exposed`) and CLI (`cli.commandPath`).
- **`client-only`** — Documented in the registry but **not** registered as an MCP tool or CLI command. Callers use `@lightdash-tools/client` directly.

Validation: `client-only` operations must have `mcp.taskSupport.exposed === false`.

### Exposure classes

| Class                            | Rule                                       | MCP/CLI                                               | Example                                    |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------ |
| **Irrecoverable**                | State cannot be restored via API           | **Never expose** (`client-only`)                      | `delete_member`                            |
| **Reversible destructive**       | Delete/revoke but can recreate or re-grant | Expose with `WRITE_DESTRUCTIVE` + existing guardrails | `delete_group`, `revoke_user_space_access` |
| **Read / non-destructive write** | Default agent work                         | Expose                                                | `list_groups`, `create_group`              |

`--safety-mode` and `destructiveHint` remain the runtime gate for **reversible** destructive ops. They are **not** a substitute for banning irrecoverable ops from the surface.

### Parity rule

For registry entries with `agentExposure: 'agent'` and `mcp.taskSupport.exposed: true`, MCP tool name and CLI command path must both be set. CI parity tests enforce this for registry-backed domains.

Domains not yet in the registry are migrated incrementally (one domain per PR). Until migrated, manual review applies the same exposure classes.

### Immediate change

Remove `delete_member` from MCP. Do **not** add `users delete` to CLI. Register `users.members.delete` as `client-only` in the operation registry.

## Consequences

### Positive

- Irrecoverable harm requires deliberate use of the typed client, not an agent tool.
- MCP and CLI parity is defined on the **agent** tier, not the full API.
- Registry documents both exposed and banned operations.

### Negative

- Admin scripts that deleted members via MCP must migrate to `@lightdash-tools/client`.
- Full parity across all domains waits on incremental registry migration.

## References

- [ADR-0025](0025-mcp-write-destructive-preset-and-delete-member-for-dangerous-operations.md) — superseded for exposure; preset retained
- [ADR-0029](0029-hierarchical-safety-modes-for-mcp-and-cli.md)
- [ADR-0031](0031-agent-security-guardrails-project-allowlist-dry-run-audit-log.md)
- [docs/agent-context/CONTEXT.md](../agent-context/CONTEXT.md)
- `packages/common/src/operations/`
