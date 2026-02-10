import { describe, it, expect, vi } from 'vitest';
import { withRetry, isRetryableError } from './retry';

describe('isRetryableError', () => {
  it('should return true for 5xx response', () => {
    expect(isRetryableError({ response: { status: 500 } })).toBe(true);
    expect(isRetryableError({ response: { status: 503 } })).toBe(true);
  });

  it('should return false for 4xx response', () => {
    expect(isRetryableError({ response: { status: 400 } })).toBe(false);
    expect(isRetryableError({ response: { status: 404 } })).toBe(false);
  });

  it('should return true for network-like errors', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBe(true);
  });

  it('should return false for generic Error', () => {
    expect(isRetryableError(new Error('something else'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error then succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' }))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { maxRetries: 2, retryDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue({ response: { status: 400 } });
    await expect(withRetry(fn)).rejects.toMatchObject({ response: { status: 400 } });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
