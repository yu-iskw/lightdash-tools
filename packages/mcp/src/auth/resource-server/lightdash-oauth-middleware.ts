import { sendJson } from '../../transports/http-response.js';
import { extractBearerToken } from '../bearer.js';
import { verifyMcpAccessToken } from '../oauth-broker/mcp-access-token.js';

import { validateLightdashAccessToken } from './lightdash-token-validation.js';
import {
  buildOAuthProtectedResourceMetadata,
  getProtectedResourceMetadataPathUrl,
} from './oauth-protected-resource.js';
import { hasRequiredScopes } from './token-scopes.js';
import { TokenValidationError } from './token-validation-error.js';
import { buildWwwAuthenticateHeader } from './www-authenticate.js';

import type { ValidatedLightdashUser } from './lightdash-token-validation.js';
import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface OAuthAuthSuccess {
  ok: true;
  /** Server-held downstream Lightdash credential. Never sourced directly from the MCP bearer. */
  accessToken: string;
  user: ValidatedLightdashUser;
  /** MCP authorization scopes carried by the broker-issued token. */
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

/** Builds the standard missing-Bearer challenge for a profile MCP path. */
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

function parseBrokerScopes(scope: string | undefined): string[] | undefined {
  if (!scope) return undefined;
  const scopes = scope.split(/\s+/).filter(Boolean);
  return scopes.length > 0 ? scopes : undefined;
}

function invalidMcpTokenFailure(
  resourceMetadataUrl: string,
  scope: string,
): OAuthAuthFailure {
  const description = 'Invalid, expired, or wrong-audience MCP access token';
  return {
    ok: false,
    status: 401,
    body: {
      error: 'invalid_token',
      error_description: description,
    },
    wwwAuthenticate: buildWwwAuthenticateHeader({
      resourceMetadataUrl,
      scope,
      error: 'invalid_token',
      errorDescription: description,
    }),
  };
}

export async function authenticateLightdashOAuth(
  req: IncomingMessage,
  config: McpHttpConfig,
  mcpPath: string,
): Promise<OAuthAuthResult> {
  const resourceMetadataUrl = getProtectedResourceMetadataPathUrl(config, mcpPath);
  const expectedResource = buildOAuthProtectedResourceMetadata(config, mcpPath).resource;
  const scope = config.requiredScopes.join(' ');
  const token = extractBearerToken(req);

  if (!token) {
    return buildBearerRequiredFailure(config, mcpPath);
  }

  // The MCP resource server accepts only tokens minted by its co-located authorization
  // server and bound to this exact profile resource. Raw Lightdash tokens fail here and
  // are never passed through to the downstream API.
  const brokerToken = verifyMcpAccessToken(config, token, expectedResource);
  if (!brokerToken) {
    return invalidMcpTokenFailure(resourceMetadataUrl, scope);
  }

  const scopes = parseBrokerScopes(brokerToken.scope);
  if (
    config.requiredScopes.length > 0 &&
    !hasRequiredScopes(scopes ?? [], config.requiredScopes)
  ) {
    const missingScopes = config.requiredScopes.filter(
      (requiredScope) => !(scopes ?? []).includes(requiredScope),
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

  try {
    const user = await validateLightdashAccessToken(config, brokerToken.lightdashAccessToken);
    return {
      ok: true,
      accessToken: brokerToken.lightdashAccessToken,
      user,
      scopes,
    };
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

    return invalidMcpTokenFailure(resourceMetadataUrl, scope);
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
