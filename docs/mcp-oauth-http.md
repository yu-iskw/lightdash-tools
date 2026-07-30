# OAuth-backed Streamable HTTP MCP

Operator guide for hosted `@lightdash-tools/mcp` deployments that authenticate each MCP user with Lightdash OAuth. For architecture and design rationale, see [RFC 0040](rfc/0040-oauth-backed-streamable-http-mcp.md) and [ADR 0040](adr/0040-oauth-backed-streamable-http-mcp.md).

## Production readiness (read first)

`LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth` is **experimental identity-only OAuth** in v1. It is **not** production-grade, standards-aligned MCP OAuth authorization yet.

| Capability                                                                       | v1 `lightdash-oauth` status                                                                                                                                                                                    |
| :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-user bearer propagation to Lightdash                                         | Supported                                                                                                                                                                                                      |
| Protected-resource metadata on the MCP server                                    | Supported (scaffolding)                                                                                                                                                                                        |
| OAuth discovery via Lightdash Authorization Server Metadata                      | **Supported upstream** — Lightdash exposes `/.well-known/oauth-authorization-server`                                                                                                                           |
| Resource / audience binding on access tokens                                     | **Not supported** — validation is `GET /api/v1/user` identity only; tokens are not bound to this MCP resource. See [lightdash-oauth-upstream-contract.md](agent-context/lightdash-oauth-upstream-contract.md). |
| MCP-local `mcp:read` / `mcp:write` scope enforcement for opaque Lightdash tokens | **Unavailable** — OAuth mode authorizes entirely through Lightdash RBAC + `LIGHTDASH_TOOLS_SAFETY_MODE` (default `read-only`); do not rely on MCP-local scopes                                                 |

**Production recommendation today:** use `shared-key` HTTP mode with a PAT and strong process guardrails, unless you explicitly accept the experimental identity-only model.

To run `lightdash-oauth` in `NODE_ENV=production`, set `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1` after reading this document. Development (`NODE_ENV=development`) does not require the flag.

In production, `LIGHTDASH_TOOLS_SAFETY_MODE` must be `read-only` unless you also set `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_WRITE_IN_IDENTITY_OAUTH=1` to accept write tools without resource/audience-bound token validation.

### What identity-only OAuth means

A valid Lightdash OAuth access token for your instance proves **who** the user is. It does **not** prove the token was issued for **this MCP server** as the intended resource (no resource/audience binding). Any valid Lightdash OAuth token for the same instance could be replayed to the MCP endpoint (confused-deputy risk). Mitigate with tightly controlled OAuth client registration, `LIGHTDASH_TOOLS_SAFETY_MODE`, `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`, network ingress restrictions, and explicit CORS allowlists in production.

### MCP client configuration

Lightdash publishes OAuth Authorization Server Metadata at `{LIGHTDASH_URL}/.well-known/oauth-authorization-server`. MCP clients that follow protected-resource metadata → authorization-server metadata discovery should work with current Lightdash.

**Prefer OAuth discovery** when your MCP client supports it. Protected-resource metadata on this server points `authorization_servers` at your `LIGHTDASH_URL`.

**Static endpoint fallback:** if discovery fails or your client requires explicit endpoints, configure Lightdash OAuth URLs directly (see [cursor-lightdash-oauth-mcp.md](cursor-lightdash-oauth-mcp.md)):

| Endpoint               | Lightdash path                           |
| :--------------------- | :--------------------------------------- |
| Authorization          | `{LIGHTDASH_URL}/api/v1/oauth/authorize` |
| Token                  | `{LIGHTDASH_URL}/api/v1/oauth/token`     |
| Registration (if used) | `{LIGHTDASH_URL}/api/v1/oauth/register`  |
| Revocation             | `{LIGHTDASH_URL}/api/v1/oauth/revoke`    |
| Userinfo               | `{LIGHTDASH_URL}/api/v1/oauth/userinfo`  |

### Roadmap to production-grade MCP OAuth

Upstream Lightdash work is still required before this mode can be represented as fully standards-aligned:

1. Resource / audience binding at token issuance for external MCP resources
2. Token introspection or validation exposing `client_id`, `scope`, and `resource` to the MCP server

OAuth Authorization Server Metadata discovery is available on current Lightdash; the remaining blocker is resource-bound token validation, not metadata.

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

