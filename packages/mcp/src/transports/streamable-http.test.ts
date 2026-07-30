import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildOAuthProtectedResourceMetadata,
  getLightdashAuthorizationServerMetadataUrl,
} from '../auth/oauth-protected-resource.js';
import { buildWwwAuthenticateHeader } from '../auth/www-authenticate.js';
import {
  ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS,
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
} from '../config/env.js';
import { loadMcpHttpConfig } from '../config/load-mcp-config.js';

import { buildCorsHeaders, checkOrigin } from './http-response.js';
import { createStreamableHttpServer, startStreamableHttpServer } from './streamable-http.js';

import type { McpHttpConfig } from '../config/load-mcp-config.js';

const oauthConfig: McpHttpConfig = {
  lightdashUrl: 'https://app.lightdash.cloud',
  host: '127.0.0.1',
  port: 0,
  publicUrl: 'https://mcp.example.com',
  mcpPath: '/semantic-layer/v1/mcp',
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
  dangerouslyAllowWriteInIdentityOAuth: false,
};

const originalEnv = { ...process.env };

function clearMcpEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('LIGHTDASH_TOOLS_MCP_') || key.startsWith('MCP_')) {
      delete process.env[key];
    }
  }
  delete process.env.LIGHTDASH_URL;
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('streamable HTTP security policy', () => {
  beforeEach(() => {
    clearMcpEnv();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('fails closed on production lightdash-oauth without experimental opt-in', () => {
    process.env.NODE_ENV = 'production';
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS] = 'https://cursor.com';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH);
  });

  it('fails closed on production lightdash-oauth without CORS allowlist', () => {
    process.env.NODE_ENV = 'production';
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH] = '1';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS);
  });

  it('rejects browser origins when CORS allowlist is empty unless dangerouslyAllowAnyOrigin', () => {
    expect(checkOrigin('https://browser.example.com', [], false)).toBe(false);
    expect(buildCorsHeaders('https://browser.example.com', [], false)).toEqual({});
    expect(buildCorsHeaders('https://browser.example.com', [], true)).not.toEqual({});
  });
});

describe('streamable HTTP OAuth metadata', () => {
  it('builds protected resource metadata with issuer origin in authorization_servers', () => {
    const metadata = buildOAuthProtectedResourceMetadata(oauthConfig);
    expect(metadata.authorization_servers).toEqual(['https://app.lightdash.cloud']);
    expect(metadata.resource).toBe('https://mcp.example.com/semantic-layer/v1/mcp');
    expect(getLightdashAuthorizationServerMetadataUrl(metadata.authorization_servers[0])).toBe(
      'https://app.lightdash.cloud/.well-known/oauth-authorization-server',
    );
  });

  it('builds WWW-Authenticate challenges with resource_metadata for OAuth clients', () => {
    const header = buildWwwAuthenticateHeader({
      resourceMetadataUrl:
        'https://mcp.example.com/.well-known/oauth-protected-resource/semantic-layer/v1/mcp',
      scope: 'mcp:read',
      error: 'invalid_token',
    });

    expect(header).toContain('error="invalid_token"');
    expect(header).toContain('resource_metadata=');
    expect(header).toContain('scope="mcp:read"');
  });

  it('exports startStreamableHttpServer', () => {
    expect(typeof startStreamableHttpServer).toBe('function');
  });

  it('exports createStreamableHttpServer', () => {
    expect(typeof createStreamableHttpServer).toBe('function');
  });
});
