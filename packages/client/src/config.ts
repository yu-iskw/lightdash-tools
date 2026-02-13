/**
 * Configuration types for the Lightdash HTTP client.
 * Supports explicit config and environment variables (LIGHTDASH_API_KEY, LIGHTDASH_URL, LIGHTDASH_PROXY_AUTHORIZATION).
 */

import type { SecretString } from './utils/secret-string';

/**
 * Rate limit configuration for Bottleneck (token bucket algorithm).
 */
export interface RateLimitConfig {
  /** Minimum time between requests in milliseconds (e.g. 100 = 10 req/sec max). */
  minTime?: number;
  /** Maximum concurrent requests. */
  maxConcurrent?: number;
  /** Token bucket size (burst capacity). */
  reservoir?: number;
  /** Token refresh interval in milliseconds. */
  reservoirRefreshInterval?: number;
  /** Number of tokens added per refresh. */
  reservoirRefreshAmount?: number;
}

/**
 * Retry configuration for transient failures.
 */
export interface RetryConfig {
  /** Maximum number of retries for 5xx and network errors. */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff. */
  retryDelay?: number;
}

/**
 * Logger interface for optional request/response logging.
 */
export interface Logger {
  debug?(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
  error?(message: string, ...args: unknown[]): void;
}

/**
 * Optional hooks for metrics/telemetry. Called after each request completes.
 */
export interface ObservabilityHooks {
  /** Called when a request completes (success or error). */
  onRequestComplete?(info: {
    method: string;
    url: string;
    statusCode?: number;
    durationMs: number;
    error?: Error;
  }): void;
}

/**
 * Full configuration for the Lightdash HTTP client.
 * All fields except rateLimit, timeout, retry, and logger can be provided via environment variables.
 */
export interface LightdashClientConfig {
  /** Lightdash server base URL (e.g. https://app.lightdash.cloud). */
  baseUrl: string;
  /** Personal access token for API authentication (without ldpat_ prefix). */
  personalAccessToken: SecretString;
  /** Optional proxy authorization header value for proxied access. */
  proxyAuthorization?: SecretString;
  /** Override default rate limits. */
  rateLimit?: RateLimitConfig;
  /** Request timeout in milliseconds. Default 30000. */
  timeout?: number;
  /** Retry behavior for transient failures. */
  retry?: RetryConfig;
  /** Optional logger for request/response logging. */
  logger?: Logger;
  /** Optional hooks for metrics/telemetry. */
  observability?: ObservabilityHooks;
}

/**
 * Partial config for merging with environment variables.
 * Used when constructing the client with optional explicit overrides.
 */
export type PartialLightdashClientConfig = Partial<
  Omit<LightdashClientConfig, 'personalAccessToken' | 'proxyAuthorization'>
> & {
  personalAccessToken?: string | SecretString;
  proxyAuthorization?: string | SecretString;
};

/** Default rate limit: 10 req/sec, 5 concurrent, token bucket. */
export const DEFAULT_RATE_LIMIT: Required<RateLimitConfig> = {
  minTime: 100,
  maxConcurrent: 5,
  reservoir: 100,
  reservoirRefreshInterval: 1000,
  reservoirRefreshAmount: 10,
};

/** Default request timeout in ms. */
export const DEFAULT_TIMEOUT = 30_000;

/** Default retry config. */
export const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
};