| Mode              | Transport | MCP endpoint auth                            | Lightdash upstream auth                | `LIGHTDASH_API_KEY` required |
| :---------------- | :-------- | :------------------------------------------- | :------------------------------------- | :--------------------------- |
| `env`             | STDIO     | N/A (host owns process)                      | `Authorization: ApiKey ldpat_…`        | Yes                          |
| `none`            | HTTP      | None (startup warning)                       | `Authorization: ApiKey ldpat_…`        | Yes                          |
| `shared-key`      | HTTP      | Shared `LIGHTDASH_TOOLS_MCP_SHARED_KEY`      | `Authorization: ApiKey ldpat_…`        | Yes                          |
| `lightdash-oauth` | HTTP      | User's Lightdash OAuth bearer (experimental) | `Authorization: Bearer …` (same token) | **No**                       |

**Production recommendation:** `LIGHTDASH_TOOLS_MCP_AUTH_MODE=shared-key` with a PAT and strong guardrails. Use `lightdash-oauth` only for experimental per-user bearer deployments where identity-only validation is acceptable (`LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1` in production).

`none` logs a startup warning in non-production environments. In `NODE_ENV=production`, `none` fails closed unless `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED=1`:

```text
Warning: LIGHTDASH_TOOLS_MCP_AUTH_MODE=none — MCP HTTP endpoint is unauthenticated. Use lightdash-oauth or shared-key in production.
```

## Quick start (experimental lightdash-oauth)

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_MCP_AUTH_MODE="lightdash-oauth"
export LIGHTDASH_TOOLS_MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH="1"  # required in NODE_ENV=production
export LIGHTDASH_TOOLS_SAFETY_MODE="read-only"
export LIGHTDASH_TOOLS_ALLOWED_PROJECTS="project_uuid_1,project_uuid_2"
export LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS="5000"

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
  "scopes_supported": []
}
```

`scopes_supported` defaults to empty because the MCP server cannot verify scopes on opaque Lightdash OAuth tokens. `authorization_servers` references Lightdash for MCP spec scaffolding; clients still need preconfigured Lightdash OAuth endpoints (see above).

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

| New variable                                                    | Old alias                          |                Default                | Description                                                                                                                                                                                                                    |
| :-------------------------------------------------------------- | :--------------------------------- | :-----------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_HTTP_HOST`                                 | —                                  |               `0.0.0.0`               | HTTP bind host.                                                                                                                                                                                                                |
| `LIGHTDASH_TOOLS_MCP_HTTP_PORT`                                 | `MCP_HTTP_PORT`, `MCP_SERVER_PORT` |                `3100`                 | HTTP port.                                                                                                                                                                                                                     |
| `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`                                | `MCP_PUBLIC_URL`                   |                   —                   | Public HTTPS base URL for OAuth metadata. **Required in `lightdash-oauth` mode.**                                                                                                                                              |
| `LIGHTDASH_TOOLS_MCP_AUTH_MODE`                                 | derived from `MCP_AUTH_ENABLED`    |                `none`                 | `none`, `shared-key`, or `lightdash-oauth`.                                                                                                                                                                                    |
| `LIGHTDASH_TOOLS_MCP_SHARED_KEY`                                | `MCP_API_KEY`                      |                   —                   | Shared endpoint secret for `shared-key` mode.                                                                                                                                                                                  |
| `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`                           | `MCP_ALLOWED_ORIGINS`              |                (empty)                | Comma-separated CORS origin allowlist. Empty = no CORS reflection unless `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN=1` (startup warning). Production `lightdash-oauth` requires an allowlist or the dangerous override. |
| `LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES`                            | `MCP_MAX_BODY_BYTES`               |               `1048576`               | Maximum JSON body size.                                                                                                                                                                                                        |
| `LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS`                            | `MCP_SESSION_TTL_MS`               |               `1800000`               | Session TTL for stateful Streamable HTTP.                                                                                                                                                                                      |
| `LIGHTDASH_TOOLS_MCP_MAX_SESSIONS`                              | `MCP_MAX_SESSIONS`                 |                 `100`                 | Maximum active sessions.                                                                                                                                                                                                       |
| `LIGHTDASH_TOOLS_MCP_MAX_SESSIONS_PER_SUBJECT`                  | —                                  |                 `10`                  | Per OAuth subject session cap. `0` = unlimited per subject (global `MAX_SESSIONS` still applies).                                                                                                                              |
| `LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS`                        | `MCP_SESSION_CLEANUP_MS`           |                `60000`                | Session cleanup interval.                                                                                                                                                                                                      |
| `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES`                           | —                                  |                (empty)                | Optional endpoint scope requirements for **non-oauth** modes. **Rejected in `lightdash-oauth`.**                                                                                                                               |
| `LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED`                          | —                                  | (legacy list; empty default in OAuth) | Protected-resource metadata scopes for **non-oauth** modes. **Rejected if set in `lightdash-oauth`.**                                                                                                                          |
| `LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN`                            | —                                  |           `1` in OAuth mode           | Validate bearer via `GET /api/v1/user`. `false` allowed only in `NODE_ENV=development`.                                                                                                                                        |
| `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION`         | —                                  |                  off                  | Set `1` to allow `VALIDATE_TOKEN=false` outside development (not recommended).                                                                                                                                                 |
| `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED`         | —                                  |                  off                  | Set `1` to allow `AUTH_MODE=none` when `NODE_ENV=production` (not recommended).                                                                                                                                                |
| `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES`              | —                                  |                  off                  | Dev-only for **non-oauth** modes: grant all supported scopes to opaque/claimless tokens (blocked in production). **Rejected in `lightdash-oauth`.**                                                                            |
| `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH`               | —                                  |                  off                  | Required (`1`) for `lightdash-oauth` in `NODE_ENV=production`. Acknowledges identity-only validation limitations.                                                                                                              |
| `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_WRITE_IN_IDENTITY_OAUTH` | —                                  |                  off                  | Required (`1`) to run production `lightdash-oauth` with `LIGHTDASH_TOOLS_SAFETY_MODE` broader than `read-only`.                                                                                                                |
| `LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL`                 | —                                  |                  off                  | Set `1` to allow non-HTTPS `PUBLIC_URL` outside localhost (not recommended).                                                                                                                                                   |
| `LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS`             | —                                  |                `10000`                | Token validation cache TTL (keyed by SHA-256 token hash). Revoked tokens may remain accepted until expiry. Use `5000` or lower in production.                                                                                  |

