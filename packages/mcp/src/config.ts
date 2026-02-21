/**
 * MCP server config: build Lightdash client config from environment.
 * Uses same env vars as CLI: LIGHTDASH_URL, LIGHTDASH_API_KEY.
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import type { PartialLightdashClientConfig } from '@lightdash-tools/client';
import { getSafetyModeFromEnv, getAllowedProjectUuidsFromEnv } from '@lightdash-tools/common';
import type { SafetyMode } from '@lightdash-tools/common';

let globalStaticSafetyMode: SafetyMode | undefined;
let globalStaticAllowedProjectUuids: string[] | undefined;
let globalDryRunMode: boolean | undefined;

/**
 * Gets the safety mode for dynamic enforcement.
 */
export function getSafetyMode(): SafetyMode {
  return getSafetyModeFromEnv();
}

/**
 * Gets the safety mode for static tool filtering (binding).
 */
export function getStaticSafetyMode(): SafetyMode | undefined {
  return globalStaticSafetyMode;
}

/**
 * Sets the static safety mode (from CLI).
 */
export function setStaticSafetyMode(mode: SafetyMode): void {
  globalStaticSafetyMode = mode;
}

/**
 * Returns the effective project UUID allowlist.
 * CLI-provided values override the environment variable.
 * An empty array means all projects are allowed.
 */
export function getAllowedProjectUuids(): string[] {
  return globalStaticAllowedProjectUuids ?? getAllowedProjectUuidsFromEnv();
}

/**
 * Sets the project UUID allowlist from the CLI (overrides LIGHTDASH_ALLOWED_PROJECTS).
 */
export function setStaticAllowedProjectUuids(uuids: string[]): void {
  globalStaticAllowedProjectUuids = uuids;
}

/**
 * Returns true when dry-run mode is active.
 * CLI flag overrides the LIGHTDASH_DRY_RUN environment variable.
 */
export function isDryRunMode(): boolean {
  if (globalDryRunMode !== undefined) return globalDryRunMode;
  const v = process.env.LIGHTDASH_DRY_RUN;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Enables or disables dry-run mode (from CLI).
 */
export function setDryRunMode(enabled: boolean): void {
  globalDryRunMode = enabled;
}

/**
 * Returns the audit log file path from LIGHTDASH_AUDIT_LOG, or undefined to use stderr.
 */
export function getAuditLogPath(): string | undefined {
  return process.env.LIGHTDASH_AUDIT_LOG || undefined;
}

/**
 * Builds a LightdashClient from environment variables (and optional overrides).
 * Throws if LIGHTDASH_URL or LIGHTDASH_API_KEY are missing.
 */
export function getClient(config?: PartialLightdashClientConfig): LightdashClient {
  const merged = mergeConfig(config);
  return new LightdashClient(merged);
}
