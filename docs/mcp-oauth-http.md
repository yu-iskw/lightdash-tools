# OAuth-backed Streamable HTTP MCP

Operator guide for hosted `@lightdash-tools/mcp` deployments that authenticate each MCP user with Lightdash OAuth. For architecture and design rationale, see [RFC 0040](rfc/0040-oauth-backed-streamable-http-mcp.md) and [ADR 0040](adr/0040-oauth-backed-streamable-http-mcp.md).

## Overview

`@lightdash-tools/mcp` supports two transports:

| Transport           | Entrypoint                                          | Typical use                                         |
| :------------------ | :-------------------------------------------------- | :-------------------------------------------------- |
| **STDIO**           | `npx @lightdash-tools/mcp` or `lightdash-mcp stdio` | Local IDE agents (Claude Desktop, Cursor local)     |
| **Streamable HTTP** | `npx @lightdash-tools/mcp serve-http` or `--http`   | Remote hosted MCP (Cursor remote, team deployments) |

In **lightdash-oauth** HTTP mode:

- Each MCP client user completes Lightdash OAuth and sends `Authorization: Bearer <access-token>` to the MCP endpoint.
- The MCP server validates the token against Lightdash (`GET /api/v1/user`) and forwards the same bearer token upstream.
- Lightdash remains the authorization server and permission source.
- **`LIGHTDASH_API_KEY` is not required** on the MCP server.

## Auth modes

| Mode              | Transport | MCP endpoint auth                       | Lightdash upstream auth                | `LIGHTDASH_API_KEY` required |
| :---------------- | :-------- | :-------------------------------------- | :------------------------------------- | :--------------------------- |
| `env`             | STDIO     | N/A (host owns process)                 | `Authorization: ApiKey ldpat_…`        | Yes                          |
| `none`            | HTTP      | None (startup warning)                  | `Authorization: ApiKey ldpat_…`        | Yes                          |
| `shared-key`      | HTTP      | Shared `LIGHTDASH_TOOLS_MCP_SHARED_KEY` | `Authorization: ApiKey ldpat_…`        | Yes                          |
| `lightdash-oauth` | HTTP      | User's Lightdash OAuth bearer           | `Authorization: Bearer …` (same token) | **No**                       |

**Production recommendation:** `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`.

`none` logs a startup warning and should be used for local development only:

```text
Warning: LIGHTDASH_TOOLS_MCP_AUTH_MODE=none — MCP HTTP endpoint is unauthenticated. Use lightdash-oauth or shared-key in production.
```

## Quick start (lightdash-oauth)

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_MCP_AUTH_MODE="lightdash-oauth"
export LIGHTDASH_TOOLS_MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export LIGHTDASH_TOOLS_SAFETY_MODE="read-only"
export LIGHTDASH_TOOLS_ALLOWED_PROJECTS="project_uuid_1,project_uuid_2"

