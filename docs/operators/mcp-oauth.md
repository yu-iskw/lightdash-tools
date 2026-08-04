# OAuth-backed Streamable HTTP MCP

Operator guide for hosted `@lightdash-tools/mcp` with a **server-held Lightdash OAuth application** (confidential client + broker). Architecture: [ADR-0007](../adr/0007-mcp-http-transport-auth-modes-sdk-v2.md). Protocol: [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization). Threat model: [mcp-oauth-threat-model.md](mcp-oauth-threat-model.md).

## Mental model

| Role                                   | Who                                                               |
| :------------------------------------- | :---------------------------------------------------------------- |
| Lightdash OAuth app (client id/secret) | **MCP server** env                                                |
| Redirect URI (one, shared)             | `{PUBLIC_URL}/oauth/callback`                                     |
| AS façade for MCP clients              | MCP host (`/oauth/*`, PRM `authorization_servers` = `PUBLIC_URL`) |
| Resource servers                       | Profile paths (`/semantic-layer/v1/mcp`, …)                       |
| MCP clients (Claude Code / Cursor)     | **URL only** — no client secret                                   |

Auth mode is **inferred** from credentials (no `LIGHTDASH_TOOLS_MCP_AUTH_MODE`).

## Limitations (honest)

| Capability                                                    | Status                                        |
| :------------------------------------------------------------ | :-------------------------------------------- |
| Per-user bearer to Lightdash                                  | Supported                                     |
| Server-held confidential client + shared callback             | Supported                                     |
| PRM + broker AS metadata                                      | Supported                                     |
| Full RFC 8707 audience enforcement on opaque Lightdash tokens | **Limited** — identity via `GET /api/v1/user` |

Authorization in practice: Lightdash RBAC + catalog `profiles` + `listMcpToolNamesByProfile` (ADR-0006) + optional `X-Lightdash-Project` pin and/or `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` ([ADR-0008](../adr/0008-mcp-request-scope-and-hardening.md)).

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

Verify:

```bash
curl -s "https://lightdash-mcp.example.com/.well-known/oauth-protected-resource" | jq .
# authorization_servers: ["https://lightdash-mcp.example.com"]

curl -s "https://lightdash-mcp.example.com/.well-known/oauth-authorization-server" | jq .
# authorization_endpoint / token_endpoint / registration_endpoint under /oauth/*
```

MCP endpoint: `POST/GET/DELETE /semantic-layer/v1/mcp`.

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

## Environment reference

| Variable                              | Role                                                                    |
| :------------------------------------ | :---------------------------------------------------------------------- |
| `LIGHTDASH_URL`                       | Lightdash instance                                                      |
| `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`      | Public base URL (required for OAuth)                                    |
| `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`     | Server-held Lightdash app client id                                     |
| `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET` | Server-held Lightdash app client secret                                 |
| `LIGHTDASH_TOOLS_MCP_SHARED_KEY`      | Secondary shared-key gateway                                            |
| `LIGHTDASH_API_KEY`                   | Stdio / shared-key / local none upstream PAT                            |
| `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` | Optional CORS allowlist                                                 |
| `LIGHTDASH_TOOLS_AUDIT_LOG`           | Optional file path (CLI/local); unset → stderr JSON audit               |
| `LIGHTDASH_TOOLS_MCP_HTTP_PORT`       | Default `3100`; if unset, platform `PORT` (e.g. Cloud Run), else `3100` |

**Rejected at startup** (removed): `LIGHTDASH_TOOLS_MCP_AUTH_MODE`, `EXPERIMENTAL_IDENTITY_OAUTH`, `DANGEROUSLY_*`, `ALLOW_INSECURE_PUBLIC_URL`, `LIGHTDASH_TOOLS_MCP_INSECURE_DEV`, `LIGHTDASH_TOOLS_MCP_PATH`.

CLI-only (ignored for MCP auth): `LIGHTDASH_TOOLS_SAFETY_MODE`, `DRY_RUN`. Shared with MCP: `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS`.

## Broker routes

| Path                                      | Purpose                                                       |
| :---------------------------------------- | :------------------------------------------------------------ |
| `/oauth/authorize`                        | Start client OAuth; redirect to Lightdash with fixed callback |
| `/oauth/callback`                         | Lightdash redirect; exchange code with client secret          |
| `/oauth/token`                            | Client token exchange (PKCE)                                  |
| `/oauth/register`                         | Thin DCR stub (public client)                                 |
| `/.well-known/oauth-authorization-server` | Broker AS metadata                                            |
| `/.well-known/oauth-protected-resource`   | PRM (`authorization_servers` = `PUBLIC_URL`)                  |

## Related

- [cursor-claude.md](cursor-claude.md)
- [cloud-run.md](cloud-run.md)
- [mcp-oauth-threat-model.md](mcp-oauth-threat-model.md)
- [secrets.md](secrets.md)
