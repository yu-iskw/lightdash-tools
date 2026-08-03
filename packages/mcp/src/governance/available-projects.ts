/**
 * Shared project allowlist for MCP (ADR-0008).
 *
 * Canonical: `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` (same env as CLI).
 * Unset/empty → unrestricted. Non-empty → hard ceiling for all profiles.
 * UUIDs normalized to lowercase; invalid / empty segments fail closed.
 *
 * Removed envs fail at startup if still set:
 * - `LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS`
 * - `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`
 */

import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS, validateUuid } from '@lightdash-tools/common';

export const ENV_ALLOWED_PROJECT_UUIDS = ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS;

/** Removed env — fail closed at validate if still present. */
const ENV_MCP_AVAILABLE_PROJECT_UUIDS_REMOVED = 'LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS';

/** Previous shared allowlist name — fail closed at validate if still present. */
const ENV_ALLOWED_PROJECTS_REMOVED = 'LIGHTDASH_TOOLS_ALLOWED_PROJECTS';

export class AvailableProjectsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvailableProjectsConfigError';
  }
}

export type AvailableProjectsPolicy =
  { restricted: false } | { restricted: true; uuids: ReadonlySet<string>; list: readonly string[] };

type ProcessCache = { raw: string; policy: AvailableProjectsPolicy };

let processCache: ProcessCache | undefined;

/** Clear process-env policy cache (tests only). */
export function resetAvailableProjectsCache(): void {
  processCache = undefined;
}

function parsePolicy(raw: string | undefined, envLabel: string): AvailableProjectsPolicy {
  if (raw === undefined || raw.trim() === '') {
    return { restricted: false };
  }
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.some((part) => part === '')) {
    throw new AvailableProjectsConfigError(
      `${envLabel} must be a non-empty comma-separated list of UUIDs (empty segments are not allowed)`,
    );
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    let uuid: string;
    try {
      uuid = validateUuid(part).toLowerCase();
    } catch {
      throw new AvailableProjectsConfigError(`${envLabel} contains invalid UUID '${part}'`);
    }
    if (!seen.has(uuid)) {
      seen.add(uuid);
      normalized.push(uuid);
    }
  }
  return { restricted: true, uuids: seen, list: normalized };
}

function resolveAllowlist(env: NodeJS.ProcessEnv): {
  raw: string;
  policy?: AvailableProjectsPolicy;
} {
  const raw = env.LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS;
  if (raw === undefined || raw.trim() === '') {
    return { raw: '', policy: { restricted: false } };
  }
  return { raw };
}

/** Parsed allowlist policy (cached for `process.env`). */
export function getAvailableProjectsPolicy(
  env: NodeJS.ProcessEnv = process.env,
): AvailableProjectsPolicy {
  const resolved = resolveAllowlist(env);
  if (env === process.env && processCache?.raw === resolved.raw) {
    return processCache.policy;
  }
  const policy =
    resolved.policy ?? parsePolicy(resolved.raw || undefined, ENV_ALLOWED_PROJECT_UUIDS);
  if (env === process.env) {
    processCache = { raw: resolved.raw, policy };
  }
  return policy;
}

export function isProjectAvailable(uuid: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const policy = getAvailableProjectsPolicy(env);
  if (!policy.restricted) {
    return true;
  }
  return policy.uuids.has(uuid.toLowerCase());
}

export function findUnavailableProjectUuids(
  uuids: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const policy = getAvailableProjectsPolicy(env);
  if (!policy.restricted) {
    return [];
  }
  return uuids.filter((uuid) => !policy.uuids.has(uuid.toLowerCase()));
}

export function filterProjectsByAvailability<T extends { projectUuid: string }>(
  projects: readonly T[],
  env: NodeJS.ProcessEnv = process.env,
): T[] {
  const policy = getAvailableProjectsPolicy(env);
  if (!policy.restricted) {
    return projects as T[];
  }
  return projects.filter((p) => policy.uuids.has(p.projectUuid.toLowerCase()));
}

export function resolveSearchProjectUuids(
  input: {
    pinned?: string;
    explicit?: readonly string[];
  },
  env: NodeJS.ProcessEnv = process.env,
): string[] | undefined {
  if (input.pinned) {
    return [input.pinned.toLowerCase()];
  }
  if (input.explicit && input.explicit.length > 0) {
    return input.explicit.map((u) => u.toLowerCase());
  }
  const policy = getAvailableProjectsPolicy(env);
  if (policy.restricted) {
    return [...policy.list];
  }
  return undefined;
}

/** Fail-closed startup: reject removed envs; validate ALLOWED_PROJECT_UUIDS. */
export function validateAvailableProjectsConfig(env: NodeJS.ProcessEnv = process.env): void {
  const removedMcp = env.LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS;
  if (removedMcp !== undefined && removedMcp.trim() !== '') {
    throw new AvailableProjectsConfigError(
      `${ENV_MCP_AVAILABLE_PROJECT_UUIDS_REMOVED} is no longer supported. ` +
        `Use ${ENV_ALLOWED_PROJECT_UUIDS} instead.`,
    );
  }
  const removedLegacy = env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
  if (removedLegacy !== undefined && removedLegacy.trim() !== '') {
    throw new AvailableProjectsConfigError(
      `${ENV_ALLOWED_PROJECTS_REMOVED} is no longer supported. ` +
        `Use ${ENV_ALLOWED_PROJECT_UUIDS} instead.`,
    );
  }
  getAvailableProjectsPolicy(env);
}
