export type OAuthRateLimitAction = 'authorize' | 'consent' | 'register' | 'token';

export type OAuthRateLimitResult = { ok: false; retryAfterSec: number } | { ok: true };

export type OAuthRateLimiterLimits = {
  windowMs: number;
  maxRegister: number;
  maxAuthorize: number;
  maxToken: number;
  maxConsent: number;
};

export const DEFAULT_OAUTH_RATE_LIMITS: OAuthRateLimiterLimits = {
  windowMs: 60_000,
  maxRegister: 20,
  maxAuthorize: 60,
  maxToken: 60,
  maxConsent: 30,
};

type WindowCount = { count: number; resetAt: number };

/**
 * Process-local fixed-window limiter for OAuth broker endpoints.
 * Fail-open: unexpected errors allow the request (gateway limits remain the outer bound).
 */
export class InMemoryOAuthRateLimiter {
  private readonly windows = new Map<string, WindowCount>();
  private readonly limits: OAuthRateLimiterLimits;

  constructor(limits: Partial<OAuthRateLimiterLimits> = {}) {
    this.limits = { ...DEFAULT_OAUTH_RATE_LIMITS, ...limits };
  }

  consume(action: OAuthRateLimitAction, clientKey: string): OAuthRateLimitResult {
    try {
      return this.consumeWindow(action, clientKey);
    } catch {
      return { ok: true };
    }
  }

  private consumeWindow(action: OAuthRateLimitAction, clientKey: string): OAuthRateLimitResult {
    const max = this.maxFor(action);
    const key = `${action}:${clientKey}`;
    const now = Date.now();
    const current = this.windows.get(key);
    if (current === undefined || now >= current.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.limits.windowMs });
      return { ok: true };
    }
    if (current.count >= max) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }
    current.count += 1;
    return { ok: true };
  }

  private maxFor(action: OAuthRateLimitAction): number {
    switch (action) {
      case 'authorize':
        return this.limits.maxAuthorize;
      case 'consent':
        return this.limits.maxConsent;
      case 'register':
        return this.limits.maxRegister;
      case 'token':
        return this.limits.maxToken;
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  }
}

export function clientKeyFromRequest(remoteAddress: string | undefined): string {
  return remoteAddress && remoteAddress.length > 0 ? remoteAddress : 'unknown';
}
