/**
 * Unit tests for HttpClient success-envelope harden.
 */

import { describe, expect, it, vi } from 'vitest';

import { CONTRACT_ERROR_MESSAGE, CONTRACT_ERROR_NAME, LightdashApiError } from '../errors.js';

import { HttpClient } from './http-client.js';

import type { ResolvedLightdashClientConfig } from '../config.js';
import type { RateLimiter } from './rate-limiter.js';
import type { AxiosInstance } from 'axios';

describe('HttpClient envelope harden', () => {
  function makeClient(requestImpl: ReturnType<typeof vi.fn>) {
    const axiosInstance = { request: requestImpl } as unknown as AxiosInstance;
    const rateLimiter = {
      schedule: <T>(fn: () => Promise<T>) => fn(),
    } as unknown as RateLimiter;
    const config = {
      baseUrl: 'https://app.lightdash.com',
      timeout: 30_000,
      retry: { maxRetries: 0 },
    } as unknown as ResolvedLightdashClientConfig;
    return new HttpClient(axiosInstance, rateLimiter, config);
  }

  it('returns results for ok envelopes', async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        status: 200,
        data: { status: 'ok', results: { id: '1' } },
        config: {},
      }),
    );
    await expect(client.get('/x')).resolves.toEqual({ id: '1' });
  });

  it('throws LightdashApiError for error envelopes', async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        status: 200,
        data: {
          status: 'error',
          error: { name: 'Bad', statusCode: 400, message: 'nope' },
        },
        config: {},
      }),
    );
    await expect(client.get('/x')).rejects.toMatchObject({
      statusCode: 400,
      error: { message: 'nope' },
    });
  });

  it('throws ContractError for malformed 200 bodies', async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        status: 200,
        data: { foo: 1 },
        config: {},
      }),
    );
    await expect(client.get('/x')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(LightdashApiError);
      const apiErr = err as LightdashApiError;
      expect(apiErr.statusCode).toBe(502);
      expect(apiErr.error.name).toBe(CONTRACT_ERROR_NAME);
      expect(apiErr.error.message).toBe(CONTRACT_ERROR_MESSAGE);
      return true;
    });
  });
});
