import { afterEach, describe, expect, it } from 'vitest';

import { emitEphemeralStoreHttpWarning, resolveEphemeralStoreConfig } from './config.js';

describe('resolveEphemeralStoreConfig', () => {
  const originalStore = process.env.LIGHTDASH_TOOLS_MCP_STORE;
  const originalRedis = process.env.LIGHTDASH_TOOLS_MCP_REDIS_URL;

  afterEach(() => {
    if (originalStore === undefined) {
      delete process.env.LIGHTDASH_TOOLS_MCP_STORE;
    } else {
      process.env.LIGHTDASH_TOOLS_MCP_STORE = originalStore;
    }
    if (originalRedis === undefined) {
      delete process.env.LIGHTDASH_TOOLS_MCP_REDIS_URL;
    } else {
      process.env.LIGHTDASH_TOOLS_MCP_REDIS_URL = originalRedis;
    }
  });

  it('defaults to memory', () => {
    expect(resolveEphemeralStoreConfig({})).toEqual({ backend: 'memory' });
  });

  it('accepts explicit memory', () => {
    expect(resolveEphemeralStoreConfig({ LIGHTDASH_TOOLS_MCP_STORE: 'memory' })).toEqual({
      backend: 'memory',
    });
  });

  it('requires REDIS_URL when store=redis', () => {
    expect(() => resolveEphemeralStoreConfig({ LIGHTDASH_TOOLS_MCP_STORE: 'redis' })).toThrow(
      /LIGHTDASH_TOOLS_MCP_REDIS_URL/,
    );
  });

  it('returns redis config when URL is set', () => {
    expect(
      resolveEphemeralStoreConfig({
        LIGHTDASH_TOOLS_MCP_STORE: 'redis',
        LIGHTDASH_TOOLS_MCP_REDIS_URL: 'redis://localhost:6379',
      }),
    ).toEqual({ backend: 'redis', redisUrl: 'redis://localhost:6379' });
  });

  it('rejects unknown store values', () => {
    expect(() => resolveEphemeralStoreConfig({ LIGHTDASH_TOOLS_MCP_STORE: 'postgres' })).toThrow(
      /memory' or 'redis/,
    );
  });

  it('emitEphemeralStoreHttpWarning warns for memory', () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (msg: string) => {
      warnings.push(msg);
    };
    try {
      emitEphemeralStoreHttpWarning({ backend: 'memory' });
      expect(warnings.some((w) => w.includes('in-memory'))).toBe(true);
    } finally {
      console.warn = original;
    }
  });
});
