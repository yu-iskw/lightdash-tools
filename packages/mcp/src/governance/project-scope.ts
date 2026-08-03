/**
 * Project scope resolution (ADR-0008 / ADR-0012).
 *
 * Precedence: X-Lightdash-Project pin → tool projectUuid → PROJECT_SCOPE_REQUIRED.
 * When LIGHTDASH_TOOLS_ALLOWED_PROJECTS is set, the resolved UUID must be a member.
 */

import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS, validateUuid } from '@lightdash-tools/common';

import { isProjectAvailable } from './available-projects.js';
import { getPinnedProjectUuid } from './project-pin.js';

export type ProjectScopeErrorCode =
  'PROJECT_NOT_AVAILABLE' | 'PROJECT_SCOPE_MISMATCH' | 'PROJECT_SCOPE_REQUIRED';

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
  source: 'argument' | 'pin';
  projectPinned: boolean;
};

function assertArgMatchesPin(explicit: string | undefined, pinned: string): void {
  if (explicit && explicit.toLowerCase() !== pinned.toLowerCase()) {
    throw new ProjectScopeError(
      'PROJECT_SCOPE_MISMATCH',
      `projectUuid '${explicit}' conflicts with pinned project '${pinned}'`,
    );
  }
}

function resolveExplicitArgument(explicit: string): ResolvedProjectScope {
  try {
    return {
      projectUuid: validateUuid(explicit).toLowerCase(),
      source: 'argument',
      projectPinned: false,
    };
  } catch {
    throw new ProjectScopeError(
      'PROJECT_SCOPE_REQUIRED',
      `projectUuid '${explicit}' is not a valid UUID`,
    );
  }
}

function assertAvailable(projectUuid: string): void {
  if (!isProjectAvailable(projectUuid)) {
    throw new ProjectScopeError(
      'PROJECT_NOT_AVAILABLE',
      `projectUuid '${projectUuid}' is not in ${ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS}`,
    );
  }
}

/**
 * Resolve exactly one project for scoped MCP tools.
 * Pin wins; otherwise an explicit tool arg is required.
 * When the shared allowlist is set, the resolved UUID must be a member.
 */
export function resolveProjectScope(input?: { projectUuid?: string }): ResolvedProjectScope {
  const pinned = getPinnedProjectUuid();
  const trimmed = input?.projectUuid?.trim();
  const explicit = trimmed ? trimmed : undefined;

  let resolved: ResolvedProjectScope;
  if (pinned) {
    assertArgMatchesPin(explicit, pinned);
    resolved = {
      projectUuid: pinned.toLowerCase(),
      source: 'pin',
      projectPinned: true,
    };
  } else if (explicit) {
    resolved = resolveExplicitArgument(explicit);
  } else {
    throw new ProjectScopeError(
      'PROJECT_SCOPE_REQUIRED',
      'No project resolved. Set X-Lightdash-Project or pass projectUuid.',
    );
  }

  assertAvailable(resolved.projectUuid);
  return resolved;
}
