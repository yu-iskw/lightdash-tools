import { OAUTH_AUTHORIZATION_SERVER_METADATA_PATH } from '../../config/env.js';
import { normalizeMcpPath } from '../../config/normalize-url.js';
import { requirePublicUrl } from '../../config/public-url.js';
import { getPersonaByPath } from '../../personas/index.js';

import type { McpHttpConfig } from '../../config/load-mcp-config.js';

const OAUTH_PROTECTED_RESOURCE_CONTEXT = 'OAuth protected resource metadata';

/** Well-known OAuth protected-resource metadata root path. */
export const OAUTH_PROTECTED_RESOURCE_ROOT = '/.well-known/oauth-protected-resource';

export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
}

/**
 * Builds MCP OAuth protected-resource metadata for a persona MCP path.
 * Callers must pass an explicit persona path (root PRM uses `config.mcpPath`).
 */
export function buildOAuthProtectedResourceMetadata(
  config: McpHttpConfig,
  mcpPath: string,
): OAuthProtectedResourceMetadata {
  const publicUrl = requirePublicUrl(config, OAUTH_PROTECTED_RESOURCE_CONTEXT);
  const path = normalizeMcpPath(mcpPath);

  // Broker mode: authorization_servers is the MCP host (PUBLIC_URL). Clients discover
  // AS metadata at {PUBLIC_URL}/.well-known/oauth-authorization-server and never need
  // the Lightdash client secret. Identity validation remains GET /api/v1/user until
  // upstream tokens are resource-bound.
  return {
    resource: `${publicUrl}${path}`,
    authorization_servers: [publicUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopesSupported,
  };
}

export function getProtectedResourceMetadataUrl(config: McpHttpConfig): string {
  return `${requirePublicUrl(config, OAUTH_PROTECTED_RESOURCE_CONTEXT)}${OAUTH_PROTECTED_RESOURCE_ROOT}`;
}

/** Path-specific PRM URL for a persona MCP endpoint. */
export function getProtectedResourceMetadataPathUrl(
  config: McpHttpConfig,
  mcpPath: string,
): string {
  const publicUrl = requirePublicUrl(config, OAUTH_PROTECTED_RESOURCE_CONTEXT);
  const resourcePath = normalizeMcpPath(mcpPath).replace(/^\//, '');
  return `${publicUrl}${OAUTH_PROTECTED_RESOURCE_ROOT}/${resourcePath}`;
}

/**
 * Resolves the persona MCP path for a PRM well-known request.
 * Root PRM maps to the default persona (`config.mcpPath`); path-specific PRM
 * is served only for shipped persona paths.
 */
export function resolveProtectedResourceMcpPath(
  path: string,
  config: McpHttpConfig,
): string | undefined {
  if (!path.startsWith(OAUTH_PROTECTED_RESOURCE_ROOT)) {
    return undefined;
  }
  if (path === OAUTH_PROTECTED_RESOURCE_ROOT) {
    return config.mcpPath;
  }
  const prefix = `${OAUTH_PROTECTED_RESOURCE_ROOT}/`;
  if (!path.startsWith(prefix)) {
    return undefined;
  }
  const resourcePath = `/${path.slice(prefix.length)}`;
  return getPersonaByPath(resourcePath)?.path;
}

/** Well-known OAuth Authorization Server Metadata URL for an AS origin. */
export function getAuthorizationServerMetadataUrl(authorizationServerOrigin: string): string {
  const base = authorizationServerOrigin.replace(/\/$/, '');
  return `${base}${OAUTH_AUTHORIZATION_SERVER_METADATA_PATH}`;
}
