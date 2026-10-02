# Threat model: OAuth-backed Streamable HTTP MCP

Security analysis for hosted `@lightdash-tools/mcp` with the **dual-leg OAuth broker** (server-held Lightdash confidential client + broker-issued MCP access tokens). Architecture: [ADR-0007](../adr/0007-mcp-http-transport-auth-modes-sdk-v2.md) as amended by [ADR-0026](../adr/0026-mcp-oauth-dual-leg-token-boundary.md) and [ADR-0027](../adr/0027-mcp-oauth-extra-invoke-origins.md). Protocol: [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization). Security guidance: [MCP Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices).

## Assets

| Asset                           | Protection need                                                                                                                                                      |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lightdash OAuth client secret   | Server-only; never in MCP client config or logs. Also derives the v1 MCP token AEAD key ([ADR-0026](../adr/0026-mcp-oauth-dual-leg-token-boundary.md)).              |
| Broker-issued MCP access token  | Audience-bound `ldmcp1.*` bearer; must not be logged in plaintext; theft allows MCP use until expiry.                                                                |
| Lightdash OAuth access token    | Must never be returned to MCP clients as a reusable bearer; recoverable only server-side from a valid broker token. Never logged or persisted by default.            |
| Lightdash data and tool results | Must be scoped by Lightdash permissions, profile tool surface (catalog membership), optional HTTP project pin, and optional `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`. |
| MCP endpoint                    | Must not expose tools unauthenticated in production.                                                                                                                 |
| Broker pending / DCR / codes    | Process-local; must not allow user or token confusion across pending authorizations.                                                                                 |
| Audit logs                      | Must not leak credentials or unnecessary sensitive raw data.                                                                                                         |

## Threats and mitigations

| Threat                                          | Risk   | Mitigation                                                                                                                                                                                                                                                                                             |
| :---------------------------------------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public unauthenticated MCP endpoint             | High   | Production requires OAuth client credentials + `PUBLIC_URL`, or shared-key+PAT. Unauthenticated HTTP rejected unless `NODE_ENV` is not `production` (e.g. local Compose).                                                                                                                              |
| Client secret leakage to MCP clients            | High   | Secret stays on MCP process; clients use URL-only config. Broker is confidential client to Lightdash.                                                                                                                                                                                                  |
| Token passthrough / MCP audience gap            | High   | **Mitigated ([ADR-0026](../adr/0026-mcp-oauth-dual-leg-token-boundary.md))**: broker mints resource-bound `ldmcp1.*` tokens; RS rejects raw Lightdash bearers, wrong-profile tokens, tampered/expired tokens before any Lightdash call. Downstream credential is recovered only after local verify.    |
| Confused deputy (static Lightdash client + DCR) | High   | **Open**: redirect_uri + PKCE + `resource` binding and fixed `{PUBLIC_URL}/oauth/callback` reduce some abuse, but MCP Security Best Practices still require per-client consent before forwarding to the third-party AS. Not implemented in this release.                                               |
| Shared PAT overreach                            | High   | PAT/shared-key is secondary; prefer OAuth. Profile tool surface (catalog membership) + Lightdash RBAC (+ optional `X-Lightdash-Project` pin and/or `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`).                                                                                                           |
| AEAD key / client-secret compromise             | High   | Compromise of `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET` can decrypt outstanding MCP tokens (each carries a delegated Lightdash credential). Inject from a secret manager; rotate invalidates all MCP sessions; future dedicated MCP token key is a follow-up.                                              |
| No per-token MCP revocation                     | Medium | Self-contained broker tokens stop on expiry, upstream Lightdash revocation, or OAuth client-secret rotation. Opaque shared token store is out of scope (conflicts with ADR-0019 unless product requires revoke).                                                                                       |
| Token leakage in logs                           | High   | Redact `Authorization` in reverse proxies and platform logs. Never log raw tokens or client secret. Audit entries use token hash only.                                                                                                                                                                 |
| Token/session confusion                         | High   | Bind sessions to `userUuid` and `organizationUuid`; reject subject or organization mismatch on resume.                                                                                                                                                                                                 |
| OAuth metadata spoofing (wrong public URL)      | Medium | Require `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`. Normalize URL. PRM `authorization_servers` = public MCP host (broker), not Lightdash directly. Extra `INVOKE_ORIGINS` rewrite metadata only when `Host` matches an explicit listed origin.                                                                   |
| Extra-origin Host spoofing on the public VIP    | Medium | Rewrite PRM/token/DCR only for listed origins. Do not route extra-origin Hostnames on the public VIP. Cleartext HTTP extra origins are for private networks; `@modelcontextprotocol/client` v2 is unsupported there ([ADR-0027](../adr/0027-mcp-oauth-extra-invoke-origins.md)).                       |
| Spoofed `X-Forwarded-Proto` on extra origins    | Medium | Scheme is part of origin match. Trust `X-Forwarded-Proto` only from the private proxy that terminates the extra hostname; strip or overwrite it on the public VIP. A client that can set both `Host` and proto to a listed HTTP origin gets HTTP token/DCR URLs.                                       |
| Reimplemented RBAC mismatch                     | High   | Do not recreate Lightdash object-level permissions in MCP. Delegate to Lightdash API with the recovered downstream credential after broker-token validation.                                                                                                                                           |
| Agent destructive actions                       | High   | Profile `tools` mounts fix the MCP catalog (ADR-0006 / ADR-0022; [ADR-0008](../adr/0008-mcp-request-scope-and-hardening.md)); shipped `semantic-layer` profile is discovery/compile only; irrecoverable ops are client-only per [ADR-0004](../adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md). |
| CSRF / browser-origin misuse                    | Medium | Bearer tokens in `Authorization` header only. Optional `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`. No cookie-based MCP auth.                                                                                                                                                                                |
| Rate-limit bypass / pending-store exhaustion    | Medium | Bounded in-memory broker pending/DCR/code caps. Use gateway rate limits in production; keep pending TTLs short. Sticky `/oauth/*` or single replica while handshake is in flight.                                                                                                                      |

