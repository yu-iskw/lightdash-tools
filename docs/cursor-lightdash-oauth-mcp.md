# Cursor remote MCP: Lightdash OAuth mode (experimental)

Configure Cursor to connect to a hosted `@lightdash-tools/mcp` server running with `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`. This mode is **experimental identity-only OAuth** — see [mcp-oauth-http.md](mcp-oauth-http.md) for production readiness limitations.

## Important: experimental identity-only OAuth

`lightdash-oauth` accepts any valid Lightdash OAuth bearer token for the same Lightdash instance and user/org, but **cannot prove the token was issued for this MCP resource**. Lightdash exposes OAuth Authorization Server Metadata at `{LIGHTDASH_URL}/.well-known/oauth-authorization-server`; discovery is supported. The security gap is missing resource/audience-bound token validation, not missing discovery.

## Prerequisites

1. **Deployed MCP HTTP server** with:
   - `LIGHTDASH_URL` — your Lightdash instance
   - `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`
   - `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` — public HTTPS URL of the MCP server (must match what clients use)
   - `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1` when `NODE_ENV=production`
   - `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` — explicit CORS allowlist in production (or `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN=1` only if you accept the risk)
   - `LIGHTDASH_TOOLS_SAFETY_MODE=read-only` (strongly recommended)

2. **Lightdash OAuth application** registered in your Lightdash instance. The MCP server does not store OAuth client secrets; credentials live in the MCP client (Cursor).

3. **Cursor** with remote MCP and OAuth support (Streamable HTTP). Completely quit and reopen Cursor after changing MCP config — servers load at startup.

## How OAuth works with Lightdash

```text
Cursor  →  POST /semantic-layer/v1/mcp (no token)  →  401 + WWW-Authenticate
Cursor  →  GET /.well-known/oauth-protected-resource  →  metadata
Cursor  →  Discover AS metadata at {LIGHTDASH_URL}/.well-known/oauth-authorization-server
Cursor  →  OAuth with Lightdash (or use static endpoints if discovery fails)
Cursor  →  POST /semantic-layer/v1/mcp  Authorization: Bearer <user-access-token>
MCP     →  Lightdash API with same Bearer token
```

The MCP server is the **resource server**. Lightdash is the **authorization server** and upstream API.

## Lightdash OAuth application setup

When creating the OAuth application in Lightdash:

1. Note the **Client ID** (and **Client Secret** if Lightdash issues one).
2. Register the Cursor OAuth redirect URI:

   ```text
   cursor://anysphere.cursor-mcp/oauth/callback
   ```

3. Request scopes aligned with your deployment. The MCP server advertises an empty `scopes_supported` list by default; authorization is enforced by Lightdash RBAC and MCP safety mode, not MCP-local scopes on opaque tokens.

The MCP server does **not** need `LIGHTDASH_OAUTH_CLIENT_SECRET`. Client credentials belong in Cursor's `mcp.json` or environment, not on the server.

## Cursor MCP configuration

Configuration file locations:

| Scope   | Path                                         |
| :------ | :------------------------------------------- |
| Project | `.cursor/mcp.json` (commit for team sharing) |
| Global  | `~/.cursor/mcp.json`                         |

### Recommended: URL-only discovery (when supported)

Current Lightdash publishes OAuth Authorization Server Metadata. Prefer discovery first — protected-resource metadata on the MCP server points at your Lightdash issuer:

```json
{
  "mcpServers": {
    "lightdash": {
      "url": "https://lightdash-mcp.example.com/semantic-layer/v1/mcp"
    }
  }
}
```

Replace `https://lightdash-mcp.example.com` with your `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` host. The MCP path is persona-owned: `/semantic-layer/v1/mcp` (not `/mcp`).

### Fallback: static OAuth client credentials

If discovery fails or your client requires explicit endpoints, configure Lightdash OAuth URLs directly:

Lightdash OAuth endpoints (replace `{LIGHTDASH_URL}` with your instance):

