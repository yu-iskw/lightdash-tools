import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildOAuthProtectedResourceMetadata,
  getAuthorizationServerMetadataUrl,
} from '../auth/resource-server/oauth-protected-resource.js';
import { buildWwwAuthenticateHeader } from '../auth/resource-server/www-authenticate.js';
import {
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET,
} from '../config/env.js';
import { loadMcpHttpConfig } from '../config/load-mcp-config.js';
import { makeTestMcpHttpConfig } from '../config/test-mcp-http-config.js';
import { CONTENT_READER_PROFILE_PATH } from '../profiles/content-reader/v1/index.js';
import { ORGANIZATION_AUDIT_PROFILE_PATH } from '../profiles/organization-audit/v1/index.js';
import { SEMANTIC_LAYER_PROFILE_PATH } from '../profiles/semantic-layer/v1/index.js';

import { buildCorsHeaders, checkOrigin } from './http-response.js';
import { createStreamableHttpServer, startStreamableHttpServer } from './streamable-http.js';

const oauthConfig = makeTestMcpHttpConfig({
  port: 0,
  oauthClientId: 'client-id',
  validateToken: false,
  tokenValidationCacheTtlMs: 60_000,
});

const originalEnv = { ...process.env };

function clearMcpEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith('LIGHTDASH_TOOLS_MCP_') ||
      key.startsWith('LIGHTDASH_TOOLS_OAUTH_') ||
      key.startsWith('MCP_')
    ) {
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

  it('rejects obsolete AUTH_MODE in favor of credential inference', () => {
    process.env.NODE_ENV = 'production';
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';

    expect(() => loadMcpHttpConfig()).toThrow(/is removed/);
  });

  it('infers production OAuth from client credentials without CORS allowlist', () => {
    process.env.NODE_ENV = 'production';
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID] = 'id';
    process.env[ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET] = 'secret';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('lightdash-oauth');
  });

  it('rejects unauthenticated HTTP in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    expect(() => loadMcpHttpConfig()).toThrow(/not allowed in production/);
  });

  it('rejects browser origins when CORS allowlist is empty', () => {
    expect(checkOrigin('https://browser.example.com', [])).toBe(false);
    expect(buildCorsHeaders('https://browser.example.com', [])).toEqual({});
  });
});

describe('streamable HTTP OAuth metadata', () => {
  it('builds protected resource metadata with MCP host as authorization_servers', () => {
    const metadata = buildOAuthProtectedResourceMetadata(oauthConfig, SEMANTIC_LAYER_PROFILE_PATH);
    expect(metadata.authorization_servers).toEqual(['https://mcp.example.com']);
    expect(metadata.resource).toBe(`https://mcp.example.com${SEMANTIC_LAYER_PROFILE_PATH}`);
    expect(getAuthorizationServerMetadataUrl(metadata.authorization_servers[0])).toBe(
      'https://mcp.example.com/.well-known/oauth-authorization-server',
    );
  });

  it('builds organization-audit protected resource metadata', () => {
    const metadata = buildOAuthProtectedResourceMetadata(
      oauthConfig,
      ORGANIZATION_AUDIT_PROFILE_PATH,
    );
    expect(metadata.resource).toBe(`https://mcp.example.com${ORGANIZATION_AUDIT_PROFILE_PATH}`);
  });

  it('builds content-reader protected resource metadata', () => {
    const metadata = buildOAuthProtectedResourceMetadata(oauthConfig, CONTENT_READER_PROFILE_PATH);
    expect(metadata.resource).toBe(`https://mcp.example.com${CONTENT_READER_PROFILE_PATH}`);
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

  it('rejects HTTP startup when request-state key is missing in production', async () => {
    const savedVitest = process.env.VITEST;
    delete process.env.VITEST;
    process.env.NODE_ENV = 'production';
    delete process.env[ENV_LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY];

    await expect(createStreamableHttpServer(makeTestMcpHttpConfig({ port: 0 }))).rejects.toThrow(
      /LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY/,
    );

    if (savedVitest !== undefined) {
      process.env.VITEST = savedVitest;
    }
  });
});
