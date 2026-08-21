# AI-agent-chat core

URI: `lightdash://playbooks/ai-agent-chat/core`

## Purpose

Use an **existing** Lightdash AI Agent as the authenticated Lightdash user. Discover an accessible agent, **default to a new conversation**, and ask Lightdash to generate the managed-agent response. Continue only with a known own-thread UUID (or explicit own-history lookup when the user asks).

This profile does **not** administer agents, run evaluations, author charts, or execute Explore metric queries. Generation is **open-world**: the selected agent may query the warehouse and invoke tools configured on that agent in Lightdash. Do not describe this mount as read-only.

## Hard bans

- Do not create, update, delete, or reconfigure AI Agents.
- Do not create, change, delete, or run AI-agent evaluations.
- Do not seek cross-user conversation access, take over other users' threads, or invent `allUsers` listing (`allUsers` is not available on this mount).
- Do not attempt to enable SQL mode or approve SQL.
- Do not add, remove, authenticate, or reconfigure MCP servers/tools attached to an agent.
- Do not replace the requested managed Lightdash AI Agent with `data-analyst` / `semantic-layer` tools unless the user explicitly asks for that alternative.
- Do not describe generation as read-only.
- Do not run tools outside the resolved project.

## Allowed tools (`lightdash_*`)

| Tool                          | Use for                                          |
| ----------------------------- | ------------------------------------------------ |
| `list_project_agents`         | Discover agents visible to the current user      |
| `get_user_agent_preferences`  | Resolve the caller's per-project default agent   |
| `list_agent_threads`          | List caller-visible thread summaries (redacted)  |
| `get_agent_thread`            | Read one accessible thread (redacted by default) |
| `create_agent_thread`         | Create a conversation with the first user prompt |
| `create_agent_thread_message` | Store a follow-up prompt on an existing thread   |
| `generate_agent_response`     | Invoke managed Lightdash AI-agent generation     |

`list_project_agents` returns the upstream agent summary. It may include instruction, integrations, and flags such as `enableSqlMode`. Treat those as Lightdash configuration facts, not switches this profile can change.

`list_agent_threads` / `get_agent_thread` return only threads visible to the **current** identity. That is the ceiling — not admin or cross-user takeover.

## Project scope

1. Pass **`projectUuid`** or rely on HTTP `X-Lightdash-Project`. Without either → `PROJECT_SCOPE_REQUIRED`.
2. `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` is a hard ceiling when set.

## Privacy

- Thread reads redact conversation text unless `includeMessageText=true`.
- `generate_agent_response` returns the generated answer (that is the tool's purpose).
- Audit logs do not include prompt or response bodies.
- Do not treat Lightdash app admin thread visibility as an MCP workflow.

## Retry

`create_agent_thread` (with prompt), `create_agent_thread_message`, and `generate_agent_response` are non-idempotent. After an ambiguous network failure, do not blindly create again. New conversations: create with prompt → generate. Follow-ups: message → generate. If the user message already exists, retry `generate_agent_response` only.
