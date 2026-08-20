import type { AxiosRequestConfig } from 'axios';

import type { RetryConfig } from '../../../config';

/** Per-request overrides for AI agent thread operations. */
export interface RequestOptions {
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Optional correlation ID sent as `X-Request-Id`. */
  requestId?: string;
  /** Override the client retry policy for this request (HttpClient 4th argument). */
  retry?: RetryConfig;
}

/** Maps Axios-owned {@link RequestOptions} fields. `retry` is passed separately. */
export function toAxiosConfig(options?: RequestOptions): AxiosRequestConfig | undefined {
  if (!options) {
    return undefined;
  }

  const config: AxiosRequestConfig = {};

  if (options.signal !== undefined) {
    config.signal = options.signal;
  }
  if (options.timeoutMs !== undefined) {
    config.timeout = options.timeoutMs;
  }
  if (options.requestId !== undefined) {
    config.headers = { 'X-Request-Id': options.requestId };
  }

  return Object.keys(config).length > 0 ? config : undefined;
}
