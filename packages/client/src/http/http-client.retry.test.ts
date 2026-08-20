import { describe, expect, it, vi } from 'vitest';

import { HttpClient } from './http-client.js';

import type { ResolvedLightdashClientConfig, RetryConfig } from '../config.js';
import type { RateLimiter } from './rate-limiter.js';
import type { AxiosInstance } from 'axios';

describe('HttpClient per-request retry argument', () => {
  function makeClient(requestImpl: ReturnType<typeof vi.fn>, retry: RetryConfig) {
    const axiosInstance = { request: requestImpl } as unknown as AxiosInstance;
    const rateLimiter = {
      schedule: <T>(fn: () => Promise<T>) => fn(),
    } as unknown as RateLimiter;
    const config = {
      baseUrl: 'https://app.lightdash.com',
      timeout: 30_000,
      retry,
    } as unknown as ResolvedLightdashClientConfig;
    return new HttpClient(axiosInstance, rateLimiter, config);
  }

  it('does not retry 5xx when retry.maxRetries is 0', async () => {
    const requestImpl = vi.fn().mockRejectedValue({ response: { status: 500 } });
    const client = makeClient(requestImpl, { maxRetries: 3, retryDelay: 1 });
    await expect(
      client.post('/generate', undefined, undefined, { maxRetries: 0 }),
    ).rejects.toMatchObject({ response: { status: 500 } });
    expect(requestImpl).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx when no per-request retry argument is set', async () => {
    const requestImpl = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValue({
        status: 200,
        data: { status: 'ok', results: { id: 'ok' } },
        config: {},
      });
    const client = makeClient(requestImpl, { maxRetries: 1, retryDelay: 1 });
    await expect(client.get('/x')).resolves.toEqual({ id: 'ok' });
    expect(requestImpl).toHaveBeenCalledTimes(2);
  });
});
