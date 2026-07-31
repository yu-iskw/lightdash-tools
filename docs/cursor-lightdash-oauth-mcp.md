# Cursor / Claude Code: Lightdash MCP (OAuth broker)

Connect Cursor or Claude Code to a hosted `@lightdash-tools/mcp` server. The MCP host holds the Lightdash OAuth client id/secret; clients use **URL-only** config. See [mcp-oauth-http.md](mcp-oauth-http.md) and [ADR-0007](adr/0007-mcp-http-transport-auth-modes-sdk-v2.md).

## Prerequisites

1. MCP HTTP server with:
   - `LIGHTDASH_URL`
   - `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`
   - `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID`
   - `LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET`
2. Lightdash OAuth app redirect URI registered as:

   ```text
   https://{PUBLIC_URL host}/oauth/callback
   ```

3. Client supports Streamable HTTP + OAuth discovery (quit/reopen Cursor after `mcp.json` changes).

## Flow

```text
Client → POST /semantic-layer/v1/mcp (no token) → 401 + WWW-Authenticate
Client → GET PRM → authorization_servers = PUBLIC_URL
Client → OAuth with MCP broker (/oauth/authorize → Lightdash → /oauth/callback)
Client → POST MCP with Bearer access token
MCP    → Lightdash API with same Bearer token
```

## Client configuration (URL only)

| Scope   | Path                 |
| :------ | :------------------- |
| Project | `.cursor/mcp.json`   |
| Global  | `~/.cursor/mcp.json` |

```json
{
  "mcpServers": {
    "lightdash": {
      "url": "https://lightdash-mcp.example.com/semantic-layer/v1/mcp"
    }
  }
}
```

Replace the host with your `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`. Path is persona-owned: `/semantic-layer/v1/mcp`.

**Do not** put `LIGHTDASH_TOOLS_OAUTH_CLIENT_ID` / `_SECRET` (or any Lightdash client secret) in Cursor or Claude Code config.

## Local smoke (Cloudflare Tunnel)

Use Cloudflare quick tunnel so Cursor’s post-callback Mozilla GETs to PRM/AS metadata are not blocked by free-ngrok interstitials.

1. Start MCP on port 3100:

   ```bash
   docker compose -f docker-compose.dev.yml --profile semantic-layer up --build -d
   ```

2. Expose it:

   ```bash
   cloudflared tunnel --url http://127.0.0.1:3100
   ```

3. Copy the printed `https://*.trycloudflare.com` URL into gitignored `.env` as `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`, and into `.cursor/mcp.json` as the MCP `url` host (`…/semantic-layer/v1/mcp`).

4. Recreate the container so it picks up `.env`:

   ```bash
   docker compose -f docker-compose.dev.yml --profile semantic-layer up -d --force-recreate
   ```

5. Register in Lightdash:

   ```text
   {PUBLIC_URL}/oauth/callback
   ```

6. Reconnect the MCP server in Cursor (quit/reopen after `mcp.json` changes if needed).

Quick tunnels are ephemeral — when the hostname changes, update `.env`, recreate Compose, and update the Lightdash redirect URI.

## Optional project pin

Clients/gateways may send `X-Lightdash-Project: <projectUuid>` so the MCP process pins tools to that project ([ADR-0008](adr/0008-mcp-request-scope-and-hardening.md)).

## Troubleshooting

- `401` without `resource_metadata` → server not in OAuth mode (missing client credentials / public URL).
- OAuth redirect errors → confirm Lightdash app redirect is exactly `{PUBLIC_URL}/oauth/callback`.
- Discovery fails → open `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` on the MCP host.
- Identity works but tools fail → check Lightdash RBAC for that user; MCP does not reimplement object permissions.
- OAuth token exchange from Cursor’s loopback page (`http://localhost:8787`) needs CORS on broker routes. The server reflects `Origin` on `/oauth/*` and discovery independently of `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` (persona MCP routes stay allowlist-gated).
- **`Unexpected token 'Y', "You are ab"... is not valid JSON`** / Cursor log `OAuth callback exchange failed` → browser-UA GET hit an **HTML interstitial** (classic **free ngrok** `ERR_NGROK_6024`). Do **not** use free ngrok for Cursor OAuth. Use [Cloudflare Tunnel](#local-smoke-cloudflare-tunnel) (or another public HTTPS edge without an interstitial). Confirm:

  ```bash
  curl -sS -A 'Mozilla/5.0' -H 'Accept: application/json' \
    "$PUBLIC_URL/.well-known/oauth-authorization-server" | head -c 80
  ```

  If you see `You are about to visit`, change the public edge. Bare `curl` without a browser `User-Agent` can still return JSON and is misleading.
