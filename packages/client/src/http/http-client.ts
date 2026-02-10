/**
 * HTTP client wrapper: rate limiter + axios + retry.
 * All requests go through the rate limiter; retry applies to 5xx and network errors.
 */

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import type { LightdashClientConfig } from '../config';
import type { ApiErrorPayload } from '../errors';
import { LightdashApiError } from '../errors';
import { RateLimiter } from './rate-limiter';
import { withRetry } from '../utils/retry';

/** Lightdash API success response shape. */
export interface ApiSuccessBody<T = unknown> {
  status: 'ok';
  results: T;
}

/** Lightdash API error response shape (body). */
export interface ApiErrorBody {
  status: 'error';
  error: ApiErrorPayload['error'];
}

function assertSuccess<T>(data: ApiSuccessBody<T> | ApiErrorBody): data is ApiSuccessBody<T> {
  return data.status === 'ok';
}

/**
 * HTTP client that wraps Axios with rate limiting and retry.
 */
export class HttpClient {
  constructor(
    private readonly axiosInstance: AxiosInstance,
    private readonly rateLimiter: RateLimiter,
    private readonly config: LightdashClientConfig,
  ) {}

  private async request<T>(method: Method, url: string, config?: AxiosRequestConfig): Promise<T> {
    const doRequest = () =>
      this.axiosInstance.request<ApiSuccessBody<T> | ApiErrorBody>({
        ...config,
        method,
        url,
      });

    const response = await this.rateLimiter.schedule(() => withRetry(doRequest, this.config.retry));

    const data = response.data;
    if (!assertSuccess(data)) {
      throw new LightdashApiError(
        data.error.statusCode,
        data.error,
        response.config,
        response as AxiosResponse<ApiErrorPayload>,
      );
    }
    return data.results;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('GET', url, config);
  }

  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('POST', url, { ...config, data: body });
  }

  async put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('PUT', url, { ...config, data: body });
  }

  async patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('PATCH', url, { ...config, data: body });
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('DELETE', url, config);
  }
}
