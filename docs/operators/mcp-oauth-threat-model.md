# Threat model: OAuth-backed Streamable HTTP MCP

Security analysis for hosted `@lightdash-tools/mcp` with the **OAuth broker** (server-held Lightdash confidential client). Architecture: [ADR-0007](../adr/0007-mcp-http-transport-auth-modes-sdk-v2.md). Protocol: [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Assets

| Asset                           | Protection need                                                                                                                                                      |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lightdash OAuth client secret   | Server-only; never in MCP client config or logs.                                                                                                                     |
| Lightdash OAuth access token    | Must never be logged or persisted by default.                                                                                                                        |
| Lightdash data and tool results | Must be scoped by Lightdash permissions, profile tool surface (catalog membership), optional HTTP project pin, and optional `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`. |
| MCP endpoint                    | Must not expose tools unauthenticated in production.                                                                                                                 |
| Session / broker pending state  | Must not allow user or token confusion across sessions.                                                                                                              |
| Audit logs                      | Must not leak credentials or unnecessary sensitive raw data.                                                                                                         |

## Threats and mitigations

| Threat                                     | Risk   | Mitigation                                                                                                                                                                                                                                                                                                            |
| :----------------------------------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public unauthenticated MCP endpoint        | High   | Production requires OAuth client credentials + `PUBLIC_URL`, or shared-key+PAT. Unauthenticated HTTP rejected unless `NODE_ENV` is not `production` (e.g. local Compose).                                                                                                                                             |
| Client secret leakage to MCP clients       | High   | Secret stays on MCP process; clients use URL-only config. Broker is confidential client to Lightdash.                                                                                                                                                                                                                 |
| Open redirect / confused deputy on broker  | High   | Bind pending auth to client `redirect_uri` + PKCE + `resource`; Lightdash always sees fixed `{PUBLIC_URL}/oauth/callback` only.                                                                                                                                                                                       |
| Shared PAT overreach                       | High   | PAT/shared-key is secondary; prefer OAuth. Profile tool surface (catalog membership) + Lightdash RBAC (+ optional `X-Lightdash-Project` pin and/or `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`).                                                                                                                          |
| Token replay / audience gap                | High   | Identity validation via `GET /api/v1/user` only until upstream resource-bound tokens. Restrict ingress; one Lightdash OAuth app per deployment.                                                                                                                                                                       |
| Token leakage in logs                      | High   | Redact `Authorization` in reverse proxies and platform logs. Never log raw tokens or client secret. Audit entries use token hash only.                                                                                                                                                                                |
| Token/session confusion                    | High   | Bind sessions to `userUuid` and `organizationUuid`; reject subject or organization mismatch on resume.                                                                                                                                                                                                                |
| OAuth metadata spoofing (wrong public URL) | Medium | Require `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`. Normalize URL. PRM `authorization_servers` = public MCP host (broker), not Lightdash directly.                                                                                                                                                                              |
| Reimplemented RBAC mismatch                | High   | Do not recreate Lightdash object-level permissions in MCP. Delegate to Lightdash API with the user's bearer token.                                                                                                                                                                                                    |
| Agent destructive actions                  | High   | Catalog `profiles` + `listMcpToolNamesByProfile` fix the MCP catalog (ADR-0021; [ADR-0008](../adr/0008-mcp-request-scope-and-hardening.md)); shipped `semantic-layer` profile is discovery/compile only; irrecoverable ops are client-only per [ADR-0004](../adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md). |
| CSRF / browser-origin misuse               | Medium | Bearer tokens in `Authorization` header only. Optional `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`. No cookie-based MCP auth.                                                                                                                                                                                               |
| Rate-limit bypass / session exhaustion     | Medium | Per-subject and global in-memory session caps. Use gateway rate limits in production; keep session TTLs short.                                                                                                                                                                                                        |

## Operator security checklist

### Server configuration

- [ ] Set `LIGHTDASH_URL`, `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET`.
- [ ] Register exactly one Lightdash redirect URI: `{PUBLIC_URL}/oauth/callback`.
- [ ] Confirm deployed profile URL matches intended capability (shipped `semantic-layer` = discovery/compile only; ADR-0021).
- [ ] Pin project via client/gateway `X-Lightdash-Project` when operators need a per-request project, and/or set `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` for a process-level hard allowlist ([ADR-0008](../adr/0008-mcp-request-scope-and-hardening.md)).
- [ ] On Cloud Run / hosted HTTP: leave `LIGHTDASH_TOOLS_AUDIT_LOG` **unset** so tool audits go to stderr → Cloud Logging (`jsonPayload.channel="audit"`). Use a file path only for CLI/local. See [cloud-run.md](cloud-run.md).
- [ ] Do **not** set `LIGHTDASH_API_KEY` for primary OAuth hosting (PAT is secondary / stdio / shared-key).
- [ ] Do not rely on `LIGHTDASH_TOOLS_SAFETY_MODE` / `DRY_RUN` for MCP — those are CLI-only (`LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` is shared with MCP as the project ceiling).

### Secrets handling

- [ ] Inject env vars from the platform (Cloud Run secrets, Kubernetes, systemd) — not plaintext `.env` on disk.
- [ ] Keep OAuth **client secret on the MCP server** only — never in Cursor/Claude `mcp.json`.
- [ ] See [secrets.md](secrets.md).

### Logging and observability

- [ ] Configure log redaction for `Authorization` and `Proxy-Authorization` headers.
- [ ] Tool-output PII redaction in MCP responses ([ADR-0011](../adr/0011-mcp-tool-response-sensitivity-classes.md)) is separate from log/token redaction above — handlers mask emails and omit connection secrets before results reach the agent transcript.
- [ ] Verify audit log entries are structured JSON with `channel="audit"`, and contain `tokenHash` and `subject` (not raw tokens) for OAuth sessions; also expect `clientSessionId` / `profileId` when available.
- [ ] For compliance retention beyond the `_Default` bucket (30 days by default), configure a Cloud Logging sink to a dedicated bucket (or BigQuery/GCS) filtered on `jsonPayload.channel="audit"` — see [cloud-run.md](cloud-run.md).
- [ ] Avoid capturing full HTTP request dumps in production.

### Network and deployment

- [ ] Terminate TLS at the platform edge (Cloud Run, load balancer).
- [ ] Restrict ingress where possible (private service connect, allowlisted clients).
- [ ] Document single-instance or sticky-session requirement for in-memory sessions and broker pending auth (v1).
- [ ] Plan external session store (Redis) before horizontal scale without affinity.

### Client configuration

- [ ] Point Claude Code / Cursor at `https://{host}/semantic-layer/v1/mcp` only (no client secret).
- [ ] Validate identity after setup (e.g. a read tool that hits Lightdash as the user).

## Out of scope (v1 non-goals)

- Full RFC 7591 DCR product (thin stub only if clients require `/register`)
- Refresh token persistence DB / Redis
- `@modelcontextprotocol/server-legacy` AS router
- MCP auth extensions (client-credentials, enterprise-managed)
- CLI process safety mode / allowlist / dry-run on MCP (profile-first; ADR-0008)
- Full RFC 8707 audience enforcement when Lightdash tokens remain opaque

## Related documentation

- [mcp-oauth.md](mcp-oauth.md) — setup and troubleshooting
- [cursor-claude.md](cursor-claude.md) — Cursor client setup
- [cloud-run.md](cloud-run.md) — Cloud Run deployment
- [agent-context.md](agent-context.md) — agent guardrail invariants
