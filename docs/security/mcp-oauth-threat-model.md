# Threat model: OAuth-backed Streamable HTTP MCP

Security analysis for hosted `@lightdash-tools/mcp` deployments using `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`. Architecture context: [RFC 0040](../rfc/0040-oauth-backed-streamable-http-mcp.md), [ADR 0040](../adr/0040-oauth-backed-streamable-http-mcp.md).

## Assets

| Asset                           | Protection need                                                          |
| :------------------------------ | :----------------------------------------------------------------------- |
| Lightdash OAuth access token    | Must never be logged or persisted by default.                            |
| Lightdash data and tool results | Must be scoped by Lightdash permissions and operator project allowlists. |
| MCP endpoint                    | Must not expose tools unauthenticated in production.                     |
| Session IDs                     | Must not allow user or token confusion across sessions.                  |
| Audit logs                      | Must not leak credentials or unnecessary sensitive raw data.             |

## Threats and mitigations

| Threat                                     | Risk   | Mitigation                                                                                                                                                            |
| :----------------------------------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public unauthenticated MCP endpoint        | High   | Use `lightdash-oauth` or `shared-key` in production. `none` logs a loud startup warning.                                                                              |
| Shared PAT overreach                       | High   | Prefer OAuth mode; default `LIGHTDASH_TOOLS_SAFETY_MODE=read-only`; set `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`.                                                           |
| Token leakage in logs                      | High   | Redact `Authorization` in reverse proxies and platform logs. Never log raw `authInfo.token`. Audit entries use token hash only.                                       |
| Token/session confusion                    | High   | Bind stateful sessions to SHA-256 token hash; resume with different token returns `401 Session token mismatch`.                                                       |
| OAuth metadata spoofing (wrong public URL) | Medium | Require `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in `lightdash-oauth` mode. Normalize URL (no trailing slash, strip `/mcp` suffix).                                           |
| Insufficient scope UX loop                 | Medium | Include `scope` in `WWW-Authenticate` challenges; keep `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES` stable.                                                                  |
| Reimplemented RBAC mismatch                | High   | Do not recreate Lightdash object-level permissions in MCP. Delegate to Lightdash API with the user's bearer token.                                                    |
| Agent destructive actions                  | High   | Default `read-only`; static tool filtering via `--safety-mode`; dry-run; irrecoverable ops are client-only per [ADR-0037](../adr/0037-agent-safe-mcp-cli-surface.md). |
| CSRF / browser-origin misuse               | Medium | Bearer tokens in `Authorization` header only (no query-string tokens). Optional `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`. No cookie-based MCP auth.                      |
| Rate-limit bypass                          | Medium | Per-IP and per-token-hash rate limiting deferred to follow-up; use Cloud Armor or gateway in front of Cloud Run.                                                      |

## Operator security checklist

### Server configuration

- [ ] Set `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth` for production hosted MCP.
- [ ] Set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` to the exact HTTPS URL clients use.
- [ ] Do **not** set `LIGHTDASH_API_KEY` unless running `none` or `shared-key` mode intentionally.
- [ ] Set `LIGHTDASH_TOOLS_SAFETY_MODE=read-only` unless write tools are required.
- [ ] Set `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` to limit cross-project access for all users.
- [ ] Keep `LIGHTDASH_TOOLS_DRY_RUN` off in production unless testing.

### Secrets handling

- [ ] Inject env vars from the platform (Cloud Run secrets, Kubernetes, systemd) — not plaintext `.env` on disk.
- [ ] OAuth client credentials (Client ID/Secret) live in MCP **clients** (Cursor `mcp.json`), not on the MCP server.
- [ ] See [secrets-and-credentials.md](../secrets-and-credentials.md).

### Logging and observability

- [ ] Configure log redaction for `Authorization` and `Proxy-Authorization` headers.
- [ ] Verify audit log entries contain `tokenHash` and `subject` (not raw tokens) for OAuth sessions.
- [ ] Avoid capturing full HTTP request dumps in production.

### Network and deployment

- [ ] Terminate TLS at the platform edge (Cloud Run, load balancer).
- [ ] Restrict ingress where possible (private service connect, allowlisted clients).
- [ ] Document single-instance or sticky-session requirement for in-memory sessions (v1).
- [ ] Plan external session store (Redis) before horizontal scale without affinity.

### Client configuration

- [ ] Use `${env:VAR}` in Cursor `mcp.json` — never commit OAuth client secrets.
- [ ] Register correct OAuth redirect URI in Lightdash (`cursor://anysphere.cursor-mcp/oauth/callback` for Cursor).
- [ ] Validate identity with `ldt__get_authenticated_user` after setup.

## Out of scope (v1 non-goals)

- MCP server as OAuth authorization server
- Refresh token storage on the MCP server
- `LIGHTDASH_OAUTH_CLIENT_SECRET` on the MCP server process
- Per-user safety mode or project allowlist (governance remains process-scoped)
- RFC 8707 audience binding (deferred until Lightdash documents token claims)

## Related documentation

- [mcp-oauth-http.md](../mcp-oauth-http.md) — setup and troubleshooting
- [cursor-lightdash-oauth-mcp.md](../cursor-lightdash-oauth-mcp.md) — Cursor client setup
- [cloud-run-mcp-oauth.md](../cloud-run-mcp-oauth.md) — Cloud Run deployment
- [agent-context/CONTEXT.md](../agent-context/CONTEXT.md) — agent guardrail invariants
