/**
 * Unit tests for binary download URL guards and getBytes error mapping.
 */

import { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { assertSafeBinaryFetchUrl, HttpClient, isBlockedBinaryHostname } from './http-client.js';

import type { ResolvedLightdashClientConfig } from '../config.js';
import type { AxiosInstance } from 'axios';
import type { RateLimiter } from './rate-limiter.js';

describe('isBlockedBinaryHostname', () => {
  it('blocks loopback and private IPv4 hosts', () => {
    expect(isBlockedBinaryHostname('localhost')).toBe(true);
    expect(isBlockedBinaryHostname('127.0.0.1')).toBe(true);
    expect(isBlockedBinaryHostname('10.0.0.1')).toBe(true);
    expect(isBlockedBinaryHostname('192.168.1.1')).toBe(true);
    expect(isBlockedBinaryHostname('172.16.0.1')).toBe(true);
    expect(isBlockedBinaryHostname('169.254.169.254')).toBe(true);
    expect(isBlockedBinaryHostname('metadata.google.internal')).toBe(true);
  });

  it('allows public hostnames', () => {
    expect(isBlockedBinaryHostname('cdn.example.com')).toBe(false);
    expect(isBlockedBinaryHostname('s3.amazonaws.com')).toBe(false);
  });
});

describe('assertSafeBinaryFetchUrl', () => {
  it('rejects same-host HTTPS to HTTP downgrades', () => {
    expect(() =>
      assertSafeBinaryFetchUrl(
        'http://app.lightdash.com/export/chart.png',
        'https://app.lightdash.com',
      ),
    ).toThrow(/must not downgrade HTTPS to HTTP/);
  });

  it('allows same-host HTTPS URLs', () => {
    expect(() =>
      assertSafeBinaryFetchUrl(
        'https://app.lightdash.com/export/chart.png',
        'https://app.lightdash.com',
      ),
    ).not.toThrow();
  });

  it('allows relative URLs without validation', () => {
    expect(() =>
      assertSafeBinaryFetchUrl('/api/v1/export.png', 'https://app.lightdash.com'),
    ).not.toThrow();
  });
});

describe('HttpClient.getBytes', () => {
  function makeClient(getImpl: ReturnType<typeof vi.fn>) {
    const axiosInstance = { get: getImpl } as unknown as AxiosInstance;
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

  it('maps axios maxContentLength errors to BinarySizeLimitError', async () => {
    const maxBytes = 1024;
    const axiosError = new AxiosError('maxContentLength size of 1024 exceeded');
    const client = makeClient(vi.fn().mockRejectedValue(axiosError));

    await expect(client.getBytes('/chart.png', { maxBytes })).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      maxBytes,
    });
  });

  it('rejects same-host HTTP downgrade before fetching', async () => {
    const client = makeClient(vi.fn());
    await expect(client.getBytes('http://app.lightdash.com/chart.png')).rejects.toThrow(
      /must not downgrade HTTPS to HTTP/,
    );
  });
});
