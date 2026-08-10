import { UNRESTRICTED_ENABLED_PROFILES, resolveRootMcpPath } from './enabled-profiles.js';

import type { McpHttpConfig } from './load-mcp-config.js';

/** Shared base `McpHttpConfig` for MCP package unit/integration tests. */
export function makeTestMcpHttpConfig(overrides?: Partial<McpHttpConfig>): McpHttpConfig {
  const enabledProfiles = overrides?.enabledProfiles ?? UNRESTRICTED_ENABLED_PROFILES;
  return {
    lightdashUrl: 'https://app.lightdash.cloud',
    host: '127.0.0.1',
    port: 3100,
    publicUrl: 'https://mcp.example.com',
    mcpPath: resolveRootMcpPath(enabledProfiles),
    enabledProfiles,
    authMode: 'lightdash-oauth',
    allowedOrigins: [],
    maxBodyBytes: 1024,
    requiredScopes: ['mcp:read'],
    scopesSupported: ['mcp:read', 'mcp:write'],
    validateToken: true,
    tokenValidationCacheTtlMs: 30_000,
    ...overrides,
  };
}