| Purpose   | URL                                      |
| :-------- | :--------------------------------------- |
| Authorize | `{LIGHTDASH_URL}/api/v1/oauth/authorize` |
| Token     | `{LIGHTDASH_URL}/api/v1/oauth/token`     |
| Register  | `{LIGHTDASH_URL}/api/v1/oauth/register`  |
| Revoke    | `{LIGHTDASH_URL}/api/v1/oauth/revoke`    |
| Userinfo  | `{LIGHTDASH_URL}/api/v1/oauth/userinfo`  |

```json
{
  "mcpServers": {
    "lightdash": {
      "url": "https://lightdash-mcp.example.com/semantic-layer/v1/mcp",
      "auth": {
        "CLIENT_ID": "${env:LIGHTDASH_OAUTH_CLIENT_ID}",
        "CLIENT_SECRET": "${env:LIGHTDASH_OAUTH_CLIENT_SECRET}",
        "scopes": ["read", "write", "mcp:read", "mcp:write"]
      }
    }
  }
}
```

Set credentials in your shell or secret manager — do not commit secrets to `mcp.json`:

```bash
export LIGHTDASH_OAUTH_CLIENT_ID="your-client-id"
export LIGHTDASH_OAUTH_CLIENT_SECRET="your-client-secret"  # if required
```

Use `${env:VAR}` interpolation per [Cursor MCP docs](https://cursor.com/docs/mcp).

### Not for lightdash-oauth: static Bearer header

Do **not** put a Lightdash PAT in `headers.Authorization` for `lightdash-oauth` mode. Cursor must obtain a per-user OAuth access token. Static bearer headers are for `shared-key` HTTP mode only.

## Verify the connection

1. **Metadata** (from any machine):

   ```bash
   curl -s "https://lightdash-mcp.example.com/.well-known/oauth-protected-resource" | jq .
   curl -s "https://app.lightdash.cloud/.well-known/oauth-authorization-server" | jq .
   ```

2. **In Cursor**, after connecting, call the diagnostic tool:

   ```text
   ldt__get_authenticated_user
   ```

   Confirm the returned user matches your Lightdash account.

3. **Smoke test** read tools:

   ```text
   ldt__list_projects
   ```

4. **Second user**: repeat with a different Lightdash account and confirm `ldt__get_authenticated_user` returns a different identity.

## Governance reminders

Server-side guardrails are process-scoped (set by the operator, not per user):

- `LIGHTDASH_TOOLS_SAFETY_MODE` — default `read-only`
- `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` — restrict which projects all users can touch
- `LIGHTDASH_TOOLS_DRY_RUN` — simulate writes

Lightdash object-level permissions still apply per user via their OAuth token.

## Troubleshooting

| Symptom                                     | Likely cause                                         | Fix                                                                                |
| :------------------------------------------ | :--------------------------------------------------- | :--------------------------------------------------------------------------------- |
| Server shows "Needs authentication" forever | Metadata URL mismatch or OAuth app misconfigured     | Verify `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`; check redirect URI in Lightdash OAuth app |
| OAuth discovery fails                       | Client or network cannot reach Lightdash AS metadata | Use static OAuth endpoints fallback (see table above)                              |
| 401 after Connect                           | Expired token or validation failure                  | Run **Cursor: Clear All MCP Tokens** from the command palette; reconnect           |
| `Session token mismatch`                    | Switched Lightdash user on same session              | Disconnect and reconnect; clear MCP tokens                                         |
| Tools return permission errors              | Lightdash RBAC for that user                         | Expected — OAuth scoping works; user may lack project access                       |
| `404` on `/semantic-layer/v1/mcp`           | Wrong URL in `mcp.json`                              | Use full path: `https://host/semantic-layer/v1/mcp`                                |
| OAuth works but wrong Lightdash instance    | `LIGHTDASH_URL` on server points elsewhere           | Fix server env and redeploy                                                        |

## See also

- [mcp-oauth-http.md](mcp-oauth-http.md) — auth modes, env vars, migration
- [cloud-run-mcp-oauth.md](cloud-run-mcp-oauth.md) — hosted deployment
- [security/mcp-oauth-threat-model.md](security/mcp-oauth-threat-model.md) — security checklist
