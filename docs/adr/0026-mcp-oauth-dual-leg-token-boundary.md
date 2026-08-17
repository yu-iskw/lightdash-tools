# 26. MCP OAuth uses a dual-leg, resource-bound token boundary

Date: 2026-08-17

## Status

Accepted

Amends [7. MCP HTTP transport, OAuth broker, SDK v2](0007-mcp-http-transport-auth-modes-sdk-v2.md)

## Context

The hosted HTTP MCP server is both:

1. an OAuth protected resource for MCP clients such as Cursor, Claude Code, and Codex; and
2. an OAuth client of the downstream Lightdash API.

These are separate OAuth trust boundaries with different clients and protected resources.

The original broker exchanged the Lightdash authorization code using the server-held confidential Lightdash client, then returned the resulting Lightdash access token unchanged from the MCP `/oauth/token` endpoint. The MCP resource server accepted that same token, validated it via Lightdash `GET /api/v1/user`, and forwarded it to Lightdash for tool calls.

That design preserved the user's Lightdash RBAC, but it made the downstream Lightdash credential also serve as the MCP access token. It therefore could not enforce that the bearer was issued specifically for the MCP server or for a particular profile endpoint. It also meant an MCP client that received the token could potentially use the same bearer directly against Lightdash.

Current MCP authorization requires clients to identify the target MCP resource with RFC 8707 `resource` in both authorization and token requests, and requires MCP resource servers to accept only tokens intended for their own resources. MCP security guidance explicitly treats accepting an upstream-issued token and passing it through to the downstream API as token passthrough.

## Decision

Hosted Lightdash OAuth uses two explicit authorization legs:

```text
MCP client
    |
    | MCP OAuth: broker-issued access token
    | audience = exact enabled MCP profile resource
    v
lightdash-tools MCP server
    |
    | server-held delegated Lightdash access token
    v
Lightdash API
```

### MCP client -> broker leg

- The MCP authorization request MUST contain exactly one `resource` identifying an enabled profile endpoint on the configured MCP public URL.
- The broker binds that resource to its pending authorization state and one-time authorization code.
- The MCP token request MUST contain the same `resource`; a mismatch fails with `invalid_grant`.
- The broker MUST NOT return the downstream Lightdash access token to the MCP client in plaintext or reusable bearer form.
- `/oauth/token` mints a short-lived `ldmcp1.*` bearer token issued by lightdash-tools.
- The token is authenticated-encrypted with AES-256-GCM. A purpose-specific encryption key is derived from the server-held Lightdash OAuth client secret; every replica already needs that secret.
- The encrypted payload binds the MCP client ID, exact MCP resource URI, MCP scope, issuance/expiry timestamps, and the downstream Lightdash credential. Only the MCP server can recover that credential from the broker token.
- The MCP resource server decrypts and authenticates the token and requires an exact resource match before any Lightdash network request.
- Raw Lightdash bearer tokens, malformed tokens, expired tokens, tampered tokens, and tokens issued for another profile are rejected locally with HTTP 401.

### Broker -> Lightdash leg

- The server-held Lightdash OAuth client ID/secret are used for the downstream authorization-code exchange.
- The resulting Lightdash access token is never returned to the MCP client in plaintext or directly reusable form; it is recoverable only server-side from the authenticated-encrypted broker token.
- Client PKCE, MCP `resource`, and MCP scopes are not forwarded to Lightdash. They belong to a different OAuth leg and have different semantics.
- Lightdash user identity and RBAC continue to be validated/enforced with the delegated downstream credential.
- A Lightdash `refresh_token`, if returned, is not persisted or exposed; expiration requires a new interactive authorization flow.

### Statelessness

The authorization/DCR/code handshake continues to use the bounded in-memory broker store, so `/oauth/*` requires sticky routing or a single replica while that handshake is in flight.

After `/oauth/token` succeeds, MCP access tokens are self-contained and authenticated-encrypted. Normal profile MCP requests therefore remain stateless and can be served by any replica sharing the same configured OAuth client secret.

## Consequences

### Positive

- An MCP client never receives a reusable Lightdash bearer credential.
- Lightdash tokens cannot be presented directly as MCP access tokens.
- MCP tokens have an explicit, cryptographically protected audience at profile-path granularity.
- Cross-profile token replay is rejected before contacting Lightdash.
- MCP scope and downstream Lightdash scope cannot be confused.
- The fix preserves stateless profile request handling and does not reintroduce Redis.
- Key distribution does not require another deployment secret because replicas already share the Lightdash confidential-client secret; key derivation is domain-separated from its OAuth use. That coupling is **accepted for v1**.

### Negative / residual risks

- Self-contained bearer tokens do not provide per-token server-side revocation. They stop working on expiry, downstream credential revocation, or OAuth client-secret rotation. A future shared opaque-token store could add fine-grained MCP revocation if required.
- Compromise of the MCP server process or its OAuth client secret can expose/decrypt delegated Lightdash credentials (and all outstanding MCP tokens). This is inherent in the server-side delegation role and reinforces the need for secret-manager-backed configuration, least privilege, audit logging, and short token lifetimes. A dedicated MCP token encryption secret (separate from the Lightdash OAuth client secret) would reduce blast radius and should be introduced by a future superseding ADR if operators need independent rotation.
- MCP scopes sealed into the broker token are still taken from the client authorize request and checked against configured `requiredScopes`; they are not yet a broker-owned grant/consent boundary. Scope minimization and step-up remain future work.
- The in-memory DCR/authorization-code handshake is still process-local. This ADR deliberately does not introduce a distributed authorization state store.
- This decision closes token passthrough and MCP audience binding. It does **not** implement MCP proxy per-client consent before the static Lightdash OAuth redirect (confused-deputy class). That control is evaluated independently.

## References

- [MCP Authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP Security Best Practices — Token Passthrough / Confused Deputy](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [7. MCP HTTP transport, OAuth broker, SDK v2](0007-mcp-http-transport-auth-modes-sdk-v2.md)
- [19. MCP stateless protocol core without Redis ephemeral store](0019-mcp-stateless-protocol-core-without-redis-ephemeral-store.md)
