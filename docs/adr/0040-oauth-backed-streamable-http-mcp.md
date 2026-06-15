# 40. OAuth-backed Streamable HTTP mode for `@lightdash-tools/mcp`

Date: 2026-06-15

## Status

Accepted

## Context

`@lightdash-tools/mcp` supports STDIO (env PAT) and Streamable HTTP with optional shared-secret endpoint auth (ADR-0017). ADR-0013 deferred multi-tenant, per-user credentials. Hosted remote MCP deployments need each user to authenticate with Lightdash OAuth and call tools with that user's permissions.

The MCP Authorization specification (2025-11-25) requires HTTP transports to act as OAuth resource servers with protected-resource metadata and `WWW-Authenticate` challenges.

## Decision

1. **Auth modes** for HTTP: `none` (dev, warns loudly), `shared-key` (backward compatible), `lightdash-oauth` (production). STDIO remains env PAT (`env` mode semantically).

2. **Full identity OAuth**: The MCP endpoint bearer token is the same token sent upstream to Lightdash as `Authorization: Bearer`. Lightdash is the authorization server and permission source. No MCP-side OAuth server or refresh-token storage.

3. **Request context**: Replace process-global `LightdashClient` with `McpContextProvider`. OAuth sessions create a `BearerContextProvider` bound to the validated token at session initialization.

4. **Client auth union**: `@lightdash-tools/client` supports `api-key` and `bearer` auth schemes. PAT config remains backward compatible.

5. **Token validation**: Validate OAuth tokens via `GET /api/v1/user` with optional short TTL cache keyed by SHA-256 token hash. No JWKS in v1.

6. **Session binding**: Stateful HTTP sessions store `tokenHash`; resume with a different token returns 401.

7. **Environment variables**: Official Lightdash vars (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`) unchanged. MCP HTTP server vars use `LIGHTDASH_TOOLS_MCP_*` per ADR-0035. Legacy `MCP_*` names remain as aliases with one-time deprecation warnings.

8. **Governance**: Safety mode, project allowlist, dry-run, and audit remain process-scoped (operator configured), not per OAuth user.

9. **Guardrails**: Existing `registerToolSafe` layer order unchanged.

## Consequences

- **Positive**: User-scoped hosted MCP; MCP spec-compliant discovery; STDIO and shared-key HTTP preserved.
- **Negative**: Large refactor of tool registration signatures; in-memory sessions still lost on restart.
- **Risks**: Lightdash OAuth scope semantics may require follow-up; horizontal scale needs external session store (deferred).

## References

- RFC: `docs/rfc/0040-oauth-backed-streamable-http-mcp.md`
- ADR-0013, ADR-0017, ADR-0035, ADR-0037
- [MCP Authorization 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
