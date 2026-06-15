export type McpAuthMode = 'env' | 'lightdash-oauth' | 'none' | 'shared-key';

export const MCP_AUTH_MODE_NONE = 'none' as const;
export const MCP_AUTH_MODE_SHARED_KEY = 'shared-key' as const;
export const MCP_AUTH_MODE_LIGHTDASH_OAUTH = 'lightdash-oauth' as const;

export const MCP_HTTP_AUTH_MODES = [
  MCP_AUTH_MODE_NONE,
  MCP_AUTH_MODE_SHARED_KEY,
  MCP_AUTH_MODE_LIGHTDASH_OAUTH,
] as const;
