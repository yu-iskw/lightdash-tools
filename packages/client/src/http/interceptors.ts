/**
 * Request and response interceptors for auth, proxy, and error handling.
 */

import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { LightdashClientConfig } from '../config';
import type { ApiErrorPayload } from '../errors';
import { LightdashApiError, RateLimitError, NetworkError } from '../errors';

function getRetryAfterSeconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Attaches request interceptors: Authorization, Proxy-Authorization, optional request ID and logging.
 */
export function attachRequestInterceptors(
  axiosInstance: AxiosInstance,
  config: LightdashClientConfig,
): void {
  axiosInstance.interceptors.request.use(
    (req: InternalAxiosRequestConfig) => {
      const token = config.personalAccessToken.startsWith('ldpat_')
        ? config.personalAccessToken
        : `ldpat_${config.personalAccessToken}`;
      req.headers.Authorization = `ApiKey ${token}`;

      if (config.proxyAuthorization) {
        req.headers['Proxy-Authorization'] = config.proxyAuthorization;
      }

      (req as InternalAxiosRequestConfig & { _lightdashStartTime?: number })._lightdashStartTime =
        Date.now();

      if (config.logger?.debug) {
        config.logger.debug('Lightdash request: %s %s', req.method, req.url);
      }

      return req;
    },
    (err) => Promise.reject(err),
  );
}

/**
 * Attaches response interceptors: parse API responses, transform errors to LightdashApiError / RateLimitError.
 */
export function attachResponseInterceptors(
  axiosInstance: AxiosInstance,
  config?: Pick<LightdashClientConfig, 'logger' | 'observability'>,
): void {
  const logger = config?.logger;
  axiosInstance.interceptors.response.use(
    (response) => {
      if (logger?.debug) {
        logger.debug(
          'Lightdash response: %s %s %s',
          response.config.method,
          response.config.url,
          response.status,
        );
      }
      const start = (response.config as { _lightdashStartTime?: number })._lightdashStartTime;
      config?.observability?.onRequestComplete?.({
        method: response.config.method ?? 'GET',
        url: response.config.url ?? '',
        statusCode: response.status,
        durationMs: start !== undefined ? Date.now() - start : 0,
      });
      return response;
    },
    (error) => {
      const reqConfig = error.config as
        | (InternalAxiosRequestConfig & { _lightdashStartTime?: number })
        | undefined;
      const start = reqConfig?._lightdashStartTime;
      config?.observability?.onRequestComplete?.({
        method: reqConfig?.method ?? 'GET',
        url: reqConfig?.url ?? '',
        statusCode: error.response?.status,
        durationMs: start !== undefined ? Date.now() - start : 0,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (error.response) {
        const status = error.response.status as number;
        const data = error.response.data as ApiErrorPayload | undefined;
        const retryAfter = getRetryAfterSeconds(error.response.headers?.['retry-after']);

        const payload = data?.error ?? {
          name: 'UnknownError',
          statusCode: status,
          message: error.message,
        };

        if (status === 429) {
          return Promise.reject(
            new RateLimitError(status, payload, error.config, error.response, retryAfter),
          );
        }

        return Promise.reject(new LightdashApiError(status, payload, error.config, error.response));
      }

      const msg = error.message || (error.code ? `Network error: ${error.code}` : 'Network error');
      return Promise.reject(new NetworkError(msg, error));
    },
  );
}
