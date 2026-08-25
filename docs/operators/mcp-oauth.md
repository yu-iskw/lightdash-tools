# OAuth-backed Streamable HTTP MCP

Operator guide for hosted `@lightdash-tools/mcp` with a **server-held Lightdash OAuth application** (confidential client + dual-leg broker). Architecture: [ADR-0007](../adr/0007-mcp-http-transport-auth-modes-sdk-v2.md) as amended by [ADR-0026](../adr/0026-mcp-oauth-dual-leg-token-boundary.md) and [ADR-0027](../adr/0027-mcp-oauth-extra-invoke-origins.md). Protocol: [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization). Threat model: [mcp-oauth-threat-model.md](mcp-oauth-threat-model.md).

## Mental model

| Role                                   | Who                                                                                                              |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| Lightdash OAuth app (client id/secret) | **MCP server** env (downstream confidential client)                                                              |
| Redirect URI (one, shared)             | `{PUBLIC_URL}/oauth/callback`                                                                                    |
| AS façade for MCP clients              | MCP host (`/oauth/*`, PRM `authorization_servers` = `PUBLIC_URL`, or an extra invoke origin when `Host` matches) |
| MCP access token                       | Broker-issued `ldmcp1.*` AEAD bearer; audience = exact enabled profile resource                                  |
| Downstream Lightdash credential        | Recovered server-side from the broker token only; never returned as the MCP client bearer                        |
| Resource servers                       | Profile paths (`/semantic-layer/v1/mcp`, …)                                                                      |
| MCP clients (Claude Code / Cursor)     | **URL only** — no client secret                                                                                  |

Auth mode is **inferred** from credentials (no `LIGHTDASH_TOOLS_MCP_AUTH_MODE`).

```text
MCP client
    |
    | broker-issued MCP token (audience = exact profile resource)
    v
lightdash-tools MCP server
    |
    | decrypt + validate broker token
    | recover delegated Lightdash credential
    v
Lightdash API
```

## Limitations (honest)

| Capability                                                        | Status                                                                                                                                                                                              |
| :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-user delegated access to Lightdash                            | Supported                                                                                                                                                                                           |
| Server-held confidential client + shared callback                 | Supported                                                                                                                                                                                           |
| PRM + broker AS metadata                                          | Supported                                                                                                                                                                                           |
| RFC 8707 MCP resource / audience binding                          | Supported — broker-issued `ldmcp1.*` bound to exact profile resource                                                                                                                                |
| Reject raw Lightdash bearers as MCP credentials                   | Supported                                                                                                                                                                                           |
| One replica or dedicated `/oauth/*` during authorize→token        | Required — in-memory pending/DCR/code store; on Cloud Run behind GCLB do **not** treat LB affinity as sticky ([ADR-0019](../adr/0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)) |
| Stateless profile MCP requests after token issuance               | Supported — any replica sharing the OAuth client secret                                                                                                                                             |
| Per-client consent UI before Lightdash redirect (confused deputy) | **Not implemented** — see threat model                                                                                                                                                              |
| Per-token MCP revocation store                                    | **Not implemented** — expiry / client-secret rotation / upstream revoke                                                                                                                             |

Authorization in practice: Lightdash RBAC + profile `tools` mounts (ADR-0006 / ADR-0022) + optional `X-Lightdash-Project` pin and/or `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` ([ADR-0008](../adr/0008-mcp-request-scope-and-hardening.md)).

### Breaking change

Deployments that previously accepted a raw Lightdash access token as the MCP `Authorization: Bearer` value will reject those tokens after upgrade. Existing MCP clients must complete the OAuth flow again so they receive a broker-issued `ldmcp1.*` token.

## Primary: hosted OAuth

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export LIGHTDASH_TOOLS_OAUTH_CLIENT_ID="..."
export LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET="..."

npx @lightdash-tools/mcp http
```

1. Create a Lightdash OAuth application.
2. Register redirect URI exactly: `https://lightdash-mcp.example.com/oauth/callback`.
3. Put client id/secret on the **MCP server** (Secret Manager / platform env), never in client `mcp.json`.
4. For multi-replica hosting: one broker replica or a dedicated `/oauth/*` service (GCLB affinity does not pin Cloud Run instances); profile MCP paths may load-balance.

Verify:

```bash
curl -fsS "https://lightdash-mcp.example.com/health/live"
# {"status":"ok"} — unauthenticated process probe (not OAuth)

curl -s "https://lightdash-mcp.example.com/.well-known/oauth-protected-resource" | jq .
# authorization_servers: ["https://lightdash-mcp.example.com"]

curl -s "https://lightdash-mcp.example.com/.well-known/oauth-authorization-server" | jq .
# authorization_endpoint / token_endpoint / registration_endpoint under /oauth/*
```

MCP endpoint: `POST/GET/DELETE /semantic-layer/v1/mcp`.

## Extra invoke origins (private load balancer / internal DNS)

Optional. Use when VPC clients reach the same process on a **different** origin than `PUBLIC_URL` (internal HTTP LB, private DNS, Kubernetes Service) and must not fetch public well-known through a WAF.

Do **not** point `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` at the extra origin. Prefer same-hostname private TLS when you can; this env covers extra hostnames, including cleartext HTTP.

```bash
export LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS="http://mcp.ilb.internal"
```

Comma-separated absolute `http(s)` origins, no path. Invalid values fail OAuth startup. Matching is the full origin (scheme + host + port), not hostname alone. Scheme comes from `X-Forwarded-Proto` (first value), else TLS, else `http` — set the env origin to the scheme clients use, and make sure the proxy forwards that proto.

On a matching `Host`:

