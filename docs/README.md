# Documentation

Index by audience. Binding architecture decisions live under [`adr/`](adr/).

## Operators

| Doc                                                                        | Purpose                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| [operators/mcp-oauth.md](operators/mcp-oauth.md)                           | Hosted MCP OAuth hub (env, broker routes, mental model) |
| [operators/cloud-run.md](operators/cloud-run.md)                           | Cloud Run deploy + audit logging                        |
| [operators/cursor-claude.md](operators/cursor-claude.md)                   | Cursor / Claude Code URL-only client setup              |
| [operators/secrets.md](operators/secrets.md)                               | Env-from-parent and dotenvx                             |
| [operators/mcp-oauth-threat-model.md](operators/mcp-oauth-threat-model.md) | OAuth threat model                                      |
| [operators/agent-context.md](operators/agent-context.md)                   | CLI/MCP agent invariants                                |

## Personas

| Persona            | Docs                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| organization-audit | [inventory](profiles/organization-audit/inventory.md)                                                                                           |
| content-reader     | [inventory](profiles/content-reader/inventory.md)                                                                                               |
| content-developer  | [inventory](profiles/content-developer/inventory.md)                                                                                            |
| content-governance | [inventory](profiles/content-governance/inventory.md), [client compatibility](profiles/content-governance/client-compatibility.md)              |
| ai-agent-ops       | [inventory](profiles/ai-agent-ops/inventory.md), [loop](profiles/ai-agent-ops/loop.md), [CLI reference](profiles/ai-agent-ops/cli-ai-agents.md) |
| data-analyst       | [inventory](profiles/data-analyst/inventory.md)                                                                                                 |

## Decisions

- [adr/](adr/) — Architecture Decision Records