## Operator security checklist

### Server configuration

- [ ] Set `LIGHTDASH_URL`, `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`, `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET`.
- [ ] If VPC clients use an extra hostname: set `LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS` (do not point `PUBLIC_URL` at that origin; do not serve that Host on the public VIP).
- [ ] Register exactly one Lightdash redirect URI: `{PUBLIC_URL}/oauth/callback`.
- [ ] Confirm deployed profile URL matches intended capability (shipped `semantic-layer` = discovery/compile only; ADR-0006).
- [ ] Pin project via client/gateway `X-Lightdash-Project` when operators need a per-request project, and/or set `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` for a process-level hard allowlist ([ADR-0008](../adr/0008-mcp-request-scope-and-hardening.md)).
- [ ] On Cloud Run / hosted HTTP: leave `LIGHTDASH_TOOLS_AUDIT_LOG` **unset** so tool audits go to stderr → Cloud Logging (`jsonPayload.channel="audit"`). Use a file path only for CLI/local. See [cloud-run.md](cloud-run.md).
- [ ] Do **not** set `LIGHTDASH_API_KEY` for primary OAuth hosting (PAT is secondary / stdio / shared-key).
- [ ] Do not rely on `LIGHTDASH_TOOLS_SAFETY_MODE` / `DRY_RUN` for MCP — those are CLI-only (`LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` is shared with MCP as the project ceiling).
- [ ] After upgrade to dual-leg tokens: force MCP clients to re-authenticate (cached raw Lightdash bearers are rejected).

### Secrets handling

- [ ] Inject env vars from the platform (Cloud Run secrets, Kubernetes, systemd) — not plaintext `.env` on disk.
- [ ] Keep OAuth **client secret on the MCP server** only — never in Cursor/Claude `mcp.json`.
- [ ] Treat client-secret rotation as a mass MCP re-auth event (v1 AEAD key is derived from that secret).
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
- [ ] Sticky-route `/oauth/*` (or single replica) for in-memory broker pending/DCR/code handshake; profile MCP paths may be load-balanced after token issuance ([ADR-0019](../adr/0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md) / [ADR-0026](../adr/0026-mcp-oauth-dual-leg-token-boundary.md)).
- [ ] Do not reintroduce Redis solely for OAuth pending state unless a later ADR supersedes ADR-0019.

### Client configuration

- [ ] Point Claude Code / Cursor at `https://{host}/semantic-layer/v1/mcp` only (no client secret).
- [ ] After dual-leg deploy, re-run OAuth so clients hold `ldmcp1.*` tokens rather than raw Lightdash bearers.
- [ ] Validate identity after setup (e.g. a read tool that hits Lightdash as the user).

## Out of scope (v1 non-goals)

- Full RFC 7591 DCR product (thin stub only if clients require `/register`)
- Client ID Metadata Documents (CIMD) as the primary registration path
- Refresh token persistence DB / Redis
- `@modelcontextprotocol/server-legacy` AS router
- MCP auth extensions (client-credentials, enterprise-managed)
- CLI process safety mode / allowlist / dry-run on MCP (profile-first; ADR-0008)
- Per-client consent UI before the static Lightdash OAuth redirect (confused-deputy follow-up)
- Dedicated MCP token encryption secret separate from the Lightdash OAuth client secret
- Independent MCP max TTL cap beyond upstream Lightdash `expires_in`
- Opaque / shared MCP access-token store for fine-grained revocation

## Related documentation

- [mcp-oauth.md](mcp-oauth.md) — setup and troubleshooting
- [ADR-0026](../adr/0026-mcp-oauth-dual-leg-token-boundary.md) — dual-leg token boundary
- [ADR-0027](../adr/0027-mcp-oauth-extra-invoke-origins.md) — extra invoke origins
- [cursor-claude.md](cursor-claude.md) — Cursor client setup
- [cloud-run.md](cloud-run.md) — Cloud Run deployment
- [agent-context.md](agent-context.md) — agent guardrail invariants
