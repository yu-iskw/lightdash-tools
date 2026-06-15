/**
 * Environment variable loading for Lightdash client configuration.
 * Supports LIGHTDASH_API_KEY, LIGHTDASH_URL, LIGHTDASH_PROXY_AUTHORIZATION.
 * Priority: explicit config > environment variables > no default for required fields.
 */

import { SecretString } from './secret-string';

import type {
  LightdashAuthConfig,
  LightdashClientConfig,
  PartialLightdashClientConfig,
} from '../config';

/** Environment variable names (aligned with Lightdash CLI). */
export const ENV_LIGHTDASH_API_KEY = 'LIGHTDASH_API_KEY';
export const ENV_LIGHTDASH_URL = 'LIGHTDASH_URL';
export const ENV_LIGHTDASH_PROXY_AUTHORIZATION = 'LIGHTDASH_PROXY_AUTHORIZATION';

function toSecretString(value: SecretString | string): SecretString {
  return typeof value === 'string' ? new SecretString(value) : value;
}

function normalizeAuthConfig(
  auth: NonNullable<PartialLightdashClientConfig['auth']>,
): LightdashAuthConfig {
  const token = toSecretString(auth.token);
  if (auth.type === 'bearer') {
    return { type: 'bearer', token };
  }
  return { type: 'api-key', token };
}

function resolveAuthConfig(
  explicit: PartialLightdashClientConfig | undefined,
  fromEnv: PartialLightdashClientConfig,
): LightdashAuthConfig {
  if (explicit?.auth) {
    return normalizeAuthConfig(explicit.auth);
  }
  const pat = explicit?.personalAccessToken ?? fromEnv.personalAccessToken;
  if (pat) {
    return { type: 'api-key', token: toSecretString(pat) };
  }
  throw new Error(
    'Lightdash client requires auth credentials. Set auth, personalAccessToken, or LIGHTDASH_API_KEY.',
  );
}

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
 * Builds a bearer-token client config for OAuth access tokens.
 */
export function createBearerConfig(options: {
  baseUrl: string;
  accessToken: SecretString | string;
  proxyAuthorization?: SecretString | string;
}): PartialLightdashClientConfig {
  return {
    baseUrl: options.baseUrl.replace(/\/$/, ''),
    auth: { type: 'bearer', token: options.accessToken },
    proxyAuthorization: options.proxyAuthorization,
  };
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
  const proxyAuth = explicit?.proxyAuthorization ?? fromEnv.proxyAuthorization;

  if (!baseUrl) {
    throw new Error('Lightdash client requires baseUrl. Set it in config or via LIGHTDASH_URL.');
  }

  const auth = resolveAuthConfig(explicit, fromEnv);
  const personalAccessToken = auth.type === 'api-key' ? auth.token : explicit?.personalAccessToken;

  return {
    baseUrl,
    auth,
    personalAccessToken:
      personalAccessToken !== undefined ? toSecretString(personalAccessToken) : undefined,
    proxyAuthorization: proxyAuth !== undefined ? toSecretString(proxyAuth) : undefined,
    rateLimit: explicit?.rateLimit,
    timeout: explicit?.timeout,
    retry: explicit?.retry,
    logger: explicit?.logger,
    observability: explicit?.observability,
  };
}
