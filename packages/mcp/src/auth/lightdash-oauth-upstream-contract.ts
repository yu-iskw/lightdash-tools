/**
 * Upstream Lightdash OAuth contract used by MCP token validation.
 *
 * MCP validates identity by calling `GET /api/v1/user` with the user's OAuth access
 * token as `Authorization: Bearer <token>`. This is not an MCP invention: upstream
 * Lightdash wires that route through `allowApiKeyAuthentication`, which authenticates
 * OAuth bearer tokens before personal access tokens.
 *
 * @see https://github.com/lightdash/lightdash/blob/master/packages/backend/src/controllers/userController.ts
 * @see https://github.com/lightdash/lightdash/blob/master/packages/backend/src/controllers/authentication/middlewares.ts
 */
export const LIGHTDASH_OAUTH_VALIDATION_ENDPOINT = '/api/v1/user' as const;
export const LIGHTDASH_OAUTH_AUTHORIZE_ENDPOINT = '/api/v1/oauth/authorize' as const;
export const LIGHTDASH_OAUTH_TOKEN_ENDPOINT = '/api/v1/oauth/token' as const;

/** Middleware chain on upstream `GetAuthenticatedUser` (TSOA `UserController`). */
export const LIGHTDASH_GET_AUTHENTICATED_USER_MIDDLEWARE = [
  'allowApiKeyAuthentication',
  'isAuthenticated',
] as const;

/**
 * Order enforced by upstream `allowApiKeyAuthentication`:
 * OAuth bearer → service account bearer → personal access token (`ApiKey` header).
 */
export const LIGHTDASH_ALLOW_API_KEY_AUTH_ORDER = [
  'oauth-bearer',
  'service-account-bearer',
  'personal-access-token',
] as const;

export const LIGHTDASH_OAUTH_UPSTREAM_REFERENCES = [
  'lightdash/lightdash packages/backend/src/controllers/userController.ts — GetAuthenticatedUser uses allowApiKeyAuthentication',
  'lightdash/lightdash packages/backend/src/controllers/authentication/middlewares.ts — allowApiKeyAuthentication tries oauthService.authenticate() first',
  'lightdash/lightdash packages/backend/src/routers/oauthRouter.ts — /api/v1/oauth/userinfo also uses allowApiKeyAuthentication (alternate OIDC surface, not used by MCP v1 validation)',
] as const;
