import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getClient } from './client';

describe('getClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create a client instance', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.LIGHTDASH_API_KEY = 'test-token';

    const client = getClient();
    expect(client).toBeDefined();
    expect(client.v1).toBeDefined();
  });

  it('should throw error when LIGHTDASH_URL is missing', () => {
    delete process.env.LIGHTDASH_URL;
    process.env.LIGHTDASH_API_KEY = 'test-token';

    expect(() => getClient()).toThrow();
  });

  it('should throw error when LIGHTDASH_API_KEY is missing', () => {
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    delete process.env.LIGHTDASH_API_KEY;

    expect(() => getClient()).toThrow();
  });
});
