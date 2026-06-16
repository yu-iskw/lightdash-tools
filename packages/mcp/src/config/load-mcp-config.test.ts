import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION,
  ENV_LIGHTDASH_TOOLS_MCP_PATH,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY,
  ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN,
} from './env.js';
import { emitMcpHttpSecurityWarnings, loadMcpHttpConfig } from './load-mcp-config.js';

const originalEnv = { ...process.env };

function clearMcpEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('LIGHTDASH_TOOLS_MCP_') || key.startsWith('MCP_')) {
      delete process.env[key];
    }
  }
  delete process.env.LIGHTDASH_URL;
  delete process.env.LIGHTDASH_API_KEY;
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

    const config = loadMcpHttpConfig();
    expect(config.port).toBe(3200);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('warns when legacy MCP_HTTP_PORT is used', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.MCP_HTTP_PORT = '3100';

    const config = loadMcpHttpConfig();
    expect(config.port).toBe(3100);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('MCP_HTTP_PORT is deprecated'),
    );
  });

  it('maps MCP_AUTH_ENABLED to shared-key auth mode', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.MCP_AUTH_ENABLED = '1';
    process.env.MCP_API_KEY = 'secret';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('shared-key');
    expect(config.sharedKey?.expose()).toBe('secret');
  });

  it('requires public URL for lightdash-oauth mode', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL);
  });

  it('loads lightdash-oauth config when public URL is set', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud/';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com/mcp/';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('lightdash-oauth');
    expect(config.publicUrl).toBe('https://mcp.example.com');
    expect(config.lightdashUrl).toBe('https://app.lightdash.cloud');
    expect(config.validateToken).toBe(true);
    expect(config.scopesSupported).toEqual([]);
  });

  it('rejects required scopes for lightdash-oauth mode at startup', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES] = 'mcp:read';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES);
  });

  it('keeps default scopes for shared-key mode', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.MCP_AUTH_ENABLED = '1';
    process.env.MCP_API_KEY = 'secret';

    const config = loadMcpHttpConfig();
    expect(config.scopesSupported).toEqual(['read', 'write', 'mcp:read', 'mcp:write']);
  });

  it('rejects non-HTTPS public URL in lightdash-oauth mode', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'http://mcp.example.com';

    expect(() => loadMcpHttpConfig()).toThrow(/must use https:\/\//);
  });

  it('allows local HTTP public URL without insecure flag', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'http://127.0.0.1:3100';

    const config = loadMcpHttpConfig();
    expect(config.publicUrl).toBe('http://127.0.0.1:3100');
  });

  it('rejects deceptive localhost hostnames for public URL', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'http://localhost.evil.example';

    expect(() => loadMcpHttpConfig()).toThrow(/must use https:\/\//);
  });

  it('rejects deceptive loopback hostnames for public URL', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'http://127.0.0.1.evil.example';

    expect(() => loadMcpHttpConfig()).toThrow(/must use https:\/\//);
  });

  it('allows insecure public URL when explicitly opted in', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'http://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL] = '1';

    const config = loadMcpHttpConfig();
    expect(config.publicUrl).toBe('http://mcp.example.com');
  });

  it('requires shared key when auth mode is shared-key', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'shared-key';

    expect(() => loadMcpHttpConfig()).toThrow(ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY);
  });

  it('throws on invalid auth mode with descriptive message', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'not-a-mode';

    expect(() => loadMcpHttpConfig()).toThrow(/Invalid LIGHTDASH_TOOLS_MCP_AUTH_MODE/);
  });

  it('throws on non-numeric port values', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.LIGHTDASH_TOOLS_MCP_HTTP_PORT = 'not-a-number';

    expect(() => loadMcpHttpConfig()).toThrow(/Invalid LIGHTDASH_TOOLS_MCP_HTTP_PORT/);
  });

  it('rejects invalid VALIDATE_TOKEN boolean literals', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN] = 'True';

    expect(() => loadMcpHttpConfig()).toThrow(/Invalid LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN/);
  });

  it('allows explicit false to disable token validation in development', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN] = 'false';
    process.env.NODE_ENV = 'development';

    const config = loadMcpHttpConfig();
    expect(config.validateToken).toBe(false);
  });

  it('rejects VALIDATE_TOKEN=false in production without dangerous flag', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN] = 'false';
    process.env.NODE_ENV = 'production';
    delete process.env[ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION];

    expect(() => loadMcpHttpConfig()).toThrow(/not allowed in production/);
  });

  it('allows VALIDATE_TOKEN=false in production with dangerous flag', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN] = 'false';
    process.env.NODE_ENV = 'production';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION] = '1';

    const config = loadMcpHttpConfig();
    expect(config.validateToken).toBe(false);
  });

  it('emitMcpHttpSecurityWarnings warns for empty CORS allowlist', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com';

    const config = loadMcpHttpConfig();
    emitMcpHttpSecurityWarnings(config);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ALLOWED_ORIGINS'));
  });

  it('reads config from an explicit env object instead of process.env', () => {
    process.env.MCP_HTTP_PORT = '9999';

    const env = {
      LIGHTDASH_URL: 'https://app.lightdash.cloud',
      [ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE]: 'shared-key',
      [ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY]: 'secret',
      LIGHTDASH_TOOLS_MCP_HTTP_PORT: '3200',
    } as NodeJS.ProcessEnv;

    const config = loadMcpHttpConfig(env);
    expect(config.authMode).toBe('shared-key');
    expect(config.port).toBe(3200);
  });

  it('normalizes MCP path values', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PATH] = 'mcp/';

    const config = loadMcpHttpConfig();
    expect(config.mcpPath).toBe('/mcp');
  });

  it('strips configured mcpPath suffix from public URL', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL] = 'https://mcp.example.com/custom/mcp';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_PATH] = '/custom/mcp';

    const config = loadMcpHttpConfig();
    expect(config.publicUrl).toBe('https://mcp.example.com');
    expect(config.mcpPath).toBe('/custom/mcp');
  });

  it('rejects grant-all-scopes override in production', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.NODE_ENV = 'production';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES] = '1';

    expect(() => loadMcpHttpConfig()).toThrow(/not allowed in production/);
  });

  it('rejects authMode=none in production without dangerous flag', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.NODE_ENV = 'production';

    expect(() => loadMcpHttpConfig()).toThrow(/not allowed in production/);
  });

  it('allows authMode=none in production with dangerous flag', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.NODE_ENV = 'production';
    process.env[ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED] = '1';

    const config = loadMcpHttpConfig();
    expect(config.authMode).toBe('none');
  });
});
