import { describe, it, expect } from 'vitest';
import { LightdashApiError, RateLimitError, NetworkError } from './errors';

describe('LightdashApiError', () => {
  it('should set name and message', () => {
    const err = new LightdashApiError(
      400,
      { name: 'BadRequest', statusCode: 400, message: 'Invalid input' },
      { method: 'POST', url: '/api' },
    );
    expect(err.name).toBe('LightdashApiError');
    expect(err.message).toBe('Invalid input');
    expect(err.statusCode).toBe(400);
  });

  it('should use default message when error.message is missing', () => {
    const err = new LightdashApiError(
      500,
      { name: 'InternalError', statusCode: 500 },
      { method: 'GET', url: '/' },
    );
    expect(err.message).toContain('500');
  });
});

describe('RateLimitError', () => {
  it('should store retryAfter', () => {
    const err = new RateLimitError(
      429,
      { name: 'TooManyRequests', statusCode: 429 },
      { url: '/' },
      undefined,
      120,
    );
    expect(err.retryAfter).toBe(120);
  });
});

describe('NetworkError', () => {
  it('should preserve originalError', () => {
    const original = new Error('fetch failed');
    const err = new NetworkError('Network error', original);
    expect(err.originalError).toBe(original);
  });
});
