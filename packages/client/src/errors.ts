/**
 * Error types for the Lightdash HTTP client.
 */

import type { AxiosRequestConfig, AxiosResponse } from 'axios';

/** API error payload shape (from Lightdash ApiErrorPayload). */
export interface ApiErrorPayload {
  error: {
    name: string;
    statusCode: number;
    message?: string;
    data?: unknown;
  };
  status: 'error';
}

/**
 * Base error for Lightdash API failures.
 */
export class LightdashApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: ApiErrorPayload['error'],
    public readonly request: AxiosRequestConfig,
    public readonly response?: AxiosResponse<ApiErrorPayload>,
  ) {
    super(error.message ?? `Lightdash API error: ${statusCode}`);
    this.name = 'LightdashApiError';
    Object.setPrototypeOf(this, LightdashApiError.prototype);
  }
}

/**
 * Error when the API returns 429 Too Many Requests.
 */
export class RateLimitError extends LightdashApiError {
  /** Seconds to wait before retrying (from Retry-After header if present). */
  public readonly retryAfter?: number;

  constructor(
    statusCode: number,
    error: ApiErrorPayload['error'],
    request: AxiosRequestConfig,
    response?: AxiosResponse<ApiErrorPayload>,
    retryAfter?: number,
  ) {
    super(statusCode, error, request, response);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Wrapper for network/connection errors.
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
  ) {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
