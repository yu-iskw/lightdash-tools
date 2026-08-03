import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS,
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH,
  ENV_LIGHTDASH_TOOLS_MCP_INSECURE_DEV,
  ENV_LIGHTDASH_TOOLS_MCP_PATH,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED,
  ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY,
  ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET,
} from './env.js';
import {
  emitMcpHttpSecurityWarnings,
  getOAuthCallbackUrl,
  loadMcpHttpConfig,
} from './load-mcp-config.js';

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
  delete process.env.LIGHTDASH_API_KEY;
}

function setOAuthCreds(): void {
  process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
  process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
  process.env[ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID] = 'client-id';
  process.env[ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET] = 'client-secret';
}

beforeEach(() => {
  clearMcpEnv();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('loadMcpHttpConfig', () => {
  it('prefers LIGHTDASH_TOOLS_MCP_HTTP_PORT over MCP_HTTP_PORT', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.LIGHTDASH_TOOLS_MCP_HTTP_PORT = '3200';
    process.env.MCP_HTTP_PORT = '3100';
    process.env.NODE_ENV = 'development';

    const config = loadMcpHttpConfig();
    expect(config.port).toBe(3200);
  });

  it('infers OAuth when client id, secret, and public URL are set', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] =
      'https://mcp.example.com/semantic-layer/v1/mcp/';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('lightdash-oauth');
    expect(config.publicUrl).toBe('https://mcp.example.com');
    expect(config.oauthClientId).toBe('client-id');
    expect(config.oauthClientSecret?.expose()).toBe('client-secret');
    expect(getOAuthCallbackUrl(config)).toBe('https://mcp.example.com/oauth/callback');
    expect(config.scopesSupported).toEqual([]);
  });

  it('strips organization-audit persona path from public URL', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] =
      'https://mcp.example.com/organization-audit/v1/mcp';

    const config = loadMcpHttpConfig();
    expect(config.publicUrl).toBe('https://mcp.example.com');
  });

  it('strips content-reader persona path from public URL', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] =
      'https://mcp.example.com/content-reader/v1/mcp';

    const config = loadMcpHttpConfig();
    expect(config.publicUrl).toBe('https://mcp.example.com');
  });

  it('requires both OAuth client id and secret together', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID] = 'client-id';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET);
  });

  it('requires public URL when OAuth credentials are set', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID] = 'client-id';
    process.env[ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET] = 'client-secret';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL);
  });

  it('infers shared-key when SHARED_KEY is set', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY] = 'secret';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('shared-key');
    expect(config.sharedKey?.expose()).toBe('secret');
  });

  it('maps MCP_AUTH_ENABLED + MCP_API_KEY to shared-key', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.MCP_AUTH_ENABLED = '1';
    process.env.MCP_API_KEY = 'secret';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('shared-key');
    expect(config.sharedKey?.expose()).toBe('secret');
  });

  it('rejects obsolete AUTH_MODE env', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';

    expect(() => loadMcpHttpConfig()).toThrow(/is removed/);
  });

  it('rejects obsolete STDIO_PERSONA env', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.LIGHTDASH_TOOLS_MCP_STDIO_PERSONA = 'semantic-layer';

    expect(() => loadMcpHttpConfig()).toThrow(/ADR-0021/);
  });

  it('rejects obsolete EXPERIMENTAL_IDENTITY_OAUTH env', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH] = '1';

    expect(() => loadMcpHttpConfig()).toThrow(/is removed/);
  });

  it('rejects required scopes in OAuth mode', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES] = 'mcp:read';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES);
  });

  it('rejects scopes_supported in OAuth mode', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED] = 'mcp:read';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED);
  });

  it('rejects unauthenticated HTTP in production', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.NODE_ENV = 'production';

    expect(() => loadMcpHttpConfig()).toThrow(/not allowed in production/);
  });

  it('allows unauthenticated HTTP when NODE_ENV is development', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.NODE_ENV = 'development';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('none');
  });

  it('rejects obsolete INSECURE_DEV env', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.NODE_ENV = 'development';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_INSECURE_DEV] = '1';

    expect(() => loadMcpHttpConfig()).toThrow(/is removed/);
  });

  it('rejects non-HTTPS public URL in OAuth mode', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'http://mcp.example.com';

    expect(() => loadMcpHttpConfig()).toThrow(/must use https:\/\//);
  });

  it('allows local HTTP public URL without insecure flag', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'http://127.0.0.1:3100';

    const config = loadMcpHttpConfig();
    expect(config.publicUrl).toBe('http://127.0.0.1:3100');
  });

  it('rejects VALIDATE_TOKEN=false in production', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN] = 'false';
    process.env.NODE_ENV = 'production';

    expect(() => loadMcpHttpConfig()).toThrow(/not allowed in production/);
  });

  it('allows VALIDATE_TOKEN=false in development', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN] = 'false';
    process.env.NODE_ENV = 'development';

    const config = loadMcpHttpConfig();
    expect(config.validateToken).toBe(false);
  });

  it('rejects LIGHTDASH_TOOLS_MCP_PATH', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.NODE_ENV = 'development';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PATH] = '/ignored';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_PATH);
  });

  it('emitMcpHttpSecurityWarnings mentions callback registration for OAuth', () => {
    setOAuthCreds();
    const config = loadMcpHttpConfig();
    emitMcpHttpSecurityWarnings(config);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('/oauth/callback'));
  });

  it('emitMcpHttpSecurityWarnings warns when PUBLIC_URL is ngrok Free', () => {
    setOAuthCreds();
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://abc.ngrok-free.app';
    const config = loadMcpHttpConfig();
    emitMcpHttpSecurityWarnings(config);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ngrok Free'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Cloudflare Tunnel'));
  });

  it('reads config from an explicit env object', () => {
    const env = {
      LIGHTDASH_URL: 'https://app.lightdash.cloud',
      [ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY]: 'secret',
      LIGHTDASH_TOOLS_MCP_HTTP_PORT: '3200',
    } as NodeJS.ProcessEnv;

    const config = loadMcpHttpConfig(env);
    expect(config.authMode).toBe('shared-key');
    expect(config.port).toBe(3200);
  });

  it('keeps default scopes for shared-key mode', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY] = 'secret';

    const config = loadMcpHttpConfig();
    expect(config.scopesSupported).toEqual(['read', 'write', 'mcp:read', 'mcp:write']);
  });

  it('does not require ALLOWED_ORIGINS for production OAuth (non-browser agents)', () => {
    setOAuthCreds();
    process.env.NODE_ENV = 'production';
    delete process.env[ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS];

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('lightdash-oauth');
    expect(config.allowedOrigins).toEqual([]);
  });
});
