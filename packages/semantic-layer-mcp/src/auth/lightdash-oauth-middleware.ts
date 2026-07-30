import { sendJson } from '../transports/http-response.js';

import { extractBearerToken } from './bearer.js';
import { validateLightdashAccessToken } from './lightdash-token-validation.js';
import { getProtectedResourceMetadataPathUrl } from './oauth-protected-resource.js';
import { TokenValidationError } from './token-validation-error.js';
import { buildWwwAuthenticateHeader } from './www-authenticate.js';

import type { ValidatedLightdashUser } from './lightdash-token-validation.js';
import type { McpHttpConfig } from '../config/load-http-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface OAuthAuthSuccess {
  ok: true;
  accessToken: string;
  user: ValidatedLightdashUser;
}

export interface OAuthAuthFailure {
  ok: false;
  status: number;
  body: Record<string, string>;
  wwwAuthenticate?: string;
  headers?: Record<string, string>;
}

export type OAuthAuthResult = OAuthAuthFailure | OAuthAuthSuccess;

export async function authenticateLightdashOAuth(
  req: IncomingMessage,
  config: McpHttpConfig,
): Promise<OAuthAuthResult> {
  const resourceMetadataUrl = getProtectedResourceMetadataPathUrl(config);
  const token = extractBearerToken(req);

  if (!token) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'invalid_request',
        error_description: 'Bearer access token required',
      },
      wwwAuthenticate: buildWwwAuthenticateHeader({ resourceMetadataUrl }),
    };
  }

  try {
    const user = await validateLightdashAccessToken(config, token);
    return { ok: true, accessToken: token, user };
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
