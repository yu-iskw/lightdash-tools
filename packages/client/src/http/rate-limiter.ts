/**
 * Rate limiter wrapping Bottleneck for centralized request throttling.
 * Uses token bucket algorithm; handles 429 retries via Bottleneck options.
 */

import Bottleneck from 'bottleneck';
import type { RateLimitConfig } from '../config';
import { DEFAULT_RATE_LIMIT } from '../config';

export type RateLimiterOptions = RateLimitConfig;

/**
 * Wraps Bottleneck to provide configurable rate limiting for API requests.
 */
export class RateLimiter {
  private readonly limiter: Bottleneck;

  constructor(options: RateLimiterOptions = {}) {
    const minTime = options.minTime ?? DEFAULT_RATE_LIMIT.minTime;
    const maxConcurrent = options.maxConcurrent ?? DEFAULT_RATE_LIMIT.maxConcurrent;
    const reservoir = options.reservoir ?? DEFAULT_RATE_LIMIT.reservoir;
    const reservoirRefreshInterval =
      options.reservoirRefreshInterval ?? DEFAULT_RATE_LIMIT.reservoirRefreshInterval;
    const reservoirRefreshAmount =
      options.reservoirRefreshAmount ?? DEFAULT_RATE_LIMIT.reservoirRefreshAmount;

    this.limiter = new Bottleneck({
      minTime,
      maxConcurrent,
      reservoir,
      reservoirRefreshInterval,
      reservoirRefreshAmount,
    });
  }

  /**
   * Schedules a function to run when the rate limit allows.
   */
  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(fn);
  }

  /**
   * Wraps an async function so that each call goes through the rate limiter.
   */
  wrap<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R> {
    return (...args: T) => this.limiter.schedule(() => fn(...args));
  }

  /** Stops the limiter and drains remaining jobs. */
  async disconnect(): Promise<void> {
    return this.limiter.disconnect(true);
  }
}
