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

  it('rejects non-oauth auth modes', () => {
    expect(() =>
      loadMcpHttpConfig({
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_TOOLS_MCP_AUTH_MODE: 'shared-key',
      }),
    ).toThrow(/lightdash-oauth/);
  });

  it('requires experimental flag in production', () => {
    expect(() =>
      loadMcpHttpConfig({
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_TOOLS_MCP_PUBLIC_URL: 'https://mcp.example.com',
        NODE_ENV: 'production',
      }),
    ).toThrow(/EXPERIMENTAL_IDENTITY_OAUTH/);
  });
});
