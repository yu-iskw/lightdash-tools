import type { McpHttpConfig } from '../config/load-mcp-config.js';

export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
}

export function buildOAuthProtectedResourceMetadata(
  config: McpHttpConfig,
): OAuthProtectedResourceMetadata {
  if (!config.publicUrl) {
    throw new Error('publicUrl is required to build OAuth protected resource metadata');
  }

  return {
    resource: `${config.publicUrl}${config.mcpPath}`,
    authorization_servers: [config.lightdashUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopesSupported,
  };
}

export function getProtectedResourceMetadataUrl(config: McpHttpConfig): string {
  if (!config.publicUrl) {
    throw new Error('publicUrl is required for OAuth protected resource metadata URL');
  }
  return `${config.publicUrl}/.well-known/oauth-protected-resource`;
}

export function getProtectedResourceMetadataPathUrl(config: McpHttpConfig): string {
  if (!config.publicUrl) {
    throw new Error('publicUrl is required for OAuth protected resource metadata URL');
  }
  const resourcePath = config.mcpPath.replace(/^\//, '');
  return `${config.publicUrl}/.well-known/oauth-protected-resource/${resourcePath}`;
}
