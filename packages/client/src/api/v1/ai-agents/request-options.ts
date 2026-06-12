import type { AxiosRequestConfig } from 'axios';

/** Per-request overrides for AI agent thread operations. */
export interface RequestOptions {
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Optional correlation ID sent as `X-Request-Id`. */
  requestId?: string;
}

/** Maps {@link RequestOptions} to Axios request config. */
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
