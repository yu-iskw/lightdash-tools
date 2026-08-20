# 27. Extra invoke origins advertise host-aware OAuth metadata

Date: 2026-08-20

## Status

Accepted

Amends [7. MCP HTTP transport, OAuth broker, SDK v2](0007-mcp-http-transport-auth-modes-sdk-v2.md)

Amends [26. MCP OAuth uses a dual-leg, resource-bound token boundary](0026-mcp-oauth-dual-leg-token-boundary.md)

## Context

Hosted MCP OAuth binds RFC 8707 `resource`, PRM, and broker AS metadata to `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` ([ADR-0007](0007-mcp-http-transport-auth-modes-sdk-v2.md), [ADR-0026](0026-mcp-oauth-dual-leg-token-boundary.md)). That is correct for public HTTPS clients (Cursor, Claude Code, `@modelcontextprotocol/client` v2).

Private-network clients often reach the same process through an extra hostname (internal HTTP load balancer, private DNS, Kubernetes Service). If PRM still advertises the public issuer, those clients fetch public `/.well-known/oauth-authorization-server` and fail at a public WAF. Pointing `PUBLIC_URL` at the extra origin breaks the Lightdash/Google redirect (HTTPS + public DNS) and the broker issuer. Setting the client Resource URL to the public origin while invoking the extra origin causes resource mismatch.

The extra origin is often cleartext HTTP on a different hostname than `PUBLIC_URL`. Same-hostname private TLS (split-horizon) is preferable when infrastructure can do it; this ADR covers the common case where it cannot.

## Decision

Optional `LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS` lists extra absolute `http(s)` origins (no path). Matching uses the full origin (scheme + host + port; default ports stripped), reconstructed from `Host` and request scheme (`X-Forwarded-Proto`, else TLS, else http). Hostname-only matching is rejected.

When `Host` matches a listed origin:

1. PRM `resource` and `authorization_servers` use that origin.
2. AS `token_endpoint` and `registration_endpoint` use that origin (`/oauth/token`, `/oauth/register`).
3. AS `issuer` and `authorization_endpoint` stay on `PUBLIC_URL`.
4. `/oauth/callback` stays `{PUBLIC_URL}/oauth/callback`.
5. Bearer `WWW-Authenticate` `resource_metadata` uses the invoke origin.
6. Broker tokens are bound to `{invokeOrigin}{profilePath}`; RS verify uses the **request Host** profile resource.

Authorize and token still require RFC 8707 `resource` to identify an enabled profile on `PUBLIC_URL` **or** a listed invoke origin. That allows a browser authorize on public HTTPS with `resource` equal to the extra-origin profile URL.

`PUBLIC_URL` remains HTTPS (or loopback HTTP). Extra origins may be non-loopback HTTP. Do not reintroduce `ALLOW_INSECURE_PUBLIC_URL`. Do not set issuer globally to an extra origin.

This is an intentional RFC 8414 issuer/well-known split. `@modelcontextprotocol/client` v2 will reject HTTP invoke origins (`IssuerMismatchError`, `InsecureTokenEndpointError`). Public HTTPS remains the client for that SDK. Private-network clients that POST token/DCR to the extra origin (and leave Resource URL empty so `resource` is the server URL) are the intended consumers.

Host-header spoofing: rewrite only for an **explicit** extra origin. Operators must not route extra-origin Hostnames on the public VIP.

## Consequences

### Positive

- VPC clients can complete per-user OAuth without fetching public well-known through a WAF.
- Google/Lightdash redirect and JWT-equivalent issuer stay on public HTTPS.
- Dual-leg resource binding ([ADR-0026](0026-mcp-oauth-dual-leg-token-boundary.md)) still applies; extra origins are additional allowed audiences, not a passthrough.
- Multiple extra origins work; the feature is not cloud- or client-specific.

### Negative / residual risks

- RFC 8414 issuer echo is split on extra origins. Documented; MCP TypeScript client v2 is unsupported on those URLs.
- Cleartext token/DCR on extra HTTP origins is accepted for private networks. Restrict ingress; do not expose those Hosts publicly.
- A public client that can set `Host` to a listed extra origin could receive HTTP token URLs. Mitigate at the load balancer (do not serve extra Hosts on the public VIP).
- A token minted for an extra-origin resource will not verify on the public Host (and vice versa). Clients must use one resource consistently.

## References

- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [MCP Authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- Operator notes: `docs/operators/mcp-oauth.md`, `docs/operators/mcp-oauth-threat-model.md`
