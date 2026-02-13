/**
 * MCP server config: build Lightdash client config from environment.
 * Uses same env vars as CLI: LIGHTDASH_URL, LIGHTDASH_API_KEY.
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import type { PartialLightdashClientConfig } from '@lightdash-tools/client';
import { getSafetyModeFromEnv } from '@lightdash-tools/common';
import type { SafetyMode } from '@lightdash-tools/common';

let globalBindedToolMode: SafetyMode | undefined;

/**
 * Gets the safety mode for dynamic enforcement.
 */
export function getSafetyMode(): SafetyMode {
  return getSafetyModeFromEnv();
}

/**
 * Gets the safety mode for static tool filtering (binding).
 */
export function getBindedToolMode(): SafetyMode | undefined {
  return globalBindedToolMode;
}

/**
 * Sets the binded tool mode (from CLI).
 */
export function setBindedToolMode(mode: SafetyMode): void {
  globalBindedToolMode = mode;
}

/**
 * Builds a LightdashClient from environment variables (and optional overrides).
 * Throws if LIGHTDASH_URL or LIGHTDASH_API_KEY are missing.
 */
export function getClient(config?: PartialLightdashClientConfig): LightdashClient {
  const merged = mergeConfig(config);
  return new LightdashClient(merged);
}
