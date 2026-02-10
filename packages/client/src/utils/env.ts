/**
 * Environment variable loading for Lightdash client configuration.
 * Supports LIGHTDASH_API_KEY, LIGHTDASH_URL, LIGHTDASH_PROXY_AUTHORIZATION.
 * Priority: explicit config > environment variables > no default for required fields.
 */

import type { LightdashClientConfig, PartialLightdashClientConfig } from '../config';

/** Environment variable names (aligned with Lightdash CLI). */
export const ENV_LIGHTDASH_API_KEY = 'LIGHTDASH_API_KEY';
export const ENV_LIGHTDASH_URL = 'LIGHTDASH_URL';
export const ENV_LIGHTDASH_PROXY_AUTHORIZATION = 'LIGHTDASH_PROXY_AUTHORIZATION';

/**
 * Reads configuration from environment variables.
 * Returns only the fields that are set in the environment.
 */
export function loadConfigFromEnv(): PartialLightdashClientConfig {
  const env = typeof process !== 'undefined' ? process.env : {};
  const out: PartialLightdashClientConfig = {};

  const apiKey = env[ENV_LIGHTDASH_API_KEY];
  if (apiKey !== undefined && apiKey !== '') {
    out.personalAccessToken = apiKey;
  }

  const url = env[ENV_LIGHTDASH_URL];
  if (url !== undefined && url !== '') {
    out.baseUrl = url.replace(/\/$/, '');
  }

  const proxyAuth = env[ENV_LIGHTDASH_PROXY_AUTHORIZATION];
  if (proxyAuth !== undefined && proxyAuth !== '') {
    out.proxyAuthorization = proxyAuth;
  }

  return out;
}

/**
 * Merges explicit config with environment-derived config.
 * Explicit config takes priority over environment variables.
 */
export function mergeConfig(
  explicit: PartialLightdashClientConfig | undefined,
): LightdashClientConfig {
  const fromEnv = loadConfigFromEnv();

  const baseUrl = explicit?.baseUrl ?? fromEnv.baseUrl ?? '';
  const personalAccessToken = explicit?.personalAccessToken ?? fromEnv.personalAccessToken ?? '';

  if (!baseUrl || !personalAccessToken) {
    throw new Error(
      'Lightdash client requires baseUrl and personalAccessToken. ' +
        'Set them in config or via LIGHTDASH_URL and LIGHTDASH_API_KEY.',
    );
  }

  return {
    baseUrl,
    personalAccessToken,
    proxyAuthorization: explicit?.proxyAuthorization ?? fromEnv.proxyAuthorization,
    rateLimit: explicit?.rateLimit,
    timeout: explicit?.timeout,
    retry: explicit?.retry,
    logger: explicit?.logger,
  };
}
