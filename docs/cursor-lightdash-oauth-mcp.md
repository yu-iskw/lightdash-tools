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

## Optional project pin

Clients/gateways may send `X-Lightdash-Project: <projectUuid>` so the MCP process pins tools to that project ([ADR-0008](adr/0008-mcp-request-scope-and-hardening.md)).

## Troubleshooting

- `401` without `resource_metadata` → server not in OAuth mode (missing client credentials / public URL).
- OAuth redirect errors → confirm Lightdash app redirect is exactly `{PUBLIC_URL}/oauth/callback`.
- Discovery fails → open `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` on the MCP host.
- Identity works but tools fail → check Lightdash RBAC for that user; MCP does not reimplement object permissions.
