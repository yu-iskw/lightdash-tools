# AI Agent Chat MCP — endpoint inventory

Profile: `ai-agent-chat` · Path: `/ai-agent-chat/v1/mcp` · Server: `lightdash-mcp-aichat`
See ADR-0029.

This profile **uses** existing Lightdash AI Agents as the current user. It is not a safe read-only analytics mount: generation creates stored conversation state, consumes model and warehouse resources, and may invoke nested agent-connected MCP tools that remain Lightdash-governed.

| MCP tool (`lightdash_` + id)  | HTTP                                          | Notes                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_project_agents`         | `GET /api/v1/projects/{projectUuid}/aiAgents` | Shared ToolModule with `ai-agent-ops`. Upstream `AiAgentSummary` may include `instruction` / `integrations` / `enableSqlMode`; a chat-specific projection would need a new tool id |
| `get_user_agent_preferences`  | `GET …/aiAgents/preferences`                  | Per-user default agent; read-only                                                                                                                                                  |
| `list_agent_threads`          | `GET …/{agentUuid}/threads`                   | Redacted by default ([ADR-0011](../../adr/0011-mcp-tool-response-sensitivity-classes.md))                                                                                          |
| `get_agent_thread`            | `GET …/threads/{threadUuid}`                  | Redacted by default                                                                                                                                                                |
| `create_agent_thread`         | `POST …/{agentUuid}/threads`                  | Body `{}`                                                                                                                                                                          |
| `create_agent_thread_message` | `POST …/threads/{threadUuid}/messages`        | `{prompt}` only                                                                                                                                                                    |
| `generate_agent_response`     | `POST …/threads/{threadUuid}/generate`        | `WRITE_OPEN_WORLD`; not `/stream`                                                                                                                                                  |

## Not on MCP v1

| Capability                     | Notes                                                  |
| ------------------------------ | ------------------------------------------------------ |
| Agent create/update/delete     | Agent admin stays CLI / `ai-agent-ops`                 |
| Evaluations and eval runs      | `ai-agent-ops` only                                    |
| `get_project_agent`            | Operator-oriented full agent config                    |
| Preference set/delete          | Read `get_user_agent_preferences` only                 |
| SQL mode / SQL approval        | No `enableSqlMode`, `autoApproveSql`, or toolHints     |
| `POST …/stream`                | v1 wraps non-streaming `/generate` only                |
| `allUsers` thread listing      | Omit the switch; caller-visible threads only           |
| `start_conversation` mega-tool | Hosts orchestrate create → message → generate          |
| Agent UUID allowlist           | No `LIGHTDASH_TOOLS_AI_AGENT_CHAT_ALLOWED_AGENT_UUIDS` |
| Data-analyst fallback          | This profile does not execute Explore metric-query     |

Nested agent-connected MCP tools remain a Lightdash configuration boundary. Do not describe this profile as read-only.

## Hosted deploy

Recommended: `LIGHTDASH_TOOLS_MCP_PROFILES=ai-agent-chat` plus `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`. Minimum role: Project Interactive Viewer. Prefer per-user OAuth so Lightdash RBAC and user attributes apply as the current user.

## Release gates (not in this PR)

- Live Interactive Viewer permission matrix
- Hosted OAuth two-user E2E
