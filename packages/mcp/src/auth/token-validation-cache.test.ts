import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenValidationCache } from './token-validation-cache.js';

describe('TokenValidationCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns cached value within TTL', () => {
    const cache = new TokenValidationCache<{ userUuid: string }>(30_000);
    cache.set('hash-a', { userUuid: 'user-a' });

    expect(cache.get('hash-a')).toEqual({ userUuid: 'user-a' });
    expect(cache.get('hash-b')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const cache = new TokenValidationCache<{ userUuid: string }>(1_000);
    cache.set('hash-a', { userUuid: 'user-a' });

    vi.advanceTimersByTime(999);
    expect(cache.get('hash-a')).toEqual({ userUuid: 'user-a' });

    vi.advanceTimersByTime(2);
    expect(cache.get('hash-a')).toBeUndefined();
  });

  it('delete removes cached entries immediately', () => {
    const cache = new TokenValidationCache<{ userUuid: string }>(30_000);
    cache.set('hash-a', { userUuid: 'user-a' });
    cache.delete('hash-a');
    expect(cache.get('hash-a')).toBeUndefined();
  });
});
