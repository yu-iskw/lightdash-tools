/**
 * MCP server config: build Lightdash client config from environment.
 * Uses same env vars as CLI: LIGHTDASH_URL, LIGHTDASH_API_KEY.
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import type { PartialLightdashClientConfig } from '@lightdash-tools/client';

/**
 * Builds a LightdashClient from environment variables (and optional overrides).
 * Throws if LIGHTDASH_URL or LIGHTDASH_API_KEY are missing.
 */
export function getClient(config?: PartialLightdashClientConfig): LightdashClient {
  const merged = mergeConfig(config);
  return new LightdashClient(merged);
}
