/**
 * Lightweight profile id ↔ path catalog (no ToolModule imports).
 * Used by CLI parse, HTTP allowlist parsing, and cold-start path routing (ADR-0024).
 */

import { PROFILE_IDS, type ProfileId } from '@lightdash-tools/common';

import { normalizeMcpPath } from '../config/normalize-url.js';

export type { ProfileId };

/** HTTP root / PRM anchor profile (not a stdio default). */
export const DEFAULT_PROFILE_ID: ProfileId = 'semantic-layer';

export const SEMANTIC_LAYER_PROFILE_PATH = '/semantic-layer/v1/mcp' as const;
export const ORGANIZATION_AUDIT_PROFILE_PATH = '/organization-audit/v1/mcp' as const;
export const CONTENT_READER_PROFILE_PATH = '/content-reader/v1/mcp' as const;
export const CONTENT_DEVELOPER_PROFILE_PATH = '/content-developer/v1/mcp' as const;
export const CONTENT_GOVERNANCE_PROFILE_PATH = '/content-governance/v1/mcp' as const;
export const AI_AGENT_CHAT_PROFILE_PATH = '/ai-agent-chat/v1/mcp' as const;
export const AI_AGENT_OPS_PROFILE_PATH = '/ai-agent-ops/v1/mcp' as const;
export const DATA_ANALYST_PROFILE_PATH = '/data-analyst/v1/mcp' as const;

/** Fixed HTTP mount paths for all shipped profiles (ADR-0006). */
export const PROFILE_PATHS: { readonly [K in ProfileId]: `/${string}` } = {
  'semantic-layer': SEMANTIC_LAYER_PROFILE_PATH,
  'organization-audit': ORGANIZATION_AUDIT_PROFILE_PATH,
  'content-reader': CONTENT_READER_PROFILE_PATH,
  'content-developer': CONTENT_DEVELOPER_PROFILE_PATH,
  'content-governance': CONTENT_GOVERNANCE_PROFILE_PATH,
  'ai-agent-chat': AI_AGENT_CHAT_PROFILE_PATH,
  'ai-agent-ops': AI_AGENT_OPS_PROFILE_PATH,
  'data-analyst': DATA_ANALYST_PROFILE_PATH,
};

const PROFILE_IDS_BY_PATH = new Map<string, ProfileId>(
  (Object.entries(PROFILE_PATHS) as [ProfileId, `/${string}`][]).map(([id, path]) => [path, id]),
);

/** Parse a CLI / allowlist profile id; returns undefined when invalid. */
export function parseProfileId(value: string): ProfileId | undefined {
  return (PROFILE_IDS as readonly string[]).includes(value) ? (value as ProfileId) : undefined;
}

export function getProfilePath(id: ProfileId): `/${string}` {
  // eslint-disable-next-line security/detect-object-injection -- ProfileId union
  return PROFILE_PATHS[id];
}

export function getDefaultProfilePath(): `/${string}` {
  return getProfilePath(DEFAULT_PROFILE_ID);
}

/** Resolve profile id from an HTTP request path, or undefined if unknown. */
export function getProfileIdByPath(path: string): ProfileId | undefined {
  if (path.trim().length === 0) {
    return undefined;
  }
  return PROFILE_IDS_BY_PATH.get(normalizeMcpPath(path));
}

/** All shipped HTTP mount paths (catalog order follows PROFILE_PATHS insertion). */
export function listCatalogProfilePaths(): string[] {
  return Object.values(PROFILE_PATHS);
}
