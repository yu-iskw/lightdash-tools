/**
 * Shipped MCP profiles (path → definition). No free-form PATH env (ADR-0006).
 * HTTP may filter mounts via LIGHTDASH_TOOLS_MCP_PROFILES (ADR-0024); catalog stays complete.
 */

import { PROFILE_IDS } from '@lightdash-tools/common';

import { normalizeMcpPath } from '../config/normalize-url.js';

import { aiAgentOpsProfile } from './ai-agent-ops/v1/index.js';
import { contentDeveloperProfile } from './content-developer/v1/index.js';
import { contentGovernanceProfile } from './content-governance/v1/index.js';
import { contentReaderProfile } from './content-reader/v1/index.js';
import { dataAnalystProfile } from './data-analyst/v1/index.js';
import { organizationAuditProfile } from './organization-audit/v1/index.js';
import { semanticLayerProfile } from './semantic-layer/v1/index.js';

import type { ProfileDefinition, ProfileId } from './types.js';

export type { ProfileDefinition, ProfileId } from './types.js';
export { AI_AGENT_OPS_PROFILE_PATH } from './ai-agent-ops/v1/index.js';
export { SEMANTIC_LAYER_PROFILE_PATH } from './semantic-layer/v1/index.js';
export { ORGANIZATION_AUDIT_PROFILE_PATH } from './organization-audit/v1/index.js';
export { CONTENT_READER_PROFILE_PATH } from './content-reader/v1/index.js';
export { CONTENT_DEVELOPER_PROFILE_PATH } from './content-developer/v1/index.js';
export { CONTENT_GOVERNANCE_PROFILE_PATH } from './content-governance/v1/index.js';
export { DATA_ANALYST_PROFILE_PATH } from './data-analyst/v1/index.js';

/** HTTP root / PRM anchor profile (not a stdio default). */
export const DEFAULT_PROFILE_ID: ProfileId = 'semantic-layer';

export const PROFILES: Record<ProfileId, ProfileDefinition> = {
  'semantic-layer': semanticLayerProfile,
  'organization-audit': organizationAuditProfile,
  'content-reader': contentReaderProfile,
  'content-developer': contentDeveloperProfile,
  'content-governance': contentGovernanceProfile,
  'ai-agent-ops': aiAgentOpsProfile,
  'data-analyst': dataAnalystProfile,
};

const PROFILES_BY_PATH = new Map<string, ProfileDefinition>(
  Object.values(PROFILES).map((profile) => [profile.path, profile]),
);

export function getProfile(id: ProfileId): ProfileDefinition {
  // eslint-disable-next-line security/detect-object-injection -- ProfileId union
  return PROFILES[id];
}

export function getDefaultProfile(): ProfileDefinition {
  return getProfile(DEFAULT_PROFILE_ID);
}

/** Resolve profile from an HTTP request path, or undefined if unknown. */
export function getProfileByPath(path: string): ProfileDefinition | undefined {
  if (path.trim().length === 0) {
    return undefined;
  }
  return PROFILES_BY_PATH.get(normalizeMcpPath(path));
}

export function listProfilePaths(): string[] {
  return [...PROFILES_BY_PATH.keys()];
}

/** Parse a CLI profile id; returns undefined when invalid. */
export function parseProfileId(value: string): ProfileId | undefined {
  return (PROFILE_IDS as readonly string[]).includes(value) ? (value as ProfileId) : undefined;
}

/** MCP server display name for a profile. */
export function getProfileServerName(profile: ProfileDefinition): string {
  return profile.serverName ?? `lightdash-mcp-${profile.id}`;
}

/** Short tool ids mounted on a profile (sans `lightdash_` prefix). */
export function listToolIds(profile: ProfileDefinition): string[] {
  return profile.tools.map((tool) => tool.id);
}
