import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConfigFromEnv,
  mergeConfig,
  ENV_LIGHTDASH_API_KEY,
  ENV_LIGHTDASH_URL,
  ENV_LIGHTDASH_PROXY_AUTHORIZATION,
} from './env';

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env[ENV_LIGHTDASH_API_KEY];
  delete process.env[ENV_LIGHTDASH_URL];
  delete process.env[ENV_LIGHTDASH_PROXY_AUTHORIZATION];
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('loadConfigFromEnv', () => {
  it('should read LIGHTDASH_API_KEY', () => {
    process.env[ENV_LIGHTDASH_API_KEY] = 'my-token';
    const config = loadConfigFromEnv();
    expect(config.personalAccessToken).toBe('my-token');
  });

  it('should read LIGHTDASH_URL', () => {
    process.env[ENV_LIGHTDASH_URL] = 'https://app.lightdash.cloud';
    const config = loadConfigFromEnv();
    expect(config.baseUrl).toBe('https://app.lightdash.cloud');
  });

  it('should strip trailing slash from LIGHTDASH_URL in mergeConfig', () => {
    process.env[ENV_LIGHTDASH_URL] = 'https://app.lightdash.cloud/';
    const merged = mergeConfig({ personalAccessToken: 't' });
    expect(merged.baseUrl).toBe('https://app.lightdash.cloud');
  });

  it('should read LIGHTDASH_PROXY_AUTHORIZATION', () => {
    process.env[ENV_LIGHTDASH_PROXY_AUTHORIZATION] = 'Bearer proxy-token';
    const config = loadConfigFromEnv();
    expect(config.proxyAuthorization).toBe('Bearer proxy-token');
  });

  it('should not set keys for empty env values', () => {
    process.env[ENV_LIGHTDASH_API_KEY] = '';
    const config = loadConfigFromEnv();
    expect(config.personalAccessToken).toBeUndefined();
  });
});

describe('mergeConfig', () => {
  it('should prefer explicit config over env', () => {
    process.env[ENV_LIGHTDASH_URL] = 'https://env.example.com';
    process.env[ENV_LIGHTDASH_API_KEY] = 'env-token';
    const merged = mergeConfig({
      baseUrl: 'https://explicit.example.com',
      personalAccessToken: 'explicit-token',
    });
    expect(merged.baseUrl).toBe('https://explicit.example.com');
    expect(merged.personalAccessToken).toBe('explicit-token');
  });

  it('should use env when explicit config omits a field', () => {
    process.env[ENV_LIGHTDASH_URL] = 'https://env.example.com';
    process.env[ENV_LIGHTDASH_API_KEY] = 'env-token';
    const merged = mergeConfig({ baseUrl: 'https://explicit.example.com' });
    expect(merged.baseUrl).toBe('https://explicit.example.com');
    expect(merged.personalAccessToken).toBe('env-token');
  });

  it('should throw when baseUrl and personalAccessToken cannot be resolved', () => {
    expect(() => mergeConfig(undefined)).toThrow(/baseUrl and personalAccessToken/);
    expect(() => mergeConfig({})).toThrow();
  });
});
