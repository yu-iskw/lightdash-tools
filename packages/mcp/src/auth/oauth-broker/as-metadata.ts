import { OAUTH_AUTHORIZE_PATH, OAUTH_REGISTER_PATH, OAUTH_TOKEN_PATH } from '../../config/env.js';
import { type McpHttpConfig } from '../../config/load-mcp-config.js';
import { requirePublicUrl } from '../../config/public-url.js';

export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported: string[];
}

/**
 * RFC 8414 metadata for the MCP-hosted OAuth broker (issuer = PUBLIC_URL).
 * On an extra invoke origin, token/DCR URLs move to that origin; issuer and
 * authorize stay on PUBLIC_URL (intentional RFC 8414 split).
 */
export function buildBrokerAuthorizationServerMetadata(
  config: McpHttpConfig,
  tokenOrigin: string,
): AuthorizationServerMetadata {
  const issuer = requirePublicUrl(config, 'authorization server metadata');
  return {
    issuer,
    authorization_endpoint: `${issuer}${OAUTH_AUTHORIZE_PATH}`,
    token_endpoint: `${tokenOrigin}${OAUTH_TOKEN_PATH}`,
    registration_endpoint: `${tokenOrigin}${OAUTH_REGISTER_PATH}`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: config.scopesSupported,
  };
}
