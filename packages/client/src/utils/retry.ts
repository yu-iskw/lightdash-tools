/**
 * Retry logic with exponential backoff for transient failures.
 * Retries on 5xx and network errors; no retry for 4xx (except 429 handled by rate limiter).
 */

import type { RetryConfig } from '../config';
import { DEFAULT_RETRY } from '../config';

export type RetryOptions = RetryConfig;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable (5xx or network/ECONNRESET/timeout).
 */
export function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { status?: number } }).response;
    if (res && typeof res.status === 'number') {
      return res.status >= 500;
    }
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const code = (error as Error & { code?: string }).code;
    return (
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('network') ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT'
    );
  }
  return false;
}

/**
 * Executes an async function with exponential backoff retries.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY.maxRetries;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY.retryDelay;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries || !isRetryableError(err)) {
        throw err;
      }
      const wait = retryDelay * Math.pow(2, attempt);
      await delay(wait);
    }
  }
  throw lastError;
}
