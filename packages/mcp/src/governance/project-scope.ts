/**
 * Project scope resolution (ADR-0012 / ADR-0015).
 *
 * Full mode (content-reader / content-developer):
 *   HTTP pin → LIGHTDASH_TOOLS_PROJECT_UUID → tool arg → PROJECT_SCOPE_REQUIRED.
 *
 * Pin-or-argument mode (content-governance):
 *   HTTP pin → tool arg → PROJECT_SCOPE_REQUIRED (ignores LIGHTDASH_TOOLS_PROJECT_UUID).
 *
 * Tool args cannot override pin or (in full mode) configured project.
 */

import { validateUuid } from '@lightdash-tools/common';

import { getPinnedProjectUuid } from './project-pin.js';

export const ENV_PROJECT_UUID = 'LIGHTDASH_TOOLS_PROJECT_UUID';

export type ProjectScopeErrorCode = 'PROJECT_SCOPE_MISMATCH' | 'PROJECT_SCOPE_REQUIRED';

export class ProjectScopeError extends Error {
  readonly code: ProjectScopeErrorCode;

  constructor(code: ProjectScopeErrorCode, message: string) {
    super(message);
    this.name = 'ProjectScopeError';
    this.code = code;
  }
}

export type ResolvedProjectScope = {
  projectUuid: string;
  source: 'argument' | 'configured' | 'pin';
  projectPinned: boolean;
};

/** Read and validate configured project UUID from env (empty → undefined). */
export function getConfiguredProjectUuid(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.LIGHTDASH_TOOLS_PROJECT_UUID;
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  try {
    return validateUuid(raw.trim());
  } catch {
    throw new ProjectScopeError(
      'PROJECT_SCOPE_REQUIRED',
      `${ENV_PROJECT_UUID} must be a valid UUID when set`,
    );
  }
}

export type ResolveProjectScopeOptions = {
  /**
   * When false, skip `LIGHTDASH_TOOLS_PROJECT_UUID` (content-governance).
   * Default true for content-reader / content-developer.
   */
  allowConfiguredEnv?: boolean;
};

function assertArgMatchesBound(
  explicit: string | undefined,
  bound: string,
  label: 'configured' | 'pinned',
): void {
  if (explicit && explicit !== bound) {
    throw new ProjectScopeError(
      'PROJECT_SCOPE_MISMATCH',
      `projectUuid '${explicit}' conflicts with ${label} project '${bound}'`,
    );
  }
}

function resolveExplicitArgument(explicit: string): ResolvedProjectScope {
  try {
    validateUuid(explicit);
  } catch {
    throw new ProjectScopeError(
      'PROJECT_SCOPE_REQUIRED',
      `projectUuid '${explicit}' is not a valid UUID`,
    );
  }
  return { projectUuid: explicit, source: 'argument', projectPinned: false };
}

/**
 * Resolve exactly one project for scoped MCP tools.
 * When pin or configured project is set, a mismatched explicit arg is rejected.
 */
export function resolveProjectScope(
  input?: { projectUuid?: string },
  options?: ResolveProjectScopeOptions,
): ResolvedProjectScope {
  const allowConfiguredEnv = options?.allowConfiguredEnv !== false;
  const pinned = getPinnedProjectUuid();
  const configured = allowConfiguredEnv ? getConfiguredProjectUuid() : undefined;
  const explicit = input?.projectUuid?.trim() ? input.projectUuid.trim() : undefined;

  if (pinned) {
    assertArgMatchesBound(explicit, pinned, 'pinned');
    return { projectUuid: pinned, source: 'pin', projectPinned: true };
  }

  if (configured) {
    assertArgMatchesBound(explicit, configured, 'configured');
    return { projectUuid: configured, source: 'configured', projectPinned: false };
  }

  if (explicit) {
    return resolveExplicitArgument(explicit);
  }

  throw new ProjectScopeError(
    'PROJECT_SCOPE_REQUIRED',
    allowConfiguredEnv
      ? 'No project resolved. Set X-Lightdash-Project, LIGHTDASH_TOOLS_PROJECT_UUID, or pass projectUuid.'
      : 'No project resolved. Set X-Lightdash-Project or pass projectUuid.',
  );
}
