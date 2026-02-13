import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LightdashClient,
  mergeConfig,
  loadConfigFromEnv,
  LightdashApiError,
  RateLimitError,
  NetworkError,
  ENV_LIGHTDASH_API_KEY,
  ENV_LIGHTDASH_URL,
  ENV_LIGHTDASH_PROXY_AUTHORIZATION,
  SecretString,
} from './index';

describe('LightdashClient', () => {
  beforeEach(() => {
    vi.stubEnv(ENV_LIGHTDASH_API_KEY, '');
    vi.stubEnv(ENV_LIGHTDASH_URL, '');
    vi.stubEnv(ENV_LIGHTDASH_PROXY_AUTHORIZATION, '');
  });

  it('should export LightdashClient', () => {
    expect(LightdashClient).toBeDefined();
  });

  it('should instantiate with explicit config', () => {
    const client = new LightdashClient({
      baseUrl: 'https://app.lightdash.cloud',
      personalAccessToken: 'test-token',
    });
    expect(client.getHttpClient()).toBeDefined();
  });

  it('should throw when baseUrl and personalAccessToken are missing and not in env', () => {
    expect(() => new LightdashClient({})).toThrow(
      /baseUrl and personalAccessToken|LIGHTDASH_URL and LIGHTDASH_API_KEY/,
    );
  });

  it('should merge explicit config with env (explicit wins)', () => {
    vi.stubEnv(ENV_LIGHTDASH_URL, 'https://env.example.com');
    vi.stubEnv(ENV_LIGHTDASH_API_KEY, 'env-token');

    const explicit = {
      baseUrl: 'https://custom.example.com',
      personalAccessToken: 'explicit-token',
    };
    const merged = mergeConfig(explicit);
    expect(merged.baseUrl).toBe('https://custom.example.com');
    expect(merged.personalAccessToken).toBeInstanceOf(SecretString);
    expect(merged.personalAccessToken.expose()).toBe('explicit-token');
  });
});

describe('mergeConfig', () => {
  beforeEach(() => {
    vi.stubEnv(ENV_LIGHTDASH_API_KEY, '');
    vi.stubEnv(ENV_LIGHTDASH_URL, '');
    vi.stubEnv(ENV_LIGHTDASH_PROXY_AUTHORIZATION, '');
  });

  it('should require baseUrl and personalAccessToken', () => {
    expect(() => mergeConfig({})).toThrow();
    expect(() => mergeConfig({ baseUrl: 'https://x.com' })).toThrow();
    expect(() => mergeConfig({ personalAccessToken: 't' })).toThrow();
  });
});

describe('loadConfigFromEnv', () => {
  beforeEach(() => {
    vi.stubEnv(ENV_LIGHTDASH_API_KEY, '');
    vi.stubEnv(ENV_LIGHTDASH_URL, '');
    vi.stubEnv(ENV_LIGHTDASH_PROXY_AUTHORIZATION, '');
  });

  it('should return empty object when env vars are not set', () => {
    const config = loadConfigFromEnv();
    expect(config).toEqual({});
  });
});

describe('LightdashApiError', () => {
  it('should have statusCode and error payload', () => {
    const err = new LightdashApiError(
      404,
      { name: 'NotFound', statusCode: 404, message: 'Not found' },
      { url: '/test', method: 'GET' },
    );
    expect(err.name).toBe('LightdashApiError');
    expect(err.statusCode).toBe(404);
    expect(err.error.name).toBe('NotFound');
    expect(err.message).toContain('Not found');
  });
});

describe('RateLimitError', () => {
  it('should extend LightdashApiError and have retryAfter', () => {
    const err = new RateLimitError(
      429,
      { name: 'TooManyRequests', statusCode: 429 },
      { url: '/test', method: 'GET' },
      undefined,
      60,
    );
    expect(err).toBeInstanceOf(LightdashApiError);
    expect(err.retryAfter).toBe(60);
  });
});

describe('NetworkError', () => {
  it('should wrap original error', () => {
    const original = new Error('ECONNRESET');
    const err = new NetworkError('Connection reset', original);
    expect(err.originalError).toBe(original);
    expect(err.message).toBe('Connection reset');
  });
});
