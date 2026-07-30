/**
 * MCP runtime config: Lightdash client + process guardrails (safety mode, allowlist, dry-run, audit path).
 * Uses the same env vars as the CLI: LIGHTDASH_URL, LIGHTDASH_API_KEY, LIGHTDASH_TOOLS_*.
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import { getSafetyModeFromEnv, getAllowedProjectUuidsFromEnv } from '@lightdash-tools/common';

import type { PartialLightdashClientConfig } from '@lightdash-tools/client';
import type { SafetyMode } from '@lightdash-tools/common';

let globalStaticSafetyMode: SafetyMode | undefined;
let globalStaticAllowedProjectUuids: string[] | undefined;
let globalDryRunMode: boolean | undefined;

export function getSafetyMode(): SafetyMode {
  return getSafetyModeFromEnv();
}

export function getStaticSafetyMode(): SafetyMode | undefined {
  return globalStaticSafetyMode;
}

export function setStaticSafetyMode(mode: SafetyMode): void {
  globalStaticSafetyMode = mode;
}

/** Empty array means all projects are allowed. CLI static values override env. */
export function getAllowedProjectUuids(): string[] {
  return globalStaticAllowedProjectUuids ?? getAllowedProjectUuidsFromEnv();
}

export function setStaticAllowedProjectUuids(uuids: string[]): void {
  globalStaticAllowedProjectUuids = uuids;
}

/** CLI flag overrides LIGHTDASH_TOOLS_DRY_RUN when set via setDryRunMode. */
export function isDryRunMode(): boolean {
  if (globalDryRunMode !== undefined) return globalDryRunMode;
  const v = process.env.LIGHTDASH_TOOLS_DRY_RUN;
  return v === '1' || v === 'true' || v === 'yes';
}

export function setDryRunMode(enabled: boolean): void {
  globalDryRunMode = enabled;
}

/** Undefined → audit log goes to stderr. */
export function getAuditLogPath(): string | undefined {
  return process.env.LIGHTDASH_TOOLS_AUDIT_LOG || undefined;
}

export function getClient(config?: PartialLightdashClientConfig): LightdashClient {
  const merged = mergeConfig(config);
  return new LightdashClient(merged);
}
