import { createBearerConfig, LightdashClient } from '@lightdash-tools/client';

import { hashToken } from './token-hash.js';
import { TokenValidationCache } from './token-validation-cache.js';

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

export async function validateLightdashAccessToken(
  config: McpHttpConfig,
  accessToken: string,
): Promise<ValidatedLightdashUser> {
  const tokenHash = hashToken(accessToken);
  const cache = getValidationCache(config);

  if (config.validateToken) {
    const cached = cache.get(tokenHash);
    if (cached) return cached;
  }

  const client = new LightdashClient(
    createBearerConfig({
      baseUrl: config.lightdashUrl,
      accessToken,
      proxyAuthorization: config.proxyAuthorization,
    }),
  );

  try {
    const user = await client.v1.users.getAuthenticatedUser();
    const validated: ValidatedLightdashUser = {
      userUuid: user.userUuid,
      email: user.email ?? '',
    };

    if (config.validateToken) {
      cache.set(tokenHash, validated);
    }

    return validated;
  } catch {
    cache.delete(tokenHash);
    throw new Error('Invalid or expired Lightdash access token');
  }
}