- PRM `resource` / `authorization_servers` and AS `token_endpoint` / `registration_endpoint` use the extra origin
- AS `issuer`, `/oauth/authorize`, and `/oauth/callback` stay on `PUBLIC_URL`
- Broker tokens are bound to `{invokeOrigin}{profilePath}`

Client contract for those origins:

- Server URL = extra origin + profile path (for example `http://mcp.ilb.internal/semantic-layer/v1/mcp`)
- Resource URL **empty** (the server URL becomes RFC 8707 `resource`). A public Resource URL causes mismatch
- Enable DCR if the client requires `/oauth/register`

`@modelcontextprotocol/client` **v2** will reject HTTP invoke origins (`IssuerMismatchError`, `InsecureTokenEndpointError`). Point that SDK at public HTTPS. Do not serve extra-origin Hostnames on the public VIP.

## Secondary: PAT / local

| Use                        | Env                                       |
| :------------------------- | :---------------------------------------- |
| Stdio                      | `LIGHTDASH_URL` + `LIGHTDASH_API_KEY`     |
| Shared-key HTTP gateway    | + `LIGHTDASH_TOOLS_MCP_SHARED_KEY`        |
| Local unauthenticated HTTP | `NODE_ENV=development` (not `production`) |

Compose local profile uses `NODE_ENV=development` + credentials from `.env` (see `docker-compose.dev.yml`). For hosted OAuth against Cursor, expose port `3100` with Cloudflare Tunnel and set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` to the `*.trycloudflare.com` URL — see [cursor-claude.md](cursor-claude.md). Do not use free ngrok for that path.

## Client config (Claude Code / Cursor)

URL only:

```json
{
  "mcpServers": {
    "lightdash": {
      "url": "https://lightdash-mcp.example.com/semantic-layer/v1/mcp"
    }
  }
}
```

Do **not** put `LIGHTDASH_TOOLS_OAUTH_CLIENT_*` in the client. See [cursor-claude.md](cursor-claude.md).

After deploying the dual-leg broker, re-run the client OAuth login so cached raw Lightdash tokens are replaced with `ldmcp1.*` broker tokens.

## Environment reference

| Variable                              | Role                                                                                                  |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_URL`                       | Lightdash instance                                                                                    |
| `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`      | Public base URL (required for OAuth)                                                                  |
| `LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS`  | Optional extra invoke origins (comma-separated; host-aware PRM/token/DCR)                             |
| `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`     | Server-held Lightdash app client id                                                                   |
| `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET` | Server-held Lightdash app client secret (also derives MCP token AEAD key)                             |
| `LIGHTDASH_TOOLS_MCP_SHARED_KEY`      | Secondary shared-key gateway                                                                          |
| `LIGHTDASH_API_KEY`                   | Stdio / shared-key / local none upstream PAT                                                          |
| `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` | Optional browser Origin allowlist (403 if present and not listed; empty is correct for Cursor/Claude) |
| `LIGHTDASH_TOOLS_AUDIT_LOG`           | Optional file path (CLI/local); unset → stderr JSON audit                                             |
| `LIGHTDASH_TOOLS_MCP_HTTP_PORT`       | Default `3100`; if unset, platform `PORT` (e.g. Cloud Run), else `3100`                               |
| `LIGHTDASH_TOOLS_MCP_PROFILES`        | Optional HTTP mount allowlist (comma-separated profile ids; unset = all)                              |

**Rejected at startup** (removed): `LIGHTDASH_TOOLS_MCP_AUTH_MODE`, `EXPERIMENTAL_IDENTITY_OAUTH`, `DANGEROUSLY_*`, `ALLOW_INSECURE_PUBLIC_URL`, `LIGHTDASH_TOOLS_MCP_INSECURE_DEV`, `LIGHTDASH_TOOLS_MCP_PATH`.

CLI-only (ignored for MCP auth): `LIGHTDASH_TOOLS_SAFETY_MODE`, `DRY_RUN`. Shared with MCP: `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`. HTTP-only: `LIGHTDASH_TOOLS_MCP_PROFILES` (stdio still uses `--profile`).

## Broker routes

| Path                                      | Purpose                                                                                                    |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `/oauth/authorize`                        | Start client OAuth; require `resource`; redirect to Lightdash with fixed callback                          |
| `/oauth/callback`                         | Lightdash redirect; exchange code with client secret                                                       |
| `/oauth/token`                            | PKCE + same `resource`; mint `ldmcp1.*` MCP access token                                                   |
| `/oauth/register`                         | Thin DCR stub (public client)                                                                              |
| `/.well-known/oauth-authorization-server` | Broker AS metadata (token/DCR URLs follow `Host` when it matches `INVOKE_ORIGINS`)                         |
| `/.well-known/oauth-protected-resource`   | PRM (`authorization_servers` = request origin when Host matches an extra invoke origin; else `PUBLIC_URL`) |
| `/health/live`, `/health/ready`           | Unauthenticated process probes (not OAuth; see [cloud-run.md](cloud-run.md))                               |

## Related

- [ADR-0026 — dual-leg MCP OAuth token boundary](../adr/0026-mcp-oauth-dual-leg-token-boundary.md)
- [ADR-0027 — extra invoke origins](../adr/0027-mcp-oauth-extra-invoke-origins.md)
- [ADR-0032 — HTTP three-plane control ownership](../adr/0032-mcp-http-three-plane-security-control-ownership.md)
- [http-control-plane.md](http-control-plane.md) — edge vs Cloud Run vs MCP process
- [cursor-claude.md](cursor-claude.md)
- [cloud-run.md](cloud-run.md)
- [mcp-oauth-threat-model.md](mcp-oauth-threat-model.md)
- [secrets.md](secrets.md)
