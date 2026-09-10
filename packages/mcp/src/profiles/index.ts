/**
 * Profile loader façade — ToolModules load via preloadProfiles (ADR-0024 cold-start).
 * Lightweight id/path catalog lives in catalog.ts (no tool imports).
 */

import { PROFILE_IDS } from '@lightdash-tools/common';

import {
  DEFAULT_PROFILE_ID,
  getProfileIdByPath,
  getProfilePath,
  listCatalogProfilePaths,
} from './catalog.js';

import type { ProfileDefinition, ProfileId } from './types.js';

export type { ProfileDefinition, ProfileId } from './types.js';
export {
  AI_AGENT_CHAT_PROFILE_PATH,
  AI_AGENT_OPS_PROFILE_PATH,
  CONTENT_DEVELOPER_PROFILE_PATH,
  CONTENT_GOVERNANCE_PROFILE_PATH,
  CONTENT_READER_PROFILE_PATH,
  DATA_ANALYST_PROFILE_PATH,
  DEFAULT_PROFILE_ID,
  ORGANIZATION_AUDIT_PROFILE_PATH,
  parseProfileId,
  SEMANTIC_LAYER_PROFILE_PATH,
} from './catalog.js';

type ProfileLoader = () => Promise<ProfileDefinition>;

/** One async importer table — shared mental model with sync help loaders in profile-modules.ts. */
const PROFILE_LOADERS: { readonly [K in ProfileId]: ProfileLoader } = {
  'semantic-layer': async () => (await import('./semantic-layer/v1/index.js')).semanticLayerProfile,
  'organization-audit': async () =>
    (await import('./organization-audit/v1/index.js')).organizationAuditProfile,
  'content-reader': async () => (await import('./content-reader/v1/index.js')).contentReaderProfile,
  'content-developer': async () =>
    (await import('./content-developer/v1/index.js')).contentDeveloperProfile,
  'content-governance': async () =>
    (await import('./content-governance/v1/index.js')).contentGovernanceProfile,
  'ai-agent-chat': async () => (await import('./ai-agent-chat/v1/index.js')).aiAgentChatProfile,
  'ai-agent-ops': async () => (await import('./ai-agent-ops/v1/index.js')).aiAgentOpsProfile,
  'data-analyst': async () => (await import('./data-analyst/v1/index.js')).dataAnalystProfile,
};

const loadedProfiles = new Map<ProfileId, ProfileDefinition>();
const inFlightLoads = new Map<ProfileId, Promise<ProfileDefinition>>();

async function loadProfile(id: ProfileId): Promise<ProfileDefinition> {
  const cached = loadedProfiles.get(id);
  if (cached) {
    return cached;
  }
  const existing = inFlightLoads.get(id);
  if (existing) {
    return existing;
  }
  // eslint-disable-next-line security/detect-object-injection -- ProfileId union
  const pending = PROFILE_LOADERS[id]()
    .then((profile) => {
      if (profile.path !== getProfilePath(id)) {
        throw new Error(
          `Profile '${id}' path mismatch: module=${profile.path} catalog=${getProfilePath(id)}`,
        );
      }
      loadedProfiles.set(id, profile);
      return profile;
    })
    .finally(() => {
      inFlightLoads.delete(id);
    });
  inFlightLoads.set(id, pending);
  return pending;
}

/** Load ToolModules for the given profile ids (idempotent). */
export async function preloadProfiles(ids: readonly ProfileId[]): Promise<void> {
  await Promise.all(ids.map((id) => loadProfile(id)));
}

/** Preload every shipped profile (tests / unrestricted HTTP). */
export async function preloadAllProfiles(): Promise<void> {
  await preloadProfiles(PROFILE_IDS);
}

/** True when this profile’s ToolModule graph has been loaded into the process. */
export function isProfileLoaded(id: ProfileId): boolean {
  return loadedProfiles.has(id);
}

/**
 * Return a loaded profile definition.
 * @throws when `preloadProfiles` has not loaded this id yet
 */
export function getProfile(id: ProfileId): ProfileDefinition {
  const profile = loadedProfiles.get(id);
  if (!profile) {
    throw new Error(`Profile '${id}' is not loaded. Call preloadProfiles() before use.`);
  }
  return profile;
}

export function getDefaultProfile(): ProfileDefinition {
  return getProfile(DEFAULT_PROFILE_ID);
}

/**
 * Resolve a loaded profile from an HTTP path.
 * Unknown paths and not-yet-loaded profiles return undefined (HTTP → 404).
 */
export function getProfileByPath(path: string): ProfileDefinition | undefined {
  const id = getProfileIdByPath(path);
  if (!id) {
    return undefined;
  }
  return loadedProfiles.get(id);
}

/** Shipped mount paths from the light catalog (does not require preload). */
export function listProfilePaths(): string[] {
  return listCatalogProfilePaths();
}

/** MCP server display name for a profile. */
export function getProfileServerName(profile: ProfileDefinition): string {
  return profile.serverName ?? `lightdash-mcp-${profile.id}`;
}

/** Short tool ids mounted on a profile (sans `lightdash_` prefix). */
export function listToolIds(profile: ProfileDefinition): string[] {
  return profile.tools.map((tool) => tool.id);
}

/** Test helper: clear the in-memory profile cache (does not unload Node modules). */
export function resetLoadedProfilesForTests(): void {
  loadedProfiles.clear();
  inFlightLoads.clear();
}
