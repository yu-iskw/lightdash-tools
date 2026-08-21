# AI-agent-chat conversation

URI: `lightdash://playbooks/ai-agent-chat/conversation`

## Goal

Delegate a business question to the **managed Lightdash AI Agent** and return that agent's answer. **Default to a new conversation.** Continue only with a known own-thread UUID (this session or user-supplied). Do not auto-browse threads on a plain question.

## New conversation (default)

When the user simply asks a question:

1. Resolve project via the existing pin / `projectUuid` / allowlist contract (pin wins). A Lightdash URL may supply the arg when no pin conflicts; if the URL `projectUuid` differs from the pin or allowlist, **ask or refuse** — do not override the pin.
2. If the user **named** an agent (or prompt `agentHint`), resolve that name with an **exact** match on `list_project_agents` (case-insensitive). Do not substring/fuzzy match. Do not prefer the default first when a name/hint is present.
3. Else `get_user_agent_preferences`. If a `defaultAgentUuid` is present, use it (upstream RBAC already scopes visibility). Preferring the default over Auto matches the Lightdash UI; URL grounding below still applies on create.
4. Else call **`route_agent`** with the grounded prompt (see URL grounding).
   - `nextAction === create_thread` → use `decision.suggestedAgentUuid`.
   - `nextAction === show_picker` → present `decision.candidates` (and reasoning) and **ask the user**; do not auto-pick.
   - Router unavailable (404 / error): `list_project_agents`. If **exactly one** agent → use it; else **ask the user**.
5. **Never** invent a pick by matching instruction text, `enableContentTools`, tags, or fuzzy name similarity.
6. `create_agent_thread` with the grounded prompt (required — empty create fails upstream).
7. `generate_agent_response`.
8. Return the generated result. When the user supplied a dashboard/chart UUID, the reply must cite **title + UUID**; mismatch → one follow-up on the same thread demanding content tools open that UUID.

Do **not** call `create_agent_thread_message` on the first turn (the prompt is already on the thread). Do **not** call `list_agent_threads` on a plain new question.

## URL / UUID grounding

When the user prompt contains a Lightdash dashboard or chart URL (or bare content UUID):

1. Parse content ids from the path (`dashboardUuid` and/or chart UUID). The Target block's `projectUuid` **must** be the **resolved** project scope from step 1 — never a different project from the URL.
2. Prefix the create prompt with a structured block, for example:

```text
Target content (do not substitute another dashboard/chart from agent instructions):
- projectUuid: <resolved-scope-uuid>
- dashboardUuid: <uuid>   # and/or chartUuid: <uuid>
User question:
<original question>
```

3. Always pass that full string to `create_agent_thread`. Pass it to `route_agent` **only when** step 4 runs (named/default already skipped routing).

Residual risk: a user default agent may still be space-scoped away from the Target content; title+UUID follow-up is the safety net (ADR-0031).

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

Generation is open-world and non-idempotent. Agent-connected tools are governed in Lightdash, not by hidden MCP switches. See [Lightdash AI Agents](https://docs.lightdash.com/guides/ai-agents) and [AI Router](https://docs.lightdash.com/agents/enable-ai-router).
