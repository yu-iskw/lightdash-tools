# AI-agent-chat conversation

URI: `lightdash://playbooks/ai-agent-chat/conversation`

## Goal

Delegate a business question to the **managed Lightdash AI Agent** and return that agent's answer. **Default to a new conversation.** Continue only with a known own-thread UUID (this session or user-supplied). Do not auto-browse threads on a plain question.

## New conversation (default)

When the user simply asks a question:

1. Resolve project (`projectUuid` or HTTP pin).
2. `get_user_agent_preferences`. If a `defaultAgentUuid` is present and accessible, use it.
3. Otherwise `list_project_agents` and select (ask the user only when necessary).
4. If the user **named** an agent, do not prefer the default first — resolve that name from `list_project_agents`.
5. `create_agent_thread` with the **exact** user prompt (required — empty create fails upstream).
6. `generate_agent_response`.
7. Return the generated result.

Do **not** call `create_agent_thread_message` on the first turn (the prompt is already on the thread). Do **not** call `list_agent_threads` on a plain new question.

## Follow-up (known threadUuid)

When the user continues and a **threadUuid** is already known (prompt args or this session):

1. `create_agent_thread_message` on that thread.
2. `generate_agent_response`.
3. Do not create a second message when retrying generate after a failed generation.

If `threadUuid` is missing: ask the user for it, or start a **new conversation** (above). Do **not** default to `list_agent_threads`.

## Optional own-history lookup

Only when the user **explicitly** asks to find or continue _their_ prior chat (and no threadUuid is known):

1. `list_agent_threads` with `includeMessageText=false` (caller-visible threads only — never invent `allUsers`).
2. Request `includeMessageText=true` only when identification needs conversation text.
3. Confirm the thread with the user when ambiguous, then follow-up (message + generate).

Do not take over other users' threads. Admin thread visibility in the Lightdash app is not an MCP workflow.

## Failures

Report the upstream failure. Do **not** silently switch to `data-analyst`, `semantic-layer`, or native Lightdash MCP and pretend the result came from the managed agent.

Generation is open-world and non-idempotent. Agent-connected tools are governed in Lightdash, not by hidden MCP switches. See [Lightdash AI Agents](https://docs.lightdash.com/guides/ai-agents).