npx @lightdash-tools/mcp serve-http
```

Verify metadata:

```bash
curl -s "https://lightdash-mcp.example.com/.well-known/oauth-protected-resource" | jq .
```

Expected shape:

```json
{
  "resource": "https://lightdash-mcp.example.com/mcp",
  "authorization_servers": ["https://app.lightdash.cloud"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["read", "write", "mcp:read", "mcp:write"]
}
```

## Environment variables

### Official Lightdash variables

| Variable                        | Modes                       | Required | Description                                                                           |
| :------------------------------ | :-------------------------- | :------: | :------------------------------------------------------------------------------------ |
| `LIGHTDASH_URL`                 | All                         |   Yes    | Lightdash instance base URL (trailing slash stripped).                                |
| `LIGHTDASH_API_KEY`             | STDIO, `none`, `shared-key` |   Yes    | PAT/API key for upstream Lightdash calls. **Not required in `lightdash-oauth` mode.** |
| `LIGHTDASH_PROXY_AUTHORIZATION` | Optional                    |    No    | Forwarded as `Proxy-Authorization` on Lightdash API calls.                            |

### Governance variables (process-scoped)

These apply to all auth modes and remain operator-configured (not per OAuth user). See [docs/secrets-and-credentials.md](secrets-and-credentials.md).

| Variable                           | Default     | Description                                                   |
| :--------------------------------- | :---------- | :------------------------------------------------------------ |
| `LIGHTDASH_TOOLS_SAFETY_MODE`      | `read-only` | `read-only`, `write-idempotent`, `write-destructive`.         |
| `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` | (empty)     | Comma-separated project UUID allowlist. Empty = all projects. |
| `LIGHTDASH_TOOLS_DRY_RUN`          | off         | `1`, `true`, or `yes` simulates mutating operations.          |
| `LIGHTDASH_TOOLS_AUDIT_LOG`        | stderr      | Audit log file path.                                          |
| `LIGHTDASH_TOOLS_MCP_PROFILES`     | (all)       | Comma-separated capability profiles.                          |

### MCP HTTP variables (`LIGHTDASH_TOOLS_MCP_*`)

Preferred names use the `LIGHTDASH_TOOLS_MCP_*` prefix per [ADR-0035](adr/0035-environment-variables-prefix-lightdash-tools.md). Legacy `MCP_*` aliases still work with one-time deprecation warnings; the new name wins when both are set.

| New variable                                            | Old alias                          |             Default             | Description                                                                                    |
| :------------------------------------------------------ | :--------------------------------- | :-----------------------------: | :--------------------------------------------------------------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_HTTP_HOST`                         | —                                  |            `0.0.0.0`            | HTTP bind host.                                                                                |
| `LIGHTDASH_TOOLS_MCP_HTTP_PORT`                         | `MCP_HTTP_PORT`, `MCP_SERVER_PORT` |             `3100`              | HTTP port.                                                                                     |
| `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`                        | `MCP_PUBLIC_URL`                   |                —                | Public HTTPS base URL for OAuth metadata. **Required in `lightdash-oauth` mode.**              |
| `LIGHTDASH_TOOLS_MCP_PATH`                              | —                                  |             `/mcp`              | MCP endpoint path.                                                                             |
| `LIGHTDASH_TOOLS_MCP_AUTH_MODE`                         | derived from `MCP_AUTH_ENABLED`    |             `none`              | `none`, `shared-key`, or `lightdash-oauth`.                                                    |
| `LIGHTDASH_TOOLS_MCP_SHARED_KEY`                        | `MCP_API_KEY`                      |                —                | Shared endpoint secret for `shared-key` mode.                                                  |
| `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`                   | `MCP_ALLOWED_ORIGINS`              |             (empty)             | Comma-separated CORS origin allowlist. Empty = reflect any browser `Origin` (startup warning). |
| `LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES`                    | `MCP_MAX_BODY_BYTES`               |            `1048576`            | Maximum JSON body size.                                                                        |
| `LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS`                    | `MCP_SESSION_TTL_MS`               |            `1800000`            | Session TTL for stateful Streamable HTTP.                                                      |
| `LIGHTDASH_TOOLS_MCP_MAX_SESSIONS`                      | `MCP_MAX_SESSIONS`                 |              `100`              | Maximum active sessions.                                                                       |
| `LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS`                | `MCP_SESSION_CLEANUP_MS`           |             `60000`             | Session cleanup interval.                                                                      |
| `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES`                   | —                                  |           `mcp:read`            | Scopes advertised in `WWW-Authenticate`.                                                       |
| `LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED`                  | —                                  | `read,write,mcp:read,mcp:write` | Scopes in protected-resource metadata.                                                         |
| `LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN`                    | —                                  |        `1` in OAuth mode        | Validate bearer via `GET /api/v1/user`. `false` allowed only in `NODE_ENV=development`.        |
| `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION` | —                                  |               off               | Set `1` to allow `VALIDATE_TOKEN=false` outside development (not recommended).                 |
| `LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL`         | —                                  |               off               | Set `1` to allow non-HTTPS `PUBLIC_URL` outside localhost (not recommended).                   |
| `LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS`     | —                                  |             `30000`             | Token validation cache TTL (keyed by SHA-256 token hash).                                      |

### Legacy alias migration

| Current variable         | New variable                               | Migration behavior                                                     |
| :----------------------- | :----------------------------------------- | :--------------------------------------------------------------------- |
| `MCP_HTTP_PORT`          | `LIGHTDASH_TOOLS_MCP_HTTP_PORT`            | Alias; new name wins if both set. Warn on old name.                    |
| `MCP_SERVER_PORT`        | `LIGHTDASH_TOOLS_MCP_HTTP_PORT`            | Alias (demo migration). New name wins. Warn on old name.               |
| `MCP_PUBLIC_URL`         | `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`           | Alias. New name wins. Warn on old name.                                |
| `MCP_AUTH_ENABLED`       | `LIGHTDASH_TOOLS_MCP_AUTH_MODE=shared-key` | When `1`/`true`/`yes` and auth mode unset, implies `shared-key`. Warn. |
| `MCP_API_KEY`            | `LIGHTDASH_TOOLS_MCP_SHARED_KEY`           | Alias. New name wins. Warn.                                            |
| `MCP_ALLOWED_ORIGINS`    | `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`      | Alias. New name wins. Warn.                                            |
| `MCP_MAX_BODY_BYTES`     | `LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES`       | Alias. New name wins. Warn.                                            |
| `MCP_SESSION_TTL_MS`     | `LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS`       | Alias. New name wins. Warn.                                            |
| `MCP_MAX_SESSIONS`       | `LIGHTDASH_TOOLS_MCP_MAX_SESSIONS`         | Alias. New name wins. Warn.                                            |
| `MCP_SESSION_CLEANUP_MS` | `LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS`   | Alias. New name wins. Warn.                                            |

## HTTP endpoints

| Endpoint                                    | Method                  | Auth          | Purpose                                                  |
| :------------------------------------------ | :---------------------- | :------------ | :------------------------------------------------------- |
| `/health/live`                              | `GET`                   | No            | Process liveness.                                        |
| `/health/ready`                             | `GET`                   | No            | Configuration readiness (no PAT required in OAuth mode). |
| `/.well-known/oauth-protected-resource`     | `GET`                   | No            | OAuth protected-resource metadata.                       |
| `/.well-known/oauth-protected-resource/mcp` | `GET`                   | No            | Optional path-specific metadata.                         |
| `/mcp`                                      | `POST`, `GET`, `DELETE` | Per auth mode | Streamable HTTP MCP transport.                           |

## OAuth request flow

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant MCP as @lightdash-tools/mcp
    participant LD as Lightdash

    Client->>MCP: POST /mcp (no Authorization)
    MCP-->>Client: 401 WWW-Authenticate + resource_metadata

    Client->>MCP: GET /.well-known/oauth-protected-resource
    MCP-->>Client: PRM (authorization_servers = LIGHTDASH_URL)

    Note over Client,LD: Client completes OAuth with Lightdash

    Client->>MCP: POST /mcp Authorization Bearer token
    MCP->>LD: GET /api/v1/user (validate token)
    LD-->>MCP: 200 user profile
    MCP->>LD: Tool API calls Authorization Bearer token
    LD-->>MCP: Results (scoped by Lightdash permissions)
    MCP-->>Client: Tool response
```

## Other auth mode examples

### STDIO (local)

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_API_KEY="ldpat_..."
export LIGHTDASH_TOOLS_SAFETY_MODE="read-only"

npx @lightdash-tools/mcp
```

### Shared-key HTTP (backward compatible)

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_API_KEY="ldpat_..."
export LIGHTDASH_TOOLS_MCP_AUTH_MODE="shared-key"
export LIGHTDASH_TOOLS_MCP_SHARED_KEY="server-endpoint-secret"

npx @lightdash-tools/mcp serve-http
```

Client sends `Authorization: Bearer server-endpoint-secret` (or `X-API-Key`). Upstream Lightdash calls use `Authorization: ApiKey ldpat_…`.

## Session binding

Stateful Streamable HTTP sessions bind to the authenticated OAuth subject (`userUuid`) at creation. If a client resumes a session (`Mcp-Session-Id` header) with a bearer token for a different user, the server returns:

```http
HTTP/1.1 401 Unauthorized
{"error":"invalid_token","error_description":"Session subject mismatch"}
```

Re-authenticate or start a new session.

When the same user refreshes their access token, the session accepts the new bearer token, updates the upstream client credentials, and continues the existing MCP session.

## OAuth scope enforcement

The MCP server enforces coarse OAuth scopes at two layers:

| Layer         | Behavior                                                                                                                                                       |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint auth | Incoming bearer tokens must include every scope in `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES` (default `mcp:read`). Missing scopes return `403 insufficient_scope`. |
| Tool calls    | Read-only tools require `mcp:read`; write tools require `mcp:write`.                                                                                           |

Scopes are read from JWT `scope` / `scp` claims when the access token is a JWT. Opaque tokens that pass Lightdash validation are treated as granting all `scopes_supported` values for v1.

## Diagnostic tool

Use `ldt__get_authenticated_user` to verify per-user identity after OAuth setup. The response excludes tokens and sensitive headers.

## Related guides

- [Cursor remote MCP setup](cursor-lightdash-oauth-mcp.md)
- [Cloud Run deployment](cloud-run-mcp-oauth.md)
- [Threat model](security/mcp-oauth-threat-model.md)
- [Secrets and credentials](secrets-and-credentials.md)
- [Package README](../packages/mcp/README.md)

## Troubleshooting

### 401 loop or OAuth never completes

- Confirm `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` matches the URL clients use (HTTPS, no trailing slash, no `/mcp` suffix — the server normalizes this).
- Fetch metadata manually and verify `authorization_servers` contains your `LIGHTDASH_URL`.
- Ensure the Lightdash OAuth application allows the MCP client's redirect URI (for Cursor: `cursor://anysphere.cursor-mcp/oauth/callback`).
- Check that `POST /mcp` without a token returns `401` with `WWW-Authenticate` including `resource_metadata` (not `404`).

### `LIGHTDASH_TOOLS_MCP_PUBLIC_URL is required`

Set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` to the public base URL of your MCP server when `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`.

### Session subject mismatch

The client switched OAuth users while reusing an old `Mcp-Session-Id`. Clear the MCP session in the client or restart the connection.

### Token refresh within a session

Refreshing an access token for the same Lightdash user is supported. Keep the existing `Mcp-Session-Id` and send the new bearer token on subsequent requests.

### Invalid or expired token

Lightdash rejected the bearer token. The server returns `401` with `WWW-Authenticate: Bearer error="invalid_token", …`. Re-authenticate through the MCP client's OAuth flow.

### Write tools blocked by safety mode, OAuth scopes, or Lightdash permissions

Write authorization is enforced by:

- `LIGHTDASH_TOOLS_SAFETY_MODE` (process-scoped guardrails on the MCP server)
- OAuth MCP scopes (`mcp:read` for read tools, `mcp:write` for write tools)
- Lightdash API permissions for the authenticated user's bearer token

If a write tool fails, check safety mode, OAuth scopes, and Lightdash RBAC.

### Shared-key mode still requires PAT

`shared-key` and `none` modes use a process-global `LIGHTDASH_API_KEY` for upstream Lightdash calls. Only `lightdash-oauth` removes the PAT requirement.

### Deprecated env warnings

One-time warnings like `MCP_PUBLIC_URL is deprecated. Use LIGHTDASH_TOOLS_MCP_PUBLIC_URL.` are expected during migration. Update to the new names before a future major release.

### Horizontal scaling

Sessions are stored in memory per process. Multi-instance deployments need sticky sessions or an external session store (deferred; see RFC). Document single-instance requirement for v1.