### Legacy alias migration

Legacy `MCP_*` aliases still work with one-time deprecation warnings; the new name wins when both are set. **Migrate to `LIGHTDASH_TOOLS_MCP_*` — aliases will be removed in a future minor.**

The MCP endpoint path is persona-owned (`/semantic-layer/v1/mcp`). Setting `LIGHTDASH_TOOLS_MCP_PATH` is **rejected** at startup.

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

| Endpoint                                                      | Method                  | Auth          | Purpose                                                  |
| :------------------------------------------------------------ | :---------------------- | :------------ | :------------------------------------------------------- |
| `/health/live`                                                | `GET`                   | No            | Process liveness.                                        |
| `/health/ready`                                               | `GET`                   | No            | Configuration readiness (no PAT required in OAuth mode). |
| `/.well-known/oauth-protected-resource`                       | `GET`                   | No            | OAuth protected-resource metadata.                       |
| `/.well-known/oauth-protected-resource/semantic-layer/v1/mcp` | `GET`                   | No            | Path-specific metadata.                                  |
| `/semantic-layer/v1/mcp`                                      | `POST`, `GET`, `DELETE` | Per auth mode | Streamable HTTP MCP transport (persona-owned path).      |

## OAuth request flow

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant MCP as @lightdash-tools/mcp
    participant LD as Lightdash

    Client->>MCP: POST /semantic-layer/v1/mcp (no Authorization)
    MCP-->>Client: 401 WWW-Authenticate + resource_metadata

    Client->>MCP: GET /.well-known/oauth-protected-resource
    MCP-->>Client: PRM (authorization_servers = LIGHTDASH_URL)

    Note over Client,LD: Client discovers authorization_servers from PRM; OAuth flow uses Lightdash AS

    Client->>MCP: POST /semantic-layer/v1/mcp Authorization Bearer token
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

Stateful Streamable HTTP sessions bind to the authenticated OAuth subject (`userUuid`) and `organizationUuid` (when returned by `GET /api/v1/user`) at creation. If a client resumes a session (`Mcp-Session-Id` header) with a bearer token for a different user, the server returns:

```http
HTTP/1.1 401 Unauthorized
{"error":"invalid_token","error_description":"Session subject mismatch"}
```

