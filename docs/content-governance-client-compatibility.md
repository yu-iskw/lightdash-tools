# Content-governance client compatibility matrix

Soft-delete tools (`delete_chart`, `delete_dashboard`) on the `content-governance` persona require **MCP form elicitation**. Clients that cannot present a form and return `inputResponses` are fail-closed with `ELICITATION_REQUIRED` — there is no chat-“yes” or `confirmed: true` fallback ([ADR-0015](adr/0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md)).

| Client / transport                               | Form elicitation                                           | Expected behavior                                                               | Status       |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------ |
| MCP Inspector (stdio / Streamable HTTP)          | Supported when elicitation UI enabled                      | Can complete accept / decline / cancel round-trips                              | Tested (SDK) |
| `@modelcontextprotocol/client` InMemoryTransport | Via `elicitation/create` handler (SDK 2.0.0 2025-era shim) | Contract tests assert handler `InputRequiredResult` + legacy auto-fulfill paths | Tested       |
| Claude Code (stdio / HTTP)                       | Depends on host elicitation support                        | Unsupported hosts → blocked `ELICITATION_REQUIRED`; no DELETE                   | Fail-closed  |
| Cursor (Streamable HTTP)                         | Depends on host elicitation support                        | Same as Claude Code                                                             | Fail-closed  |
| Codex / other agent hosts                        | Depends on host elicitation support                        | Same fail-closed policy                                                         | Fail-closed  |

## How to verify a host

1. Point the host at `/content-governance/v1/mcp` (or `lightdash-mcp content-governance` for stdio).
2. Call `lightdash_delete_chart` with a real project + chart id and **without** pre-filled confirmation.
3. Expect a form prompt (decision + typed resource name), not an immediate delete.
4. Decline → `status: declined`, zero DELETE. Accept with correct name → `status: deleted`.
5. If the host never shows a form and returns a blocked JSON with `code: ELICITATION_REQUIRED`, treat the host as incompatible for destructive tools.

## Production env

| Variable                                | Requirement                                           |
| --------------------------------------- | ----------------------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` | ≥32-byte secret (required when `NODE_ENV=production`) |
| Form elicitation capability             | Client-declared; missing → blocked                    |
