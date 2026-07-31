import { OAUTH_AUTHORIZATION_SERVER_METADATA_PATH } from '../config/env.js';
import { requirePublicUrl } from '../config/public-url.js';

import type { McpHttpConfig } from '../config/load-mcp-config.js';

const OAUTH_PROTECTED_RESOURCE_CONTEXT = 'OAuth protected resource metadata';

export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
}

/** Builds MCP OAuth protected-resource metadata for this HTTP server. */
export function buildOAuthProtectedResourceMetadata(
  config: McpHttpConfig,
): OAuthProtectedResourceMetadata {
  const publicUrl = requirePublicUrl(config, OAUTH_PROTECTED_RESOURCE_CONTEXT);

  // Broker mode: authorization_servers is the MCP host (PUBLIC_URL). Clients discover
  // AS metadata at {PUBLIC_URL}/.well-known/oauth-authorization-server and never need
  // the Lightdash client secret. Identity validation remains GET /api/v1/user until
  // upstream tokens are resource-bound.
  return {
    resource: `${publicUrl}${config.mcpPath}`,
    authorization_servers: [publicUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopesSupported,
  };
}

export function getProtectedResourceMetadataUrl(config: McpHttpConfig): string {
  return `${requirePublicUrl(config, OAUTH_PROTECTED_RESOURCE_CONTEXT)}/.well-known/oauth-protected-resource`;
}

export function getProtectedResourceMetadataPathUrl(config: McpHttpConfig): string {
  const publicUrl = requirePublicUrl(config, OAUTH_PROTECTED_RESOURCE_CONTEXT);
  const resourcePath = config.mcpPath.replace(/^\//, '');
  return `${publicUrl}/.well-known/oauth-protected-resource/${resourcePath}`;
}

/** Well-known OAuth Authorization Server Metadata URL for an AS origin. */
export function getAuthorizationServerMetadataUrl(authorizationServerOrigin: string): string {
  const base = authorizationServerOrigin.replace(/\/$/, '');
  return `${base}${OAUTH_AUTHORIZATION_SERVER_METADATA_PATH}`;
}
