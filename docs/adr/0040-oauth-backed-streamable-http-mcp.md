# 40. OAuth-backed Streamable HTTP mode for `@lightdash-tools/mcp`

Date: 2026-06-15

## Status

Accepted (v1 experimental subset)

## Context

`@lightdash-tools/mcp` supports STDIO (env PAT) and Streamable HTTP with optional shared-secret endpoint auth (ADR-0017). ADR-0013 deferred multi-tenant, per-user credentials. Hosted remote MCP deployments need each user to authenticate with Lightdash OAuth and call tools with that user's permissions.

The MCP Authorization specification (2025-11-25) requires HTTP transports to act as OAuth resource servers with protected-resource metadata and `WWW-Authenticate` challenges, plus authorization-server metadata discovery and resource/audience validation on access tokens.

Upstream Lightdash today exposes OAuth routes (`/api/v1/oauth/authorize`, `/token`, `/register`, `/revoke`, `/userinfo`) but **does not** publish `/.well-known/oauth-authorization-server` or OIDC discovery. Access tokens are opaque and are not issued with resource/audience binding that the MCP server can validate.

## Decision

1. **Auth modes** for HTTP: `none` (dev, warns loudly), `shared-key` (production-ready today), `lightdash-oauth` (**experimental identity-only OAuth**). STDIO remains env PAT (`env` mode semantically).

2. **Experimental identity OAuth**: The MCP endpoint bearer token is the same token sent upstream to Lightdash as `Authorization: Bearer`. Validation calls `GET /api/v1/user` to confirm identity only. This does **not** prove the token was issued for this MCP resource. Production use requires `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1`.

3. **Request context**: Replace process-global `LightdashClient` with `McpContextProvider`. OAuth sessions create a `BearerContextProvider` bound to the validated token at session initialization.

4. **Client auth union**: `@lightdash-tools/client` supports `api-key` and `bearer` auth schemes. PAT config remains backward compatible.

5. **Token validation**: Validate OAuth tokens via `GET /api/v1/user` with short TTL cache (default 10s) keyed by SHA-256 token hash. No JWKS, introspection, or audience binding in v1.

6. **Session binding**: Stateful HTTP sessions bind to `userUuid` (subject) and `organizationUuid` when present. Resuming with a different user or organization context returns `401`. Same-user token refresh within the same organization context updates upstream credentials. OAuth `clientId` is not available from `GET /api/v1/user` and is deferred.

7. **OAuth scopes**: Opaque Lightdash tokens skip MCP-local scope enforcement. `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES` must remain empty in `lightdash-oauth` mode (startup fails otherwise). Protected-resource metadata advertises empty `scopes_supported` by default. Authorization is Lightdash RBAC plus process-level safety mode.

8. **MCP client configuration**: Protected-resource metadata alone is insufficient for generic MCP OAuth discovery. Clients must preconfigure Lightdash OAuth endpoints until upstream AS metadata exists.

9. **Environment variables**: Official Lightdash vars unchanged. MCP HTTP server vars use `LIGHTDASH_TOOLS_MCP_*` per ADR-0035.

10. **Governance**: Safety mode, project allowlist, dry-run, and audit remain process-scoped (operator configured), not per OAuth user.

## Consequences

- **Positive**: Per-user bearer propagation; HTTP transport refactor; session binding; honest experimental path for early adopters; `shared-key` remains the production-ready option today.
- **Negative**: Not standards-aligned MCP OAuth authorization until upstream Lightdash adds AS metadata and resource/audience binding.
- **Risks**: Confused-deputy replay of valid Lightdash OAuth tokens across clients; delayed revocation visibility from validation cache; horizontal scale needs external session store (deferred).

## Future work (upstream + MCP)

1. Lightdash OAuth Authorization Server Metadata endpoint
2. Resource/audience-bound token issuance
3. Introspection or validation exposing `client_id`, `scope`, and `resource`
4. Production-grade `lightdash-oauth` mode without `EXPERIMENTAL_IDENTITY_OAUTH`

## References

- RFC: `docs/rfc/0040-oauth-backed-streamable-http-mcp.md`
- Operator guide: `docs/mcp-oauth-http.md`
- ADR-0013, ADR-0017, ADR-0035, ADR-0037
- [MCP Authorization 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
