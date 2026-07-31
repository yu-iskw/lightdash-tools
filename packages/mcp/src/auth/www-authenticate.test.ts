import { describe, expect, it } from 'vitest';

import {
  buildOAuthProtectedResourceMetadata,
  getAuthorizationServerMetadataUrl,
} from './oauth-protected-resource.js';
import { buildWwwAuthenticateHeader } from './www-authenticate.js';

import type { McpHttpConfig } from '../config/load-mcp-config.js';

const baseConfig: McpHttpConfig = {
  lightdashUrl: 'https://app.lightdash.cloud',
  host: '0.0.0.0',
  port: 3100,
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
  validateToken: true,
  tokenValidationCacheTtlMs: 30_000,
};

describe('getAuthorizationServerMetadataUrl', () => {
  it('builds the well-known AS metadata URL for a Lightdash issuer', () => {
    expect(getAuthorizationServerMetadataUrl('https://app.lightdash.cloud')).toBe(
      'https://app.lightdash.cloud/.well-known/oauth-authorization-server',
    );
    expect(getAuthorizationServerMetadataUrl('https://app.lightdash.cloud/')).toBe(
      'https://app.lightdash.cloud/.well-known/oauth-authorization-server',
    );
  });
});

describe('buildOAuthProtectedResourceMetadata', () => {
  it('includes resource and MCP host as authorization_servers', () => {
    const metadata = buildOAuthProtectedResourceMetadata(baseConfig);
    expect(metadata).toEqual({
      resource: 'https://mcp.example.com/semantic-layer/v1/mcp',
      authorization_servers: ['https://mcp.example.com'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp:read', 'mcp:write'],
    });
    expect(getAuthorizationServerMetadataUrl(metadata.authorization_servers[0])).toBe(
      'https://mcp.example.com/.well-known/oauth-authorization-server',
    );
  });
});

describe('buildWwwAuthenticateHeader', () => {
  it('includes resource_metadata and scope', () => {
    const header = buildWwwAuthenticateHeader({
      resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      scope: 'mcp:read',
    });
    expect(header).toContain('Bearer');
    expect(header).toContain(
      'resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
    );
    expect(header).toContain('scope="mcp:read"');
  });

  it('includes invalid_token error', () => {
    const header = buildWwwAuthenticateHeader({
      resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      scope: 'mcp:read',
      error: 'invalid_token',
    });
    expect(header).toContain('error="invalid_token"');
  });

  it('escapes backslashes and quotes in quoted-string values', () => {
    const header = buildWwwAuthenticateHeader({
      resourceMetadataUrl: 'https://mcp.example.com/meta"with\\quotes',
      scope: 'mcp:read',
      errorDescription: 'Token says "nope"\\retry',
    });

    expect(header).toContain('resource_metadata="https://mcp.example.com/meta\\"with\\\\quotes"');
    expect(header).toContain('error_description="Token says \\"nope\\"\\\\retry"');
  });
});
