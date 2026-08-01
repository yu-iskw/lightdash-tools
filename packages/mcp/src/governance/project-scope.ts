/**
 * Project scope resolution for content-reader (ADR-0012).
 * Precedence: HTTP pin → LIGHTDASH_TOOLS_PROJECT_UUID → tool arg → PROJECT_SCOPE_REQUIRED.
 * Tool args cannot override pin or configured project.
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

/**
 * Resolve exactly one project for content-reader tools.
 * When pin or configured project is set, a mismatched explicit arg is rejected.
 */
export function resolveProjectScope(input?: { projectUuid?: string }): ResolvedProjectScope {
  const pinned = getPinnedProjectUuid();
  const configured = getConfiguredProjectUuid();
  const explicit = input?.projectUuid?.trim() ? input.projectUuid.trim() : undefined;

  if (pinned) {
    if (explicit && explicit !== pinned) {
      throw new ProjectScopeError(
        'PROJECT_SCOPE_MISMATCH',
        `projectUuid '${explicit}' conflicts with pinned project '${pinned}'`,
      );
    }
    return { projectUuid: pinned, source: 'pin', projectPinned: true };
  }

  if (configured) {
    if (explicit && explicit !== configured) {
      throw new ProjectScopeError(
        'PROJECT_SCOPE_MISMATCH',
        `projectUuid '${explicit}' conflicts with configured project '${configured}'`,
      );
    }
    return { projectUuid: configured, source: 'configured', projectPinned: false };
  }

  if (explicit) {
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

  throw new ProjectScopeError(
    'PROJECT_SCOPE_REQUIRED',
    'No project resolved. Set X-Lightdash-Project, LIGHTDASH_TOOLS_PROJECT_UUID, or pass projectUuid.',
  );
}
