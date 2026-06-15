import { extractBearerToken } from './bearer.js';
import { validateLightdashAccessToken } from './lightdash-token-validation.js';
import { getProtectedResourceMetadataUrl } from './oauth-protected-resource.js';
import { sendJson } from './shared-key-middleware.js';
import { buildWwwAuthenticateHeader } from './www-authenticate.js';

import type { ValidatedLightdashUser } from './lightdash-token-validation.js';
import type { McpHttpConfig } from '../config/load-mcp-config.js';
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
}

export type OAuthAuthResult = OAuthAuthFailure | OAuthAuthSuccess;

export async function authenticateLightdashOAuth(
  req: IncomingMessage,
  config: McpHttpConfig,
): Promise<OAuthAuthResult> {
  const resourceMetadataUrl = getProtectedResourceMetadataUrl(config);
  const scope = config.requiredScopes.join(' ');
  const token = extractBearerToken(req);

  if (!token) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
      wwwAuthenticate: buildWwwAuthenticateHeader({ resourceMetadataUrl, scope }),
    };
  }

  try {
    const user = await validateLightdashAccessToken(config, token);
    return { ok: true, accessToken: token, user };
  } catch {
    return {
      ok: false,
      status: 401,
      body: { error: 'Invalid or expired Lightdash access token' },
      wwwAuthenticate: buildWwwAuthenticateHeader({
        resourceMetadataUrl,
        scope,
        error: 'invalid_token',
      }),
    };
  }
}

export function writeOAuthAuthFailure(res: ServerResponse, failure: OAuthAuthFailure): void {
  const headers = failure.wwwAuthenticate
    ? { 'WWW-Authenticate': failure.wwwAuthenticate }
    : undefined;
  sendJson(res, failure.status, failure.body, headers);
}
