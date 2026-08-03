/**
 * Content response envelope helpers (RFC §10 / ADR-0021).
 */

import type { ProfileId } from '@lightdash-tools/common';

export type ContentReaderWarningCode =
  | 'CACHE_STALE'
  | 'FILTER_IGNORED'
  | 'PARAMETER_DEFAULTED'
  | 'PARTIAL_RESULT'
  | 'QUERY_RUNNING'
  | 'QUERY_TIMEOUT'
  | 'REDACTED'
  | 'SQL_EXECUTION_DISABLED'
  | 'STALE_CONTENT'
  | 'TRUNCATED'
  | 'UNSUPPORTED_TILE'
  | 'UNVERIFIED_CONTENT';

export type ContentReaderWarning = {
  code: ContentReaderWarningCode;
  message: string;
};

export type ContentReaderEnvelope<T> = {
  data: T;
  context: {
    profile: ProfileId;
    projectUuid: string;
    projectPinned: boolean;
    observedAt: string;
  };
  coverage: {
    complete: boolean;
    truncated: boolean;
    inaccessibleResources: string[];
  };
  warnings: ContentReaderWarning[];
};

export function contentReaderEnvelope<T>(
  data: T,
  opts: {
    profile: ProfileId;
    projectUuid: string;
    projectPinned: boolean;
    complete?: boolean;
    truncated?: boolean;
    inaccessibleResources?: string[];
    warnings?: ContentReaderWarning[];
  },
): ContentReaderEnvelope<T> {
  return {
    data,
    context: {
      profile: opts.profile,
      projectUuid: opts.projectUuid,
      projectPinned: opts.projectPinned,
      observedAt: new Date().toISOString(),
    },
    coverage: {
      complete: opts.complete ?? true,
      truncated: opts.truncated ?? false,
      inaccessibleResources: opts.inaccessibleResources ?? [],
    },
    warnings: opts.warnings ?? [],
  };
}
