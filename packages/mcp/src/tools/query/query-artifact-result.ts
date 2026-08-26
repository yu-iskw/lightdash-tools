/**
 * Build content-reader query tool results with optional data/sql artifacts (ADR-0032).
 */

import { contentReaderEnvelope } from '../../policy/envelope.js';
import {
  buildDataArtifact,
  buildSqlArtifact,
  catalogEntry,
  contentReaderArtifactUri,
} from '../lib/artifacts.js';
import { artifactToolResult } from '../shared.js';

import type { ContentReaderWarning } from '../../policy/envelope.js';
import type { ToolArtifactKind, ToolArtifactSpec, TextContent } from '../shared.js';
import type { NormalizedQueryResult } from './result-normalizer.js';
import type { ProfileId } from '@lightdash-tools/common';

export type QueryArtifactExtras = {
  /** Extra fields merged into envelope `data` (content identity, applied filters, …). */
  dataExtras?: Record<string, unknown>;
  /** Authored SQL: include body only when `include` has `'sql'`; catalog when uuid is known. */
  sql?: { savedSqlUuid: string; sql?: string };
};

/** Drop `rows` from the summary payload while preserving rowCount. */
export function toQuerySummaryPayload(
  normalized: NormalizedQueryResult,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const { rows, ...rest } = normalized;
  return {
    ...rest,
    ...extras,
    rowCount: normalized.rowCount ?? (Array.isArray(rows) ? rows.length : 0),
  };
}

export function buildQueryArtifactResult(args: {
  profile: ProfileId;
  projectUuid: string;
  projectPinned: boolean;
  normalized: NormalizedQueryResult;
  include: Set<ToolArtifactKind>;
  warnings: ContentReaderWarning[];
  complete: boolean;
  extras?: QueryArtifactExtras;
}): TextContent {
  const { normalized, include, extras } = args;
  const summaryPayload = toQuerySummaryPayload(normalized, extras?.dataExtras);
  const envelope = contentReaderEnvelope(summaryPayload, {
    profile: args.profile,
    projectUuid: args.projectUuid,
    projectPinned: args.projectPinned,
    complete: args.complete,
    truncated: normalized.truncated,
    warnings: args.warnings,
  });

  const artifacts: ToolArtifactSpec[] = [];
  const catalog = [];

  const dataUri = contentReaderArtifactUri('data', normalized.queryUuid || 'unknown');
  const hasRows = Array.isArray(normalized.rows);
  if (hasRows || include.has('data')) {
    const included = include.has('data') && hasRows;
    catalog.push(catalogEntry('data', dataUri, 'application/json', included));
    if (included) {
      artifacts.push(
        buildDataArtifact({
          queryUuid: normalized.queryUuid || 'unknown',
          rows: normalized.rows,
        }),
      );
    }
  }

  if (extras?.sql) {
    const sqlUri = contentReaderArtifactUri('sql', extras.sql.savedSqlUuid);
    const included = include.has('sql') && typeof extras.sql.sql === 'string';
    catalog.push(catalogEntry('sql', sqlUri, 'text/sql', included));
    if (included && extras.sql.sql !== undefined) {
      artifacts.push(
        buildSqlArtifact({
          savedSqlUuid: extras.sql.savedSqlUuid,
          sql: extras.sql.sql,
          forModel: true,
        }),
      );
    }
  }

  return artifactToolResult({
    summary: envelope as unknown as Record<string, unknown>,
    artifacts,
    catalog,
  });
}
