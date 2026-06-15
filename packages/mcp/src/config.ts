/**
 * MCP server config: build Lightdash client config from environment.
 * Uses same env vars as CLI: LIGHTDASH_URL, LIGHTDASH_API_KEY.
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import { getSafetyModeFromEnv, getAllowedProjectUuidsFromEnv } from '@lightdash-tools/common';

import type { PartialLightdashClientConfig } from '@lightdash-tools/client';
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
 * Sets the project UUID allowlist from the CLI (overrides LIGHTDASH_TOOLS_ALLOWED_PROJECTS).
 */
export function setStaticAllowedProjectUuids(uuids: string[]): void {
  globalStaticAllowedProjectUuids = uuids;
}

/**
 * Returns true when dry-run mode is active.
 * CLI flag overrides the LIGHTDASH_TOOLS_DRY_RUN environment variable.
 */
export function isDryRunMode(): boolean {
  if (globalDryRunMode !== undefined) return globalDryRunMode;
  const v = process.env.LIGHTDASH_TOOLS_DRY_RUN;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Enables or disables dry-run mode (from CLI).
 */
export function setDryRunMode(enabled: boolean): void {
  globalDryRunMode = enabled;
}

/**
 * Returns the audit log file path from LIGHTDASH_TOOLS_AUDIT_LOG, or undefined to use stderr.
 */
export function getAuditLogPath(): string | undefined {
  return process.env.LIGHTDASH_TOOLS_AUDIT_LOG || undefined;
}

/** MCP capability profiles (RFC Phase 2). */
export const MCP_PROFILE_CORE_LIFECYCLE = 'core-lifecycle' as const;
export const MCP_PROFILE_EVALUATIONS = 'evaluations' as const;

export const DEFAULT_MCP_PROFILES = [MCP_PROFILE_CORE_LIFECYCLE, MCP_PROFILE_EVALUATIONS] as const;

export type McpProfile = (typeof DEFAULT_MCP_PROFILES)[number];

/**
 * Active MCP capability profiles from LIGHTDASH_TOOLS_MCP_PROFILES (comma-separated).
 * Defaults to core-lifecycle and evaluations when unset.
 */
export function getMcpProfiles(): Set<McpProfile> {
  const raw = process.env.LIGHTDASH_TOOLS_MCP_PROFILES;
  const names = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [...DEFAULT_MCP_PROFILES];
  return new Set(names as McpProfile[]);
}

/** Returns true when the given profile is enabled. */
export function hasMcpProfile(profile: McpProfile, profiles?: Set<McpProfile>): boolean {
  const active = profiles ?? getMcpProfiles();
  return active.has(profile);
}

/**
 * Builds a LightdashClient from environment variables (and optional overrides).
 * Throws if LIGHTDASH_URL or LIGHTDASH_API_KEY are missing.
 */
export function getClient(config?: PartialLightdashClientConfig): LightdashClient {
  const merged = mergeConfig(config);
  return new LightdashClient(merged);
}

export {
  loadMcpHttpConfig,
  requiresLightdashApiKey,
  type McpHttpConfig,
} from './config/load-mcp-config.js';
export * from './config/env.js';
