# Content-governance client compatibility matrix

Soft-delete tools (`delete_chart`, `delete_dashboard`) and dashboard promote (`promote_dashboard`) on the `content-governance` profile require **MCP form elicitation**. Clients that cannot present a form and return `inputResponses` are fail-closed with `ELICITATION_REQUIRED` — there is no chat-“yes” or `confirmed: true` fallback (ADR-0015, [ADR-0017](../../adr/0017-mcp-content-governance-dashboard-promote-elicitation-boundary.md)).

`get_dashboard_promote_diff` is read-only and does not require elicitation.

## Sessionless Streamable HTTP ([ADR-0019](../../adr/0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md))

Each HTTP POST uses a fresh `McpServer` via SDK `createMcpHandler` (`legacy: 'stateless'`). Form elicitation support must be present on the **current request** — prefer per-request:

```json
"params": {
  "_meta": {
    "io.modelcontextprotocol/clientCapabilities": { "elicitation": { "form": {} } }
  }
}
```

on every gated `tools/call` (including MRTR retries). There is no process-local initialize→call caps cache across POSTs. Stdio via `serveStdio` pins one connection-lifetime server, so initialize-declared caps still apply for that process.

| Client / transport                               | Form elicitation                                           | Expected behavior                                                                          | Status       |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------ |
| MCP Inspector (stdio / Streamable HTTP)          | Supported when elicitation UI enabled                      | Can complete accept / decline / cancel round-trips                                         | Tested (SDK) |
| `@modelcontextprotocol/client` InMemoryTransport | Via `elicitation/create` handler (SDK 2.0.0 2025-era shim) | Contract tests assert handler `InputRequiredResult` + legacy auto-fulfill paths            | Tested       |
| Sessionless HTTP                                 | Per-request `_meta` clientCapabilities                     | Missing form caps → blocked `ELICITATION_REQUIRED`. Send `_meta` caps on every gated call. | Tested       |
| Claude Code (stdio / HTTP)                       | Depends on host elicitation support                        | Unsupported hosts → blocked `ELICITATION_REQUIRED`; no DELETE/POST promote                 | Fail-closed  |
| Cursor (Streamable HTTP)                         | Depends on host elicitation support                        | Same as Claude Code; host must declare form elicitation (envelope or initialize on stdio)  | Fail-closed  |
| Codex / other agent hosts                        | Depends on host elicitation support                        | Same fail-closed policy                                                                    | Fail-closed  |

## How to verify a host

1. Point the host at `/content-governance/v1/mcp` (or `lightdash-mcp stdio --profile content-governance` for stdio).
2. Soft-delete: call `lightdash_delete_chart` with a real project + chart id and **without** pre-filled confirmation.
3. Promote: optionally call `lightdash_get_dashboard_promote_diff`, then `lightdash_promote_dashboard` without pre-filled confirmation.
4. Expect a form prompt (decision + typed resource name), not an immediate mutating API call.
5. Decline → `status: declined`, zero DELETE/POST. Accept with correct name → `status: deleted` or `status: promoted`.
6. If the host never shows a form and returns a blocked JSON with `code: ELICITATION_REQUIRED`, treat the host as incompatible for elicitation-gated tools.

## Production env

| Variable                                | Requirement                                           |
| --------------------------------------- | ----------------------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` | ≥32-byte secret (required when `NODE_ENV=production`) |
| Form elicitation capability             | Client-declared; missing → blocked for mutating tools |