If the bearer token validates as the same user but a different organization context, the server returns:

```http
HTTP/1.1 401 Unauthorized
{"error":"invalid_token","error_description":"Session organization mismatch"}
```

Re-authenticate or start a new session.

When the same user refreshes their access token within the same organization context, the session accepts the new bearer token, updates the upstream client credentials, and continues the existing MCP session.

OAuth `clientId` is not available from `GET /api/v1/user` and is not part of v1 session binding.

## OAuth scope enforcement

Lightdash OAuth on the MCP HTTP endpoint validates **identity** (bearer token accepted by `GET /api/v1/user`). Authorization for what a user can do comes primarily from **Lightdash RBAC** and process-level **safety mode** / project allowlists.

Lightdash-issued OAuth access credentials are **opaque strings**, not JWTs. MCP cannot use local JWT parsing as an authoritative scope source for those credentials.

| Layer         | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint auth | `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES` must remain **empty** in `lightdash-oauth` mode. The server rejects startup when required scopes are configured without a scope-validation backend.                                                                                                                                                                                                                                                |
| Tool calls    | When decodable JWT `scope` / `scp` claims are present on the access token, read-only tools require `mcp:read` and write tools require `mcp:write`. Claims are decoded locally **without signature verification** — do not treat them as authoritative for Lightdash OAuth unless Lightdash formally issues resource-bound JWT access tokens. For normal opaque Lightdash OAuth credentials, MCP-local tool scope checks are **skipped**. |
| Metadata      | Protected-resource metadata advertises an empty `scopes_supported` list by default in `lightdash-oauth` mode so clients are not prompted for scopes the server cannot verify.                                                                                                                                                                                                                                                            |

Setting `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES`, `LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED`, or `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES` in `lightdash-oauth` mode **fails startup**. Leave them unset; metadata uses an empty `scopes_supported` list.

### Token validation cache

Validated bearer tokens are cached by SHA-256 hash for `LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS` (default 10s). Revoked or expired tokens may continue to work against the MCP endpoint until the cache entry expires. Use `5000` ms or lower in production when tighter revocation visibility matters.

### Production configuration examples

Identity-only (typical Lightdash opaque OAuth tokens; production defaults to read-only tools):

```bash
LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth
LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://mcp.example.com
LIGHTDASH_URL=https://app.lightdash.cloud
LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1
# LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES unset (default empty)
LIGHTDASH_TOOLS_SAFETY_MODE=read-only
```

Strict JWT scope enforcement at the endpoint is **not supported** in `lightdash-oauth` mode because Lightdash OAuth credentials are opaque. Use safety mode and Lightdash RBAC instead:

```bash
LIGHTDASH_TOOLS_SAFETY_MODE=read-only
```

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

- **Most common:** Token validation is identity-only — any valid Lightdash OAuth token for the instance may work, not only tokens issued for this MCP resource. Review experimental limitations in this guide.
- If OAuth discovery fails, configure static Lightdash OAuth endpoints in the MCP client as a fallback. See [cursor-lightdash-oauth-mcp.md](cursor-lightdash-oauth-mcp.md).
- Confirm `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` matches the URL clients use (HTTPS, no trailing slash). The server strips a trailing `/semantic-layer/v1/mcp` suffix from `PUBLIC_URL` when present, so `https://host/semantic-layer/v1/mcp` normalizes to base `https://host`.
- Fetch metadata manually: `GET /.well-known/oauth-protected-resource` should list your `LIGHTDASH_URL` in `authorization_servers`; follow to `{LIGHTDASH_URL}/.well-known/oauth-authorization-server` for AS metadata.
- Ensure the Lightdash OAuth application allows the MCP client's redirect URI (for Cursor: `cursor://anysphere.cursor-mcp/oauth/callback`).
- Check that `POST /semantic-layer/v1/mcp` without a token returns `401` with `WWW-Authenticate` including `resource_metadata` (not `404`).

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

One-time warnings like `MCP_PUBLIC_URL is deprecated. Use LIGHTDASH_TOOLS_MCP_PUBLIC_URL.` are expected during migration. Update to the new names before a future minor removes the aliases.

### Horizontal scaling

Sessions are stored in memory per process. Multi-instance deployments need sticky sessions or an external session store (deferred; see RFC). Document single-instance requirement for v1.
