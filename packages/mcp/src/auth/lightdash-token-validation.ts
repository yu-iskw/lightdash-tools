import {
  createBearerConfig,
  LightdashApiError,
  LightdashClient,
  NetworkError,
} from '@lightdash-tools/client';

import { hashToken } from './token-hash.js';
import { TokenValidationCache } from './token-validation-cache.js';
import { TokenValidationError } from './token-validation-error.js';

import type { McpHttpConfig } from '../config/load-mcp-config.js';

export interface ValidatedLightdashUser {
  userUuid: string;
  email: string;
}

const validationCaches = new WeakMap<McpHttpConfig, TokenValidationCache<ValidatedLightdashUser>>();

function getValidationCache(config: McpHttpConfig): TokenValidationCache<ValidatedLightdashUser> {
  let cache = validationCaches.get(config);
  if (!cache) {
    cache = new TokenValidationCache<ValidatedLightdashUser>(config.tokenValidationCacheTtlMs);
    validationCaches.set(config, cache);
  }
  return cache;
}

function unvalidatedDevUser(tokenHash: string): ValidatedLightdashUser {
  return {
    userUuid: `unvalidated:${tokenHash.slice(0, 16)}`,
    email: 'unvalidated@localhost',
  };
}

function classifyValidationError(error: unknown): TokenValidationError {
  if (error instanceof LightdashApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new TokenValidationError('invalid_token', 'Invalid or expired Lightdash access token');
    }
    if (error.statusCode >= 500) {
      return new TokenValidationError(
        'upstream_unavailable',
        'Lightdash is temporarily unavailable',
      );
    }
  }

  if (error instanceof NetworkError) {
    return new TokenValidationError('upstream_unavailable', 'Lightdash is temporarily unavailable');
  }

  return new TokenValidationError('invalid_token', 'Invalid or expired Lightdash access token');
}

export async function validateLightdashAccessToken(
  config: McpHttpConfig,
  accessToken: string,
): Promise<ValidatedLightdashUser> {
  const tokenHash = hashToken(accessToken);

  if (!config.validateToken) {
    return unvalidatedDevUser(tokenHash);
  }

  const cache = getValidationCache(config);
  const cached = cache.get(tokenHash);
  if (cached) return cached;

  const client = new LightdashClient({
    ...createBearerConfig({
      baseUrl: config.lightdashUrl,
      accessToken,
      proxyAuthorization: config.proxyAuthorization,
    }),
    retry: { maxRetries: 0 },
    timeout: 5_000,
  });

  try {
    const user = await client.v1.users.getAuthenticatedUser();
    const validated: ValidatedLightdashUser = {
      userUuid: user.userUuid,
      email: user.email ?? '',
    };

    cache.set(tokenHash, validated);
    return validated;
  } catch (error) {
    cache.delete(tokenHash);
    throw classifyValidationError(error);
  }
}
