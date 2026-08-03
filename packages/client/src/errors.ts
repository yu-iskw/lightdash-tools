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

/**
 * Thrown when a binary download exceeds the configured byte limit.
 */
export class BinarySizeLimitError extends Error {
  readonly code = 'PAYLOAD_TOO_LARGE' as const;

  constructor(
    public readonly maxBytes: number,
    public readonly byteLength?: number,
  ) {
    super(
      byteLength === undefined
        ? `Binary payload exceeds size limit (≥ ${maxBytes} bytes)`
        : `Binary payload exceeds size limit (${byteLength} > ${maxBytes} bytes)`,
    );
    this.name = 'BinarySizeLimitError';
    Object.setPrototypeOf(this, BinarySizeLimitError.prototype);
  }
}

/**
 * Thrown when a chart PNG export exceeds the configured byte limit.
 */
export class ChartImageSizeError extends Error {
  readonly code = 'IMAGE_TOO_LARGE' as const;

  constructor(
    public readonly maxBytes: number,
    public readonly byteLength?: number,
  ) {
    super(
      byteLength === undefined
        ? `Chart image exceeds size limit (≥ ${maxBytes} bytes)`
        : `Chart image exceeds size limit (${byteLength} > ${maxBytes} bytes)`,
    );
    this.name = 'ChartImageSizeError';
    Object.setPrototypeOf(this, ChartImageSizeError.prototype);
  }
}
