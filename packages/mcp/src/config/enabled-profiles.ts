/**
 * HTTP mount allowlist for shipped MCP profiles (ADR-0024).
 *
 * Canonical: `LIGHTDASH_TOOLS_MCP_PROFILES`.
 * Unset/empty → unrestricted (all shipped paths). Non-empty → hard ceiling.
 * Unknown ids / empty CSV segments fail closed. Stdio ignores this env.
 */

import { PROFILE_IDS, type ProfileId } from '@lightdash-tools/common';

import {
  DEFAULT_PROFILE_ID,
  getDefaultProfile,
  getProfile,
  parseProfileId,
} from '../profiles/index.js';

import { ENV_LIGHTDASH_TOOLS_MCP_PROFILES } from './env.js';

export type EnabledProfilesPolicy =
  { restricted: false } | { restricted: true; ids: ReadonlySet<ProfileId> };

export const UNRESTRICTED_ENABLED_PROFILES: EnabledProfilesPolicy = { restricted: false };

export function parseEnabledProfiles(raw: string | undefined): EnabledProfilesPolicy {
  if (raw === undefined || raw.trim() === '') {
    return UNRESTRICTED_ENABLED_PROFILES;
  }
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.some((part) => part === '')) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_PROFILES} must be a non-empty comma-separated list of profile ids (empty segments are not allowed)`,
    );
  }
  const ids = new Set<ProfileId>();
  for (const part of parts) {
    const id = parseProfileId(part);
    if (!id) {
      throw new Error(
        `${ENV_LIGHTDASH_TOOLS_MCP_PROFILES} contains unknown profile '${part}'. Expected one of: ${PROFILE_IDS.join(', ')}`,
      );
    }
    ids.add(id);
  }
  return { restricted: true, ids };
}

export function isProfileEnabled(policy: EnabledProfilesPolicy, id: ProfileId): boolean {
  return !policy.restricted || policy.ids.has(id);
}

/** Preview/destructive HMAC key is required when write profiles are mounted. */
export function requiresSignedStateKey(policy: EnabledProfilesPolicy): boolean {
  return (
    !policy.restricted ||
    policy.ids.has('content-developer') ||
    policy.ids.has('content-governance')
  );
}

/** Enabled HTTP mount paths in `PROFILE_IDS` order. */
export function listEnabledProfilePaths(policy: EnabledProfilesPolicy): string[] {
  return PROFILE_IDS.filter((id) => isProfileEnabled(policy, id)).map((id) => getProfile(id).path);
}

/** Root PRM / `config.mcpPath` anchor: default profile, else first enabled `PROFILE_IDS` id. */
export function resolveRootMcpPath(policy: EnabledProfilesPolicy): string {
  if (!policy.restricted || policy.ids.has(DEFAULT_PROFILE_ID)) {
    return getDefaultProfile().path;
  }
  return listEnabledProfilePaths(policy)[0];
}
