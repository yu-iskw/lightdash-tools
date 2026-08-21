# AI Agent Chat MCP — endpoint inventory

Profile: `ai-agent-chat` · Path: `/ai-agent-chat/v1/mcp` · Server: `lightdash-mcp-aichat`
See [ADR-0029](../../adr/0029-mcp-ai-agent-chat-profile-conversation-boundary.md) (amended by [ADR-0030](../../adr/0030-mcp-ai-agent-chat-first-turn-requires-prompt-on-create.md), [ADR-0031](../../adr/0031-mcp-ai-agent-chat-ai-router-route-agent-selection.md)).

This profile **uses** existing Lightdash AI Agents as the current user. It is not a safe read-only analytics mount: generation creates stored conversation state, consumes model and warehouse resources, and may invoke nested agent-connected MCP tools that remain Lightdash-governed.

Host guidance (prompts/playbooks): **new conversation by default**; agent selection = named/hint → preferences → **`route_agent`** → single-agent or ask user (no host heuristics). Continue only with a known own-thread UUID. Do not teach cross-user thread takeover (`allUsers` stays off MCP v1).

| MCP tool (`lightdash_` + id)  | HTTP                                          | Notes                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_project_agents`         | `GET /api/v1/projects/{projectUuid}/aiAgents` | Shared ToolModule with `ai-agent-ops`. Upstream `AiAgentSummary` may include `instruction` / `integrations` / `enableSqlMode`; a chat-specific projection would need a new tool id           |
| `get_user_agent_preferences`  | `GET …/aiAgents/preferences`                  | Per-user default agent; read-only                                                                                                                                                            |
| `route_agent`                 | `POST /api/v1/org/aiRouter/route`             | Selection for create→generate; persists decision (`WRITE_NONDESTRUCTIVE`). Not Data MCP session activation ([ADR-0031](../../adr/0031-mcp-ai-agent-chat-ai-router-route-agent-selection.md)) |
| `list_agent_threads`          | `GET …/{agentUuid}/threads`                   | Redacted by default ([ADR-0011](../../adr/0011-mcp-tool-response-sensitivity-classes.md))                                                                                                    |
| `get_agent_thread`            | `GET …/threads/{threadUuid}`                  | Redacted by default                                                                                                                                                                          |
| `create_agent_thread`         | `POST …/{agentUuid}/threads`                  | Body `{prompt}` (required). Empty `{}` fails upstream — thread summaries INNER JOIN the first prompt                                                                                         |
| `create_agent_thread_message` | `POST …/threads/{threadUuid}/messages`        | `{prompt}` only — follow-ups                                                                                                                                                                 |
| `generate_agent_response`     | `POST …/threads/{threadUuid}/generate`        | `WRITE_OPEN_WORLD`; not `/stream`                                                                                                                                                            |

## Not on MCP v1

| Capability                                               | Notes                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| Agent create/update/delete                               | Agent admin stays CLI / `ai-agent-ops`                        |
| Evaluations and eval runs                                | `ai-agent-ops` only                                           |
| `get_project_agent`                                      | Operator-oriented full agent config                           |
| Preference set/delete                                    | Read `get_user_agent_preferences` only                        |
| AI Router config / instructions / commit / decision list | Org admin or later; chat is route-only                        |
| SQL mode / SQL approval                                  | No `enableSqlMode`, `autoApproveSql`, or toolHints            |
| `POST …/stream`                                          | v1 wraps non-streaming `/generate` only                       |
| `allUsers` thread listing                                | Omit the switch; caller-visible threads only                  |
| `start_conversation` mega-tool                           | Hosts orchestrate create(+prompt)→generate / message→generate |
| Agent UUID allowlist                                     | No `LIGHTDASH_TOOLS_AI_AGENT_CHAT_ALLOWED_AGENT_UUIDS`        |
| Data-analyst fallback                                    | This profile does not execute Explore metric-query            |
| Create-thread content `context` pin                      | Deferred; use prompt URL/UUID grounding instead               |

Nested agent-connected MCP tools remain a Lightdash configuration boundary. Do not describe this profile as read-only.

## Hosted deploy

Recommended: `LIGHTDASH_TOOLS_MCP_PROFILES=ai-agent-chat` plus `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`. Minimum role: Project Interactive Viewer. Prefer per-user OAuth so Lightdash RBAC and user attributes apply as the current user. Org AI Router must be enabled for multi-agent auto-selection ([AI Router](https://docs.lightdash.com/agents/enable-ai-router)).

## Release gates (not in this PR)

- Live Interactive Viewer permission matrix
- Hosted OAuth two-user E2E
- Live AI Router enablement smoke in the target org
