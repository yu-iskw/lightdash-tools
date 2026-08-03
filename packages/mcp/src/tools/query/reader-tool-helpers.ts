/**
 * Shared error/warning helpers for pin-scoped and bounded-query MCP tools
 * (content-reader, content-developer, data-analyst, semantic discovery).
 */

import { ProjectScopeError } from '../../governance/project-scope.js';
import { toolErrorResult, withLightdashBlockedMarker } from '../shared.js';

import type { NormalizedQueryResult } from './result-normalizer.js';
import type { ContentReaderWarning, ContentReaderWarningCode } from '../../policy/envelope.js';
import type { TextContent } from '../shared.js';

/** Policy denials that should audit as `blocked` (stripped `_lightdashBlocked` marker). */
const BLOCKED_POLICY_CODES = new Set([
  'PROJECT_NOT_AVAILABLE',
  'PROJECT_SCOPE_MISMATCH',
  'PROJECT_SCOPE_REQUIRED',
  'CONTENT_NOT_EXECUTABLE',
  'CONTENT_NOT_FOUND',
  'INVALID_FILTER_OVERRIDE',
  'INVALID_PARAMETER_OVERRIDE',
  'QUERY_NOT_FOUND',
  'QUERY_EXPIRED',
  'QUERY_BUDGET_EXCEEDED',
  'RATE_LIMITED',
  'ROW_LIMIT_EXCEEDED',
  // content-developer preview tokens (ADR-0014 / ADR-0019)
  'PREVIEW_REQUIRED',
  'PREVIEW_STALE',
  'PREVIEW_NOT_VALIDATED',
  'PREVIEW_NOT_OWNED',
  'CHART_SLUG_EXISTS',
]);

export function codedErrorResult(code: string, message: string): TextContent {
  const result = toolErrorResult(code, message);
  if (BLOCKED_POLICY_CODES.has(code)) {
    return withLightdashBlockedMarker(result);
  }
  return result;
}

/** Map ProjectScopeError to a tool error result; rethrow anything else. */
export function projectScopeErrorResult(err: unknown): TextContent {
  if (err instanceof ProjectScopeError) {
    return codedErrorResult(err.code, err.message);
  }
  throw err;
}

export function warningFromNormalizedMessage(message: string): ContentReaderWarning {
  const known: ContentReaderWarningCode[] = ['QUERY_TIMEOUT', 'QUERY_RUNNING', 'TRUNCATED'];
  const code = known.includes(message as ContentReaderWarningCode)
    ? (message as ContentReaderWarningCode)
    : ('PARTIAL_RESULT' as const);
  return { code, message };
}

export function isCoverageComplete(
  result: Pick<NormalizedQueryResult, 'status' | 'truncated'>,
): boolean {
  return result.status === 'complete' && !result.truncated;
}

/** True when the async query will not produce further status transitions. */
export function isTerminalStatus(status: NormalizedQueryResult['status']): boolean {
  return status === 'complete' || status === 'failed' || status === 'cancelled';
}
