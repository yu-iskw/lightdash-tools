# Lightdash OAuth upstream contract (MCP validation)

MCP `lightdash-oauth` mode validates bearer tokens by calling **`GET /api/v1/user`** on the configured `LIGHTDASH_URL` with `Authorization: Bearer <access_token>`. Session binding then uses `userUuid` and `organizationUuid` from the response.

This document records why that endpoint is correct for upstream Lightdash OAuth tokens.

## Upstream evidence

### `GET /api/v1/user` accepts OAuth bearer tokens

Upstream `UserController.getAuthenticatedUser` is mounted at `GET /api/v1/user/` with middleware:

1. `allowApiKeyAuthentication`
2. `isAuthenticated`

Source: [userController.ts](https://github.com/lightdash/lightdash/blob/master/packages/backend/src/controllers/userController.ts)

`allowApiKeyAuthentication` tries, in order:

1. OAuth access token via `oauthService.authenticate()` (Bearer header)
2. Service account bearer
3. Personal access token (`Authorization: ApiKey ldpat_...`)

Source: [middlewares.ts](https://github.com/lightdash/lightdash/blob/master/packages/backend/src/controllers/authentication/middlewares.ts)

Therefore a Lightdash OAuth access token issued by `/api/v1/oauth/token` is accepted on ordinary API routes that use `allowApiKeyAuthentication`, including `GET /api/v1/user`.

### Alternate endpoint: `/api/v1/oauth/userinfo`

Lightdash also exposes OpenID Connect-style userinfo at `GET /api/v1/oauth/userinfo` (also behind `allowApiKeyAuthentication`). MCP v1 intentionally uses `GET /api/v1/user` because:

- It returns the canonical `LightdashUser` shape used across the API.
- It includes `organizationUuid` for session org binding.
- It matches the existing `@lightdash-tools/client` `getAuthenticatedUser()` method.

### Response shape: `organizationUuid`

OpenAPI `LightdashUser` includes optional `organizationUuid`. MCP maps `user.organizationUuid` to session binding and compares `organizationUuid ?? null` on resume so missing org context does not silently widen sessions.

When `organizationUuid` is absent, org-mismatch protection is limited to subject (`userUuid`) binding only.

## Verification in this repository

| Layer                                                             | What it proves                                                                 |
| :---------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| `packages/mcp/src/auth/lightdash-oauth-upstream-contract.test.ts` | Documents upstream contract constants and OpenAPI field expectations           |
| `packages/mcp/src/auth/lightdash-token-validation.test.ts`        | MCP validator sends `Bearer` to `GET /api/v1/user` and maps `organizationUuid` |
| `packages/client/src/api/v1/users.test.ts`                        | Client calls `GET /user` (resolved to `/api/v1/user`)                          |
| `packages/mcp/src/index.integration.test.ts`                      | Optional live check when `LIGHTDASH_TOOLS_TEST_OAUTH_ACCESS_TOKEN` is set      |

### Optional live contract test

Against a real Lightdash instance:

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_TEST_OAUTH_ACCESS_TOKEN="<oauth-access-token-from-lightdash-oauth-flow>"
pnpm test packages/mcp/src/index.integration.test.ts
```

The live test validates `validateLightdashAccessToken()` and `LightdashClient.v1.users.getAuthenticatedUser()` with the same bearer token.

## JWT scope claims are not trusted for Lightdash OAuth

Lightdash OAuth access tokens are typically **opaque**. MCP-local `mcp:read` / `mcp:write` enforcement applies only when tokens carry decodable JWT scope claims. In `lightdash-oauth` mode, `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES`, `LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED`, and `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES` are rejected at startup.
