import { sendJson } from '../../transports/http-response.js';
import { extractBearerToken } from '../bearer.js';

import { validateLightdashAccessToken } from './lightdash-token-validation.js';
import { getProtectedResourceMetadataPathUrl } from './oauth-protected-resource.js';
import { extractTokenScopes, hasRequiredScopes } from './token-scopes.js';
import { TokenValidationError } from './token-validation-error.js';
import { buildWwwAuthenticateHeader } from './www-authenticate.js';

import type { ValidatedLightdashUser } from './lightdash-token-validation.js';
import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface OAuthAuthSuccess {
  ok: true;
  accessToken: string;
  user: ValidatedLightdashUser;
  scopes: string[] | undefined;
}

export interface OAuthAuthFailure {
  ok: false;
  status: number;
  body: Record<string, string>;
  wwwAuthenticate?: string;
  headers?: Record<string, string>;
}

export type OAuthAuthResult = OAuthAuthFailure | OAuthAuthSuccess;

/** Builds the standard missing-Bearer challenge for a persona MCP path. */
export function buildBearerRequiredFailure(
  config: McpHttpConfig,
  mcpPath: string,
): OAuthAuthFailure {
  const resourceMetadataUrl = getProtectedResourceMetadataPathUrl(config, mcpPath);
  const scope = config.requiredScopes.join(' ');
  return {
    ok: false,
    status: 401,
    body: {
      error: 'invalid_request',
      error_description: 'Bearer access token required',
    },
    wwwAuthenticate: buildWwwAuthenticateHeader({ resourceMetadataUrl, scope }),
  };
}

/** Builds an invalid_token challenge (e.g. session subject/org mismatch). */
export function buildInvalidTokenFailure(
  config: McpHttpConfig,
  mcpPath: string,
  errorDescription: string,
): OAuthAuthFailure {
  const resourceMetadataUrl = getProtectedResourceMetadataPathUrl(config, mcpPath);
  return {
    ok: false,
    status: 401,
    body: {
      error: 'invalid_token',
      error_description: errorDescription,
    },
    wwwAuthenticate: buildWwwAuthenticateHeader({
      resourceMetadataUrl,
      scope: config.requiredScopes.join(' '),
      error: 'invalid_token',
      errorDescription,
    }),
  };
}

export async function authenticateLightdashOAuth(
  req: IncomingMessage,
  config: McpHttpConfig,
  mcpPath: string,
): Promise<OAuthAuthResult> {
  const resourceMetadataUrl = getProtectedResourceMetadataPathUrl(config, mcpPath);
  const scope = config.requiredScopes.join(' ');
  const token = extractBearerToken(req);

  if (!token) {
    return buildBearerRequiredFailure(config, mcpPath);
  }

  try {
    const user = await validateLightdashAccessToken(config, token);
    const scopes = extractTokenScopes(token, config.scopesSupported, {
      grantAllWhenUnknown: false,
    });
    if (
      config.requiredScopes.length > 0 &&
      !hasRequiredScopes(scopes ?? [], config.requiredScopes)
    ) {
      const missingScopes = config.requiredScopes.filter(
        (scope) => !(scopes ?? []).includes(scope),
      );
      return {
        ok: false,
        status: 403,
        body: {
          error: 'insufficient_scope',
          error_description: `Missing required OAuth scopes: ${missingScopes.join(', ')}`,
        },
        wwwAuthenticate: buildWwwAuthenticateHeader({
          resourceMetadataUrl,
          scope: config.requiredScopes.join(' '),
          error: 'insufficient_scope',
          errorDescription: `Missing required OAuth scopes: ${missingScopes.join(', ')}`,
        }),
      };
    }

    return { ok: true, accessToken: token, user, scopes };
  } catch (error) {
    if (error instanceof TokenValidationError && error.reason === 'upstream_unavailable') {
      const headers =
        error.retryAfterSeconds !== undefined
          ? { 'Retry-After': String(error.retryAfterSeconds) }
          : undefined;
      return {
        ok: false,
        status: 503,
        body: {
          error: 'temporarily_unavailable',
          error_description: error.message,
        },
        headers,
      };
    }

    return {
      ok: false,
      status: 401,
      body: {
        error: 'invalid_token',
        error_description: 'Invalid or expired Lightdash access token',
      },
      wwwAuthenticate: buildWwwAuthenticateHeader({
        resourceMetadataUrl,
        scope,
        error: 'invalid_token',
        errorDescription: 'Invalid or expired Lightdash access token',
      }),
    };
  }
}

export function writeOAuthAuthFailure(res: ServerResponse, failure: OAuthAuthFailure): void {
  const headers: Record<string, string> = { ...failure.headers };
  if (failure.wwwAuthenticate) {
    headers['WWW-Authenticate'] = failure.wwwAuthenticate;
  }
  sendJson(
    res,
    failure.status,
    failure.body,
    Object.keys(headers).length > 0 ? headers : undefined,
  );
}
