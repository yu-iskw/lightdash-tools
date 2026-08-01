/**
 * HTTP client wrapper: rate limiter + axios + retry.
 * All requests go through the rate limiter; retry applies to 5xx and network errors.
 */

import { type ApiErrorPayload, LightdashApiError } from '../errors';
import { withRetry } from '../utils/retry';

import { type RateLimiter } from './rate-limiter';
import { isApiSuccessEnvelope, type ApiEnvelope } from './unwrap-api-success';

import type { ResolvedLightdashClientConfig } from '../config';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';

/** Lightdash API success response shape. */
export type { ApiSuccessEnvelope as ApiSuccessBody } from './unwrap-api-success';
export type { ApiErrorEnvelope as ApiErrorBody } from './unwrap-api-success';

/**
 * HTTP client that wraps Axios with rate limiting and retry.
 */
export class HttpClient {
  constructor(
    private readonly axiosInstance: AxiosInstance,
    private readonly rateLimiter: RateLimiter,
    private readonly config: ResolvedLightdashClientConfig,
  ) {}

  private async request<T>(method: Method, url: string, config?: AxiosRequestConfig): Promise<T> {
    const doRequest = () =>
      this.axiosInstance.request<ApiEnvelope<T>>({
        ...config,
        method,
        url,
      });

    const response = await this.rateLimiter.schedule(() => withRetry(doRequest, this.config.retry));

    const data = response.data;
    if (!isApiSuccessEnvelope(data)) {
      throw new LightdashApiError(
        data.error.statusCode,
        data.error as ApiErrorPayload['error'],
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
