import { describe, expect, it } from 'vitest';

import { buildOAuthProtectedResourceMetadata } from '../auth/oauth-protected-resource.js';
import {
  createStreamableHttpServer,
  startStreamableHttpServer,
} from '../transports/streamable-http.js';

import type { McpHttpConfig } from '../config/load-mcp-config.js';

const oauthConfig: McpHttpConfig = {
  lightdashUrl: 'https://app.lightdash.cloud',
  host: '127.0.0.1',
  port: 0,
  publicUrl: 'https://mcp.example.com',
  mcpPath: '/mcp',
  authMode: 'lightdash-oauth',
  allowedOrigins: [],
  maxBodyBytes: 1024,
  sessionTtlMs: 1000,
  maxSessions: 10,
  maxSessionsPerSubject: 10,
  sessionCleanupMs: 1000,
  requiredScopes: ['mcp:read'],
  scopesSupported: ['mcp:read', 'mcp:write'],
  validateToken: false,
  tokenValidationCacheTtlMs: 30_000,
  grantAllScopesWhenUnknown: false,
  experimentalIdentityOAuth: false,
  dangerouslyAllowAnyOrigin: false,
};

describe('streamable HTTP OAuth metadata', () => {
  it('builds protected resource metadata for OAuth mode', () => {
    const metadata = buildOAuthProtectedResourceMetadata(oauthConfig);
    expect(metadata.authorization_servers).toEqual(['https://app.lightdash.cloud']);
    expect(metadata.resource).toBe('https://mcp.example.com/mcp');
  });

  it('exports startStreamableHttpServer', () => {
    expect(typeof startStreamableHttpServer).toBe('function');
  });

  it('exports createStreamableHttpServer', () => {
    expect(typeof createStreamableHttpServer).toBe('function');
  });
});
