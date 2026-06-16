import type { McpHttpConfig } from '../config/load-mcp-config.js';

export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
}

function requirePublicUrl(config: McpHttpConfig): string {
  if (!config.publicUrl) {
    throw new Error('publicUrl is required for OAuth protected resource metadata');
  }
  return config.publicUrl;
}

/** Builds MCP OAuth protected-resource metadata for this HTTP server. */
export function buildOAuthProtectedResourceMetadata(
  config: McpHttpConfig,
): OAuthProtectedResourceMetadata {
  const publicUrl = requirePublicUrl(config);

  // authorization_servers points at Lightdash for v1 scaffolding. Upstream Lightdash does not yet
  // publish OAuth Authorization Server Metadata at /.well-known/oauth-authorization-server, so
  // standards-compliant MCP clients require preconfigured Lightdash OAuth endpoints in the client.
  return {
    resource: `${publicUrl}${config.mcpPath}`,
    authorization_servers: [config.lightdashUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopesSupported,
  };
}

export function getProtectedResourceMetadataUrl(config: McpHttpConfig): string {
  return `${requirePublicUrl(config)}/.well-known/oauth-protected-resource`;
}

export function getProtectedResourceMetadataPathUrl(config: McpHttpConfig): string {
  const publicUrl = requirePublicUrl(config);
  const resourcePath = config.mcpPath.replace(/^\//, '');
  return `${publicUrl}/.well-known/oauth-protected-resource/${resourcePath}`;
}
