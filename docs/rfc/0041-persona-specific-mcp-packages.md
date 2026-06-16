# RFC: Persona-Specific MCP Packages for Lightdash Tools

> **Status:** Accepted
> **Date:** 2026-06-16
> **Repository:** [`yu-iskw/lightdash-tools`](https://github.com/yu-iskw/lightdash-tools)
> **Related:** [ADR-0029](../adr/0029-hierarchical-safety-modes-for-mcp-and-cli.md), [ADR-0031](../adr/0031-agent-security-guardrails-project-allowlist-dry-run-audit-log.md)

---

## Executive Summary

`lightdash-tools` adopts **persona-specific MCP packages** as the primary mechanism for narrowing AI-agent capabilities. Each persona is a separately installable MCP package that registers only the tools required for its use case. The package is the exposure boundary.

Official v1 packages:

- `@lightdash-tools/mcp-agent-viewer` — read-oriented exploration
- `@lightdash-tools/mcp-agent-developer` — developer workflows (content-as-code, agentops, project agents, evaluations)

The generic `@lightdash-tools/mcp` server remains available and registers all tools.

**Core decision:** The package is the persona. Tool registration code is the source of truth for agent-facing exposure policy. No central persona registry in v1.

---

## v1 Tool Surfaces (implemented)

### `@lightdash-tools/mcp-agent-viewer` (17 tools)

Recommended `LIGHTDASH_TOOLS_SAFETY_MODE=read-only`.

| Domain     | MCP tools (`ldt__*`)                                                   |
| ---------- | ---------------------------------------------------------------------- |
| Projects   | `list_projects`, `get_project`, `get_validation_results`               |
| Charts     | `list_charts`, `list_charts_as_code`                                   |
| Dashboards | `list_dashboards`                                                      |
| Spaces     | `list_spaces`, `get_space`                                             |
| Content    | `search_content`                                                       |
| Explores   | `list_explores`, `get_explore`, `list_dimensions`, `get_field_lineage` |
| Metrics    | `list_metrics`                                                         |
| Tags       | `list_tags`                                                            |
| Query      | `compile_query`                                                        |
| Schedulers | `list_schedulers`                                                      |

**Excluded:** users, groups, space ACL mutations, admin AI, project agents, threads, evaluations, agentops, all writes.

### `@lightdash-tools/mcp-agent-developer` (33 tools)

Recommended `LIGHTDASH_TOOLS_SAFETY_MODE=write-idempotent`.

Viewer baseline plus:

| Domain         | Additional tools                                                                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projects       | `validate_project`                                                                                                                                                                                                                  |
| Charts         | `upsert_chart_as_code`                                                                                                                                                                                                              |
| AgentOps       | `ai_agentops_plan`, `ai_agentops_apply`                                                                                                                                                                                             |
| Project agents | `list_project_agents`, `get_project_agent`, `create_project_agent`, `update_project_agent`                                                                                                                                          |
| Evaluations    | `list_agent_evaluations`, `get_agent_evaluation`, `list_agent_evaluation_runs`, `get_agent_evaluation_run_results`, `create_agent_evaluation`, `update_agent_evaluation`, `append_agent_evaluation_prompts`, `run_agent_evaluation` |

**Still excluded:** deletes, thread generation, admin AI settings, groups/users, space ACL.

---

## Architecture

Shared `@lightdash-tools/mcp` exports:

- `createLightdashMcpServer({ name, version })` — bare server shell
- `createGenericLightdashMcpServer(contextProvider, options?)` — full generic server
- `createMcpContextProvider()` — env-based context
- `runStdioMcpServer()` / `runPersonaStdioBin()` — stdio transport with audit log and guardrail CLI
- `registerAgentViewerTools()` / `registerAgentDeveloperTools()` — official persona registrars
- `@lightdash-tools/mcp/tools` — individual `register*Tool` functions per MCP tool
- `@lightdash-tools/mcp/testing` — `listRegisteredToolNamesForTest`, `assertNoIrrecoverableTools`

Persona packages compose exported registrars. Existing guardrails (`registerToolSafe`, safety mode, allowlist, dry-run, audit) remain mandatory defense-in-depth.

---

## Security Caveat

> Persona-specific MCP packages narrow what the agent can discover and call through that MCP server. They do not modify Lightdash backend permissions or PAT scopes.

Operators should prefer narrow Lightdash users/PATs, project allowlists, and audit logging in addition to persona packages.

---

## Non-Goals (v1)

- Central persona policy registry
- Custom Lightdash PAT scopes
- HTTP path-based personas
- `mcp-core` package split
- CLI persona packages

---

## References

- [persona-packages.md](../mcp/persona-packages.md)
- [agent-viewer.md](../mcp/agent-viewer.md)
- [agent-developer.md](../mcp/agent-developer.md)
- [custom-persona-package.md](../mcp/custom-persona-package.md)
