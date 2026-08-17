import { getOAuthCallbackUrl, type McpHttpConfig } from '../../config/load-mcp-config.js';
import {
  LIGHTDASH_OAUTH_AUTHORIZE_ENDPOINT,
  LIGHTDASH_OAUTH_TOKEN_ENDPOINT,
} from '../lightdash-oauth-upstream-contract.js';

export interface LightdashTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

function parseLightdashTokenResponse(body: unknown): LightdashTokenResponse {
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { access_token?: unknown }).access_token !== 'string' ||
    (body as { access_token: string }).access_token.length === 0
  ) {
    throw new Error('Lightdash token response missing access_token');
  }
  const record = body as Record<string, unknown>;
  return {
    access_token: record.access_token as string,
    token_type: typeof record.token_type === 'string' ? record.token_type : undefined,
    expires_in: typeof record.expires_in === 'number' ? record.expires_in : undefined,
    refresh_token: typeof record.refresh_token === 'string' ? record.refresh_token : undefined,
    scope: typeof record.scope === 'string' ? record.scope : undefined,
  };
}

/** Exchanges an authorization code at Lightdash using the server-held confidential client. */
export async function exchangeLightdashAuthorizationCode(
  config: McpHttpConfig,
  code: string,
): Promise<LightdashTokenResponse> {
  if (!config.oauthClientId || !config.oauthClientSecret) {
    throw new Error('OAuth client credentials are required for token exchange');
  }

  const tokenUrl = `${config.lightdashUrl}${LIGHTDASH_OAUTH_TOKEN_ENDPOINT}`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getOAuthCallbackUrl(config),
    client_id: config.oauthClientId,
    client_secret: config.oauthClientSecret.expose(),
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (config.proxyAuthorization) {
    headers['Proxy-Authorization'] = config.proxyAuthorization.expose();
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Lightdash token exchange failed (${response.status}): ${text.slice(0, 200)}`);
  }

  return parseLightdashTokenResponse(await response.json());
}

/**
 * Builds the downstream Lightdash authorize URL for the server-held confidential client.
 *
 * Client PKCE, MCP scopes, and RFC 8707 `resource` are properties of the MCP client→broker
 * authorization leg. They must not be forwarded blindly to Lightdash: the downstream
 * authorization leg has a different client and protected resource. The broker state is the
 * only client-flow correlation value propagated upstream.
 */
export function buildLightdashAuthorizeUrl(
  config: McpHttpConfig,
  params: {
    state: string;
  },
): string {
  if (!config.oauthClientId) {
    throw new Error('OAuth client id is required');
  }

  const url = new URL(`${config.lightdashUrl}${LIGHTDASH_OAUTH_AUTHORIZE_ENDPOINT}`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.oauthClientId);
  url.searchParams.set('redirect_uri', getOAuthCallbackUrl(config));
  url.searchParams.set('state', params.state);
  return url.toString();
}
