/**
 * HTTP client wrapper: rate limiter + axios + retry.
 * All requests go through the rate limiter; retry applies to 5xx and network errors.
 */

import axios from 'axios';

import { DEFAULT_TIMEOUT } from '../config';
import {
  type ApiErrorPayload,
  BinarySizeLimitError,
  CONTRACT_ERROR_MESSAGE,
  CONTRACT_ERROR_NAME,
  LightdashApiError,
  NetworkError,
} from '../errors';
import { withRetry } from '../utils/retry';

import { type RateLimiter } from './rate-limiter';
import { isApiSuccessEnvelope, type ApiEnvelope } from './unwrap-api-success';

import type { ResolvedLightdashClientConfig } from '../config';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';

/** Default max raw bytes for chart PNG downloads (8 MiB). */
export const DEFAULT_BINARY_MAX_BYTES = 8 * 1024 * 1024;

export type GetBytesOptions = {
  /** Hard cap on response body size in bytes. */
  maxBytes?: number;
  /** Per-request timeout override (ms). */
  timeout?: number;
};

export type GetBytesResult = {
  bytes: Buffer;
  mimeType: string;
};

function isPrivateIpv4Octets(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return a === 172 && b >= 16 && b <= 31;
}

function isBlockedIpv6Host(host: string): boolean {
  if (host === '::1' || host.startsWith('fe80:')) {
    return true;
  }
  // Unique-local IPv6 (fc00::/7)
  return host.startsWith('fc') || host.startsWith('fd');
}

function isAxiosMaxContentLengthError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false;
  }
  if (typeof err.message !== 'string') {
    return false;
  }
  return err.message.includes('maxContentLength') || err.message.includes('maxBodyLength');
}

/** True when hostname is loopback, link-local, or RFC1918 (cross-host SSRF guard). */
export function isBlockedBinaryHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === 'metadata.google.internal') {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4 && isPrivateIpv4Octets(Number(ipv4[1]), Number(ipv4[2]))) {
    return true;
  }
  return isBlockedIpv6Host(host);
}

/** Reject unsafe absolute binary download URLs (exported for unit tests). */
export function assertSafeBinaryFetchUrl(url: string, baseUrl: string): void {
  if (!/^https?:\/\//i.test(url)) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new NetworkError(
      'Invalid binary download URL',
      err instanceof Error ? err : new Error(String(err)),
    );
  }
  const base = new URL(baseUrl);
  if (parsed.host === base.host && parsed.protocol === 'http:' && base.protocol === 'https:') {
    throw new NetworkError(
      'Binary download URL must not downgrade HTTPS to HTTP',
      new Error(`${base.protocol} -> ${parsed.protocol}`),
    );
  }
  const crossHost = parsed.host !== base.host;
  if (!crossHost) {
    return;
  }
  if (parsed.protocol !== 'https:') {
    throw new NetworkError(
      'Cross-host binary download URL must use https',
      new Error(parsed.protocol),
    );
  }
  if (isBlockedBinaryHostname(parsed.hostname)) {
    throw new NetworkError(
      `Binary download host is not allowed: ${parsed.hostname}`,
      new Error(parsed.hostname),
    );
  }
}

function readApiErrorPayload(data: unknown): ApiErrorPayload['error'] | undefined {
  if (data === null || typeof data !== 'object' || !('error' in data)) {
    return undefined;
  }
  const error = data.error;
  if (error === null || typeof error !== 'object') {
    return undefined;
  }
  if (typeof (error as { statusCode?: unknown }).statusCode !== 'number') {
    return undefined;
  }
  return error as ApiErrorPayload['error'];
}

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
    if (data !== null && typeof data === 'object') {
      const envelope = data;
      if (isApiSuccessEnvelope(envelope)) {
        return envelope.results;
      }
    }

    const apiError = readApiErrorPayload(data);
    if (apiError !== undefined) {
      throw new LightdashApiError(
        apiError.statusCode,
        apiError,
        response.config,
        response as AxiosResponse<ApiErrorPayload>,
      );
    }

    const httpStatus = response.status;
    const contractStatus = typeof httpStatus === 'number' && httpStatus >= 400 ? httpStatus : 502;
    throw new LightdashApiError(
      contractStatus,
      {
        name: CONTRACT_ERROR_NAME,
        statusCode: contractStatus,
        message: CONTRACT_ERROR_MESSAGE,
      },
      response.config,
      response as AxiosResponse<ApiErrorPayload>,
    );
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

  /**
   * Fetch raw bytes (no ApiSuccess envelope unwrap). Relative URLs use the
   * authenticated API client; absolute URLs on a different host (e.g. signed S3)
   * are fetched without Lightdash Authorization. Cross-host fetches require https,
   * disallow private/link-local hosts, and follow no redirects.
   */
  async getBytes(url: string, options?: GetBytesOptions): Promise<GetBytesResult> {
    const maxBytes = options?.maxBytes ?? DEFAULT_BINARY_MAX_BYTES;
    const timeout = options?.timeout ?? this.config.timeout ?? DEFAULT_TIMEOUT;
    assertSafeBinaryFetchUrl(url, this.config.baseUrl);
    const binaryConfig: AxiosRequestConfig = {
      responseType: 'arraybuffer',
      timeout,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      maxRedirects: 0,
    };

    const doRequest = (): Promise<AxiosResponse<ArrayBuffer>> => {
      if (/^https?:\/\//i.test(url)) {
        const targetHost = new URL(url).host;
        const baseHost = new URL(this.config.baseUrl).host;
        if (targetHost !== baseHost) {
          return axios.get<ArrayBuffer>(url, binaryConfig);
        }
      }
      return this.axiosInstance.get<ArrayBuffer>(url, binaryConfig);
    };

    let response: AxiosResponse<ArrayBuffer>;
    try {
      // No retries: binary bodies can be multi-MiB; a 5xx would re-download the payload.
      response = await this.rateLimiter.schedule(doRequest);
    } catch (err) {
      if (isAxiosMaxContentLengthError(err)) {
        throw new BinarySizeLimitError(maxBytes);
      }
      throw err;
    }
    const bytes = Buffer.from(response.data);
    if (bytes.byteLength > maxBytes) {
      throw new BinarySizeLimitError(maxBytes, bytes.byteLength);
    }
    const rawType = response.headers['content-type'];
    const mimeType =
      typeof rawType === 'string'
        ? (rawType.split(';')[0]?.trim() ?? 'application/octet-stream')
        : 'application/octet-stream';
    return { bytes, mimeType };
  }
}
