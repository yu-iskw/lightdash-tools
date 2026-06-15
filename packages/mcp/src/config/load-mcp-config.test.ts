import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY,
} from './env.js';
import { loadMcpHttpConfig } from './load-mcp-config.js';

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
});
