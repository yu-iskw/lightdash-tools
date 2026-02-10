/**
 * Axios instance setup with base URL, timeout, and interceptors.
 */

import axios, { type AxiosInstance } from 'axios';
import type { LightdashClientConfig } from '../config';
import { DEFAULT_TIMEOUT } from '../config';
import { attachRequestInterceptors, attachResponseInterceptors } from './interceptors';

/**
 * API version type.
 */
export type ApiVersion = 'v1' | 'v2';

/**
 * Creates a configured Axios instance for the Lightdash API with a specific version.
 */
function createAxiosInstanceForVersion(
  config: LightdashClientConfig,
  version: ApiVersion,
): AxiosInstance {
  const baseURL = config.baseUrl.replace(/\/$/, '') + `/api/${version}`;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  attachRequestInterceptors(instance, config);
  attachResponseInterceptors(instance, config);

  return instance;
}

/**
 * Creates a configured Axios instance for the Lightdash API v1.
 */
export function createAxiosInstanceV1(config: LightdashClientConfig): AxiosInstance {
  return createAxiosInstanceForVersion(config, 'v1');
}

/**
 * Creates a configured Axios instance for the Lightdash API v2.
 */
export function createAxiosInstanceV2(config: LightdashClientConfig): AxiosInstance {
  return createAxiosInstanceForVersion(config, 'v2');
}

/**
 * Creates a configured Axios instance for the Lightdash API v1.
 * @deprecated Use `createAxiosInstanceV1` instead. This function is kept for backward compatibility.
 */
export function createAxiosInstance(config: LightdashClientConfig): AxiosInstance {
  return createAxiosInstanceV1(config);
}
