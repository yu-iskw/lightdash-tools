# 4. Agent-safe exposure: MCP/CLI vs client-only

Date: 2026-07-31

## Status

Accepted

Related to [11. MCP tool response sensitivity classes](0011-mcp-tool-response-sensitivity-classes.md)

## Context

MCP and CLI are automation surfaces for AI agents and scripts. Exposing the full `@lightdash-tools/client` API—including irrecoverable deletes—is unsafe even with runtime safety modes: a misconfigured agent can still discover and call banned operations.

We need a policy for **which** operations appear on MCP/CLI at all, separate from **how** reversible destructive ops are guarded at runtime ([ADR-0005](0005-cli-safety-stack.md) for CLI; [ADR-0008](0008-mcp-request-scope-and-hardening.md) for MCP).

## Decision

Operations in `packages/common/src/operations/` carry `agentExposure`:

| Value         | Meaning                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `agent`       | May appear on MCP (when exposed) and CLI (`cli.commandPath` required).                                                  |
| `client-only` | Documented in the registry but **not** registered as an MCP tool or CLI command. Callers use `@lightdash-tools/client`. |

Exposure classes:

| Class                        | Rule                                                                                                                                          | Example                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Irrecoverable                | Never on MCP/CLI (`client-only`)                                                                                                              | `delete_member`, permanent content purge         |
| Reversible destructive       | Expose with `WRITE_DESTRUCTIVE` + surface guardrails                                                                                          | `delete_group`, revoke space access              |
| Soft-delete (content)        | MCP only via elicitation-required confirmation ([ADR-0015](0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md)) | `delete_chart`, `delete_dashboard` (soft-delete) |
| Read / non-destructive write | Expose on the agent tier                                                                                                                      | list/create group                                |

Runtime safety modes and `destructiveHint` gate **reversible** destructive ops. They are not a substitute for banning irrecoverable ops from the surface. Content soft-delete additionally requires MCP form elicitation (not a boolean tool argument).

The shipped MCP persona is a narrower compile/discovery set ([ADR-0006](0006-mcp-personas-shared-registry-fixed-paths.md)); broad admin ops stay on client/CLI.

## Consequences

- Irrecoverable harm requires deliberate use of the typed client.
- Agent parity is defined on the `agent` tier, not the full API.
- Domains migrate into the registry incrementally; until then, the same exposure classes apply by review.
