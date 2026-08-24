import { describe, expect, it } from 'vitest';

import { InMemoryOAuthRateLimiter } from './oauth-rate-limit.js';

describe('InMemoryOAuthRateLimiter', () => {
  it('allows requests under the cap and then 429s', () => {
    const limiter = new InMemoryOAuthRateLimiter({
      windowMs: 60_000,
      maxRegister: 2,
      maxAuthorize: 10,
      maxToken: 10,
      maxConsent: 10,
    });
    expect(limiter.consume('register', '10.0.0.1')).toEqual({ ok: true });
    expect(limiter.consume('register', '10.0.0.1')).toEqual({ ok: true });
    const limited = limiter.consume('register', '10.0.0.1');
    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      expect(limited.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('isolates buckets by action and client key', () => {
    const limiter = new InMemoryOAuthRateLimiter({
      windowMs: 60_000,
      maxRegister: 1,
      maxAuthorize: 1,
      maxToken: 1,
      maxConsent: 1,
    });
    expect(limiter.consume('register', 'a').ok).toBe(true);
    expect(limiter.consume('register', 'b').ok).toBe(true);
    expect(limiter.consume('authorize', 'a').ok).toBe(true);
    expect(limiter.consume('register', 'a').ok).toBe(false);
  });
});
