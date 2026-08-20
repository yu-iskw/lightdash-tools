# AI-agent-chat conversation

URI: `lightdash://playbooks/ai-agent-chat/conversation`

## Goal

Delegate a business question to the **managed Lightdash AI Agent** and return that agent's answer.

## New conversation

When the user simply asks a question:

1. Resolve project (`projectUuid` or HTTP pin).
2. `get_user_agent_preferences`. If a `defaultAgentUuid` is present and accessible, use it.
3. Otherwise `list_project_agents` and select (ask the user only when necessary).
4. If the user **named** an agent, do not prefer the default first — resolve that name from `list_project_agents`.
5. `create_agent_thread` (empty body).
6. `create_agent_thread_message` with the **exact** user prompt.
7. `generate_agent_response`.
8. Return the generated result.

## Follow-up

When the user says "continue" and a thread UUID is already known:

1. `create_agent_thread_message` on that thread.
2. `generate_agent_response`.
3. Do not create a second message when retrying generate after a failed generation.

## Resume an older conversation

1. `list_agent_threads` with `includeMessageText=false`.
2. Request `includeMessageText=true` only when identification needs conversation text.
3. Then follow-up (message + generate).

## Failures

Report the upstream failure. Do **not** silently switch to `data-analyst`, `semantic-layer`, or native Lightdash MCP and pretend the result came from the managed agent.

Generation is open-world and non-idempotent. Agent-connected tools are governed in Lightdash, not by hidden MCP switches. See [Lightdash AI Agents](https://docs.lightdash.com/guides/ai-agents).
