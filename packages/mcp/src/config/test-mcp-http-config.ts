import type { McpHttpConfig } from './load-mcp-config.js';

/** Shared base `McpHttpConfig` for MCP package unit/integration tests. */
export function makeTestMcpHttpConfig(overrides?: Partial<McpHttpConfig>): McpHttpConfig {
  return {
    lightdashUrl: 'https://app.lightdash.cloud',
    host: '127.0.0.1',
    port: 3100,
    publicUrl: 'https://mcp.example.com',
    mcpPath: '/semantic-layer/v1/mcp',
    authMode: 'lightdash-oauth',
    allowedOrigins: [],
    maxBodyBytes: 1024,
    sessionTtlMs: 60_000,
    maxSessions: 10,
    maxSessionsPerSubject: 10,
    sessionCleanupMs: 60_000,
    requiredScopes: ['mcp:read'],
    scopesSupported: ['mcp:read', 'mcp:write'],
    validateToken: true,
    tokenValidationCacheTtlMs: 30_000,
    ...overrides,
  };
}
