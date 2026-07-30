import { describe, expect, it } from 'vitest';

import { loadMcpHttpConfig } from './load-http-config.js';

describe('loadMcpHttpConfig', () => {
  it('defaults auth mode to lightdash-oauth', () => {
    const config = loadMcpHttpConfig({
      LIGHTDASH_URL: 'https://app.lightdash.cloud',
      LIGHTDASH_TOOLS_MCP_PUBLIC_URL: 'https://mcp.example.com',
      LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH: '1',
      NODE_ENV: 'production',
    });
    expect(config.authMode).toBe('lightdash-oauth');
    expect(config.publicUrl).toBe('https://mcp.example.com');
    expect(config.scopesSupported).toEqual([]);
  });

  it('accepts authMode=none when LIGHTDASH_API_KEY is set', () => {
    const config = loadMcpHttpConfig({
      LIGHTDASH_URL: 'https://app.lightdash.cloud',
      LIGHTDASH_API_KEY: 'ldpat_test',
      LIGHTDASH_TOOLS_MCP_AUTH_MODE: 'none',
      LIGHTDASH_TOOLS_MCP_PUBLIC_URL: 'http://localhost:8080',
      NODE_ENV: 'development',
    });
    expect(config.authMode).toBe('none');
    expect(config.validateToken).toBe(false);
  });

  it('rejects authMode=none without LIGHTDASH_API_KEY', () => {
    expect(() =>
      loadMcpHttpConfig({
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_TOOLS_MCP_AUTH_MODE: 'none',
        NODE_ENV: 'development',
      }),
    ).toThrow(/LIGHTDASH_API_KEY/);
  });

  it('rejects authMode=none in production', () => {
    expect(() =>
      loadMcpHttpConfig({
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_API_KEY: 'ldpat_test',
        LIGHTDASH_TOOLS_MCP_AUTH_MODE: 'none',
        NODE_ENV: 'production',
      }),
    ).toThrow(/not allowed in production/);
  });

  it('rejects shared-key and other non-supported auth modes', () => {
    expect(() =>
      loadMcpHttpConfig({
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_TOOLS_MCP_AUTH_MODE: 'shared-key',
      }),
    ).toThrow(/none or lightdash-oauth/);
  });

  it('requires experimental flag in production for oauth', () => {
    expect(() =>
      loadMcpHttpConfig({
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_TOOLS_MCP_PUBLIC_URL: 'https://mcp.example.com',
        NODE_ENV: 'production',
      }),
    ).toThrow(/EXPERIMENTAL_IDENTITY_OAUTH/);
  });
});
