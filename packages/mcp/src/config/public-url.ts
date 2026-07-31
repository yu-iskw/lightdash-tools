import type { McpHttpConfig } from './load-mcp-config.js';

/** Returns config.publicUrl or throws — required for OAuth metadata and callback URLs. */
export function requirePublicUrl(config: McpHttpConfig, purpose: string): string {
  if (!config.publicUrl) {
    throw new Error(`publicUrl is required for ${purpose}`);
  }
  return config.publicUrl;
}
